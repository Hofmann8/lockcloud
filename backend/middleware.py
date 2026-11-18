"""HTTP 外层：安全头、CORS、OPTIONS 预检、HEAD、限流。行为照搬 Flask 版：

- 安全头（HSTS、nosniff、X-Frame-Options DENY、X-XSS-Protection、Referrer-Policy、CSP）每个响应都加；
- CORS 按 Flask-Cors 的规则：允许的 Origin 原样回写并带 Allow-Credentials；请求没带 Origin 时
  回写全部配置的域名（Flask-Cors 的 always_send）；响应自己已经设了 Allow-Origin 的不动（HLS 播放列表是 *）；
- 路径存在的 OPTIONS 直接回 200 空响应，不存在的照常 404；
- HEAD 按 GET 处理、不回响应体；
- 限流见 ratelimit.py。
"""

from __future__ import annotations

import re
import time

from starlette.datastructures import Headers, MutableHeaders
from starlette.routing import Match

from config import settings
from errors import debug_details, error_response, log
from ratelimit import limit_for, limiter

SECURITY_HEADERS = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
}

CORS_METHODS = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
CORS_ALLOW_HEADERS = ('Content-Type', 'Authorization')
_REGEX_CHARS = set('*\\]?$^[]()')


def _probably_regex(value: str) -> bool:
    return any(c in _REGEX_CHARS for c in value)


def _matches(value: str, pattern: str) -> bool:
    if _probably_regex(pattern):
        return re.match(pattern, value, flags=re.IGNORECASE) is not None
    return value.lower() == pattern.lower()


def cors_headers(method: str, request_headers: Headers) -> list[tuple[str, str]]:
    origins = settings.cors_origins
    origin = request_headers.get('origin')
    if origin:
        allowed = [origin] if any(_matches(origin, o) for o in origins) else []
    else:
        allowed = sorted(o for o in origins if not _probably_regex(o))
    if not allowed:
        return []
    out = [('Access-Control-Allow-Origin', o) for o in allowed]
    out.append(('Access-Control-Allow-Credentials', 'true'))
    if method == 'OPTIONS':
        wanted = request_headers.get('access-control-request-method', '').upper()
        if wanted and wanted in CORS_METHODS:
            requested = request_headers.get('access-control-request-headers')
            if requested:
                names = [h.strip() for h in requested.split(',')]
                allow = ', '.join(sorted(h for h in names if any(_matches(h, a) for a in CORS_ALLOW_HEADERS)))
                if allow:
                    out.append(('Access-Control-Allow-Headers', allow))
            out.append(('Access-Control-Allow-Methods', CORS_METHODS))
    if len(origins) > 1 or len(allowed) > 1 or any(map(_probably_regex, origins)):
        out.append(('Vary', 'Origin'))
    return out


def client_ip(headers: Headers, client) -> str:
    """和 ProxyFix(x_for=1) 一样取 X-Forwarded-For 的最后一段（nginx 追加的真实地址）。"""
    forwarded = headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[-1].strip()
    return client[0] if client else '127.0.0.1'


def _flat_routes(routes) -> list:
    """展开成一条条带完整路径的路由。新版 FastAPI 的 include_router 不再拷贝路由，
    而是挂一个包装对象（original_router 里是原来的 APIRouter，路径已带 prefix）。"""
    out = []
    for route in routes:
        sub = getattr(route, 'original_router', None)
        out.extend(_flat_routes(sub.routes) if sub is not None else [route])
    return out


class HttpLayer:
    def __init__(self, app):
        self.app = app
        self._routes = None

    def _route(self, scope):
        """匹配到的路由和匹配程度（FULL：方法也对；PARTIAL：只有路径对）。"""
        if self._routes is None:
            self._routes = _flat_routes(scope['app'].router.routes)
        partial = None
        for route in self._routes:
            match, _ = route.matches(scope)
            if match == Match.FULL:
                return route, Match.FULL
            if match == Match.PARTIAL and partial is None:
                partial = route
        return (partial, Match.PARTIAL) if partial else (None, Match.NONE)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        request_headers = Headers(scope=scope)
        method = scope['method']
        head = method == 'HEAD'
        if head:
            scope = dict(scope, method='GET')
        route, match = self._route(scope)
        cors = cors_headers(method, request_headers)
        extra: list[tuple[str, str]] = []

        async def send_wrapper(message):
            if message['type'] == 'http.response.start':
                headers = MutableHeaders(scope=message)
                for k, v in SECURITY_HEADERS.items():
                    headers[k] = v
                if 'access-control-allow-origin' not in headers:
                    for k, v in cors:
                        headers.append(k, v)
                for k, v in extra:
                    headers[k] = v
            elif message['type'] == 'http.response.body' and head:
                message = dict(message, body=b'')
            await send(message)

        if method == 'OPTIONS' and route is not None:
            await send_wrapper({'type': 'http.response.start', 'status': 200,
                                'headers': [(b'content-type', b'text/html; charset=utf-8'),
                                            (b'content-length', b'0')]})
            await send_wrapper({'type': 'http.response.body', 'body': b''})
            return

        if limiter.enabled and match == Match.FULL and method != 'OPTIONS':
            rule = limit_for(scope['method'], route.path)
            if rule:
                amount, window = rule
                key = f"{client_ip(request_headers, scope.get('client'))}|{scope['method']}|{route.path}"
                allowed, remaining, reset_at = limiter.hit(key, amount, window)
                extra += [('X-RateLimit-Limit', str(amount)), ('X-RateLimit-Remaining', str(remaining)),
                          ('X-RateLimit-Reset', str(int(reset_at))),
                          ('Retry-After', str(max(0, int(reset_at - time.time()))))]
                if not allowed:
                    response = error_response('RATE_LIMIT', '请求过于频繁，请稍后再试', 429,
                                              details=debug_details(f'429 Too Many Requests: {amount} per 1 minute'))
                    await response(scope, receive, send_wrapper)
                    return

        started = False

        async def tracked_send(message):
            nonlocal started
            if message['type'] == 'http.response.start':
                started = True
            await send_wrapper(message)

        try:
            await self.app(scope, receive, tracked_send)
        except Exception as e:
            # 没人接的异常在这里转成统一格式，这样也带上安全头和 CORS 头
            log.error(f'Unhandled exception: {type(e).__name__} - {e}', exc_info=True)
            if started:
                raise
            await unhandled_response(e)(scope, receive, send_wrapper)


def unhandled_response(error: Exception):
    if 'sqlalchemy' in str(type(error)).lower():
        return error_response('DATABASE_ERROR', '保存失败，请稍后再试', 500,
                              details=str(error) if settings.debug else {})
    return error_response('INTERNAL_ERROR', '服务器错误，请稍后再试', 500,
                          details=str(error) if settings.debug else '请联系管理员')
