"""请求级依赖和小工具：登录令牌、管理员、请求体、查询参数、客户端 IP、对外地址。"""

from __future__ import annotations

import json
from typing import Any

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from auth.models import User
from database import get_db
from errors import ApiError, HTTPError
from middleware import client_ip as _client_ip
from security import decode_access_token, token_from_header

# ---------------------------------------------------------------- 登录


def jwt_payload(request: Request) -> dict:
    return decode_access_token(token_from_header(request.headers.get('authorization')))


def jwt_identity(payload: dict = Depends(jwt_payload)) -> str:
    """令牌里的 sub（字符串形式的用户 id）。视图里自己 int()，转不了算视图自己的 500，和 Flask 版一样。"""
    return payload['sub']


def logs_admin(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)) -> User:
    """/api/logs 的管理员检查（Flask 版 auth/decorators.py）。"""
    user = db.get(User, int(identity))
    if not user:
        raise ApiError('AUTH_001', '账号不存在', 401)
    if not user.is_admin:
        raise ApiError('FORBIDDEN', '需要管理员权限', 403)
    return user


def admin_only(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)) -> User:
    """/api/admin 的管理员检查（Flask 版 admin/routes.py，用户不存在也是 403）。"""
    user = db.get(User, int(identity))
    if not user or not user.is_admin:
        raise ApiError('ADMIN_001', '需要管理员权限', 403)
    return user


# ---------------------------------------------------------------- 请求体


class Body:
    """请求体。get_json() 的行为和 Flask 一样：

    - Content-Type 不是 JSON → 415；JSON 解析失败 → 400（视图外有 @guarded 时变成那个接口的 500）；
    - silent=True 时这两种情况都返回 None。
    """

    def __init__(self, raw: bytes, content_type: str):
        self.raw = raw
        mimetype = content_type.split(';', 1)[0].strip().lower()
        self.is_json = mimetype == 'application/json' or (
            mimetype.startswith('application/') and mimetype.endswith('+json'))

    def get_json(self, silent: bool = False) -> Any:
        if not self.is_json:
            if silent:
                return None
            raise HTTPError(415, "Did not attempt to load JSON data because the request Content-Type "
                                 "was not 'application/json'.")
        try:
            return json.loads(self.raw)
        except ValueError as e:
            if silent:
                return None
            raise HTTPError(400, f'Failed to decode JSON object: {e}')


async def body(request: Request) -> Body:
    return Body(await request.body(), request.headers.get('content-type', ''))


# ---------------------------------------------------------------- 查询参数（werkzeug 的 request.args.get 语义）


def arg(request: Request, name: str, default: Any = None, type=None) -> Any:
    """取第一个同名参数；type 转换失败时返回 default。"""
    values = request.query_params.getlist(name)
    if not values:
        return default
    value = values[0]
    if type is None:
        return value
    try:
        return type(value)
    except ValueError:
        return default


# ---------------------------------------------------------------- 客户端


def client_ip(request: Request) -> str:
    return _client_ip(request.headers, request.scope.get('client'))


def user_agent(request: Request) -> str | None:
    return request.headers.get('user-agent')


def _last(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(',')[-1].strip() or None


def external_base_url(request: Request) -> str:
    """后端对外的地址（scheme://host），和 Flask 版 ProxyFix 之后的 request.host_url 一致。"""
    headers = request.headers
    scheme = _last(headers.get('x-forwarded-proto')) or request.url.scheme
    host = _last(headers.get('x-forwarded-host')) or headers.get('host') or request.url.netloc
    port = _last(headers.get('x-forwarded-port'))
    if port:
        host = (host.rsplit(':', 1)[0] if ':' in host and not host.endswith(']') else host) + f':{port}'
    if (scheme == 'http' and host.endswith(':80')) or (scheme == 'https' and host.endswith(':443')):
        host = host.rsplit(':', 1)[0]
    return f'{scheme}://{host}'
