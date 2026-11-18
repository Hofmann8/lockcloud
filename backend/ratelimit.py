"""进程内的固定窗口限流，规则和 Flask-Limiter 版一样：

- 每个接口（方法 + 路径）每个 IP 每分钟 100 次；/api/tags/search、POST /api/search 每分钟 30 次；
- OPTIONS 预检和媒体 FC 回调不限；
- 响应带 X-RateLimit-Limit / Remaining / Reset 和 Retry-After。

生产环境只有 1 个 worker（见 gunicorn.conf.py），计数放内存就够。测试里 RATELIMIT_ENABLED=false。
"""

from __future__ import annotations

import threading
import time

from config import settings

DEFAULT_LIMIT = (100, 60)
# (方法, 路径模板) → (次数, 窗口秒数)；None 表示不限
ROUTE_LIMITS: dict[tuple[str, str], tuple[int, int] | None] = {
    ('GET', '/api/tags/search'): (30, 60),
    ('POST', '/api/search'): (30, 60),
    ('POST', '/api/files/internal/media-result'): None,
    ('POST', '/api/files/internal/job-result'): None,
}


class RateLimiter:
    def __init__(self) -> None:
        self.enabled = settings.ratelimit_enabled
        self._lock = threading.Lock()
        self._hits: dict[str, tuple[float, int]] = {}
        self._last_sweep = time.time()

    def _sweep(self, now: float) -> None:
        if now - self._last_sweep < 300:
            return
        self._last_sweep = now
        self._hits = {k: v for k, v in self._hits.items() if v[0] > now}

    def hit(self, key: str, limit: int, window: int) -> tuple[bool, int, float]:
        """记一次。返回 (是否放行, 剩余次数, 窗口结束的时间戳)。"""
        now = time.time()
        with self._lock:
            self._sweep(now)
            reset_at, count = self._hits.get(key, (now + window, 0))
            if reset_at <= now:
                reset_at, count = now + window, 0
            if count >= limit:
                return False, 0, reset_at
            self._hits[key] = (reset_at, count + 1)
            return True, limit - count - 1, reset_at

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def limit_for(method: str, path: str) -> tuple[int, int] | None:
    return ROUTE_LIMITS.get((method, path), DEFAULT_LIMIT)
