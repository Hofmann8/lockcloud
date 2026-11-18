"""登录令牌（JWT）。

格式和 Flask 版（flask-jwt-extended 4.6）签发的一致：HS256，载荷 sub（字符串形式的用户 id）/ type / fresh /
jti / iat / nbf / exp，外加 email、name 等附加字段。JWT_SECRET_KEY 和 LockAuth 共用，
浏览器、App 里已有的令牌迁移后继续有效。校验失败时的错误码和提示也照旧：
  没带令牌 → AUTH_001 请先登录；坏令牌 → AUTH_004 无效的登录令牌；过期 → AUTH_004 登录已过期，请重新登录。
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from config import settings
from errors import ApiError, debug_details


def create_access_token(identity: str, additional_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'fresh': False,
        'iat': now,
        'jti': str(uuid.uuid4()),
        'type': 'access',
        'sub': identity,
        'nbf': now,
        'exp': now + timedelta(seconds=settings.jwt_expires_seconds),
    }
    payload.update(additional_claims or {})
    return jwt.encode(payload, settings.jwt_secret_key, algorithm='HS256')


def _unauthorized(detail: str) -> ApiError:
    return ApiError('AUTH_001', '请先登录', 401, details=debug_details(detail))


def _invalid(detail: str) -> ApiError:
    return ApiError('AUTH_004', '无效的登录令牌', 401, details=debug_details(detail))


def token_from_header(header: str | None) -> str:
    """和 flask-jwt-extended 一样解析 Authorization 头（允许逗号分隔的多个值）。"""
    auth = (header or '').strip().strip(',')
    if not auth:
        raise _unauthorized('Missing Authorization Header')
    candidates = [s for s in re.split(r',\s*', auth) if s.split() and s.split()[0] == 'Bearer']
    if len(candidates) != 1:
        raise _unauthorized("Missing 'Bearer' type in 'Authorization' header. "
                            "Expected 'Authorization: Bearer <JWT>'")
    parts = candidates[0].split()
    if len(parts) != 2:
        raise _invalid("Bad Authorization header. Expected 'Authorization: Bearer <JWT>'")
    return parts[1]


def decode_access_token(token: str) -> dict:
    """校验签名、有效期和类型，返回载荷；失败抛 ApiError。"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=['HS256'], options={'verify_aud': False})
    except jwt.ExpiredSignatureError:
        raise ApiError('AUTH_004', '登录已过期，请重新登录', 401, details={})
    except jwt.InvalidTokenError as e:
        raise _invalid(str(e))
    if 'sub' not in payload:
        raise _invalid('Missing claim: sub')
    if payload.get('type', 'access') != 'access':
        raise _invalid('Only non-refresh tokens are allowed')
    return payload
