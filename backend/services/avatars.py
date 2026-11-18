"""
头像：归 LockAuth 管。LockCloud 不存任何头像信息，显示时按邮箱问 LockAuth。

LockAuth 的服务端接口 `GET /api/auth/service/avatars`（需求见 lockauth/REQUESTS.md）一次返回全部成员的头像地址，
这里整份缓存 5 分钟。没配 LOCKAUTH_SERVICE_KEY、接口还没上线或调不通时返回 None，前端显示名字首字。
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Optional

import requests

from config import settings

log = logging.getLogger(__name__)

TTL = 300          # 成功后多久再拉一次
RETRY_AFTER = 60   # 失败后多久再试，期间沿用上一份
STYLE = 'avatarmd'  # 160px，界面上最大也就 40px 左右，够用

_lock = threading.Lock()
_table: dict[str, Optional[str]] = {}
_fresh_until = 0.0


def _fetch() -> Optional[dict[str, Optional[str]]]:
    key = settings.lockauth_service_key
    if not key:
        return None
    r = requests.get(f"{settings.sso_auth_api_url.rstrip('/')}/api/auth/service/avatars",
                     params={'style': STYLE}, headers={'X-Service-Key': key}, timeout=5)
    if r.status_code != 200:
        raise RuntimeError(f'HTTP {r.status_code}')
    return {(u.get('email') or '').lower(): u.get('avatar_url') for u in r.json().get('users', [])}


def _current() -> dict[str, Optional[str]]:
    global _table, _fresh_until
    if time.monotonic() < _fresh_until:
        return _table
    with _lock:
        now = time.monotonic()
        if now < _fresh_until:
            return _table
        try:
            fetched = _fetch()
            _table = fetched if fetched is not None else {}
            _fresh_until = now + TTL
        except Exception as e:  # noqa: BLE001 — 头像拿不到不能影响页面
            log.warning('LockAuth 头像接口调不通，%s 秒后再试: %s', RETRY_AFTER, e)
            _fresh_until = now + RETRY_AFTER
    return _table


def avatar_url(email: Optional[str]) -> Optional[str]:
    """这个邮箱在 LockAuth 的头像公开地址；没有或拿不到时 None。"""
    if not email:
        return None
    return _current().get(email.lower())


def reset_cache() -> None:
    """测试用：清掉缓存，下次调用重新问 LockAuth。"""
    global _table, _fresh_until
    with _lock:
        _table, _fresh_until = {}, 0.0
