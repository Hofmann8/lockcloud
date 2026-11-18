"""统一错误格式：{"error": {"code", "message", ...}}，和 Flask 版一致。

接口里抛 ApiError；接口自己的"兜底 500"用 @guarded 包一层，
和 Flask 版每个视图函数外面那层 try/except 的错误码、提示一一对应。
"""

from __future__ import annotations

import functools
import json
import logging
from typing import Any

from fastapi.responses import JSONResponse

from config import settings

log = logging.getLogger('lockcloud')


class JSON(JSONResponse):
    """中文不转义；NaN 照 Python json 的默认输出，不报错。"""

    def render(self, content: Any) -> bytes:
        return json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def json_response(body: Any, status: int = 200, headers: dict | None = None) -> JSON:
    return JSON(body, status_code=status, headers=headers)


def error_response(code: str, message: str, status: int, **extra) -> JSON:
    return JSON({'error': {'code': code, 'message': message, **extra}}, status_code=status)


def debug_details(detail: Any) -> Any:
    """框架层错误（404、坏令牌等）的 details：开发环境给原因，生产环境给 {}。"""
    return detail if settings.debug else {}


class ApiError(Exception):
    """在任何地方抛出，由 app.py 的处理器转成统一格式。extra 放进 error 对象（如 details、owner_id）。"""

    def __init__(self, code: str, message: str, status: int = 400, **extra):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra

    def response(self) -> JSON:
        return error_response(self.code, self.message, self.status, **self.extra)


class HTTPError(Exception):
    """框架层的 HTTP 错误（请求体不是 JSON 等）。视图外面有 @guarded 时被当成普通异常，和 Flask 一样。"""

    def __init__(self, status: int, description: str):
        super().__init__(description)
        self.status = status
        self.description = description


def guarded(message: str, code: str = 'INTERNAL_ERROR', status: int = 500):
    """视图兜底：ApiError 照常抛出，其他异常回滚会话、记日志，返回这个接口自己的错误提示。"""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except ApiError:
                raise
            except Exception as e:
                db = kwargs.get('db')
                if db is not None:
                    db.rollback()
                # 带上调用栈：接口只回固定文案，排查全靠这条日志
                log.error(f'{fn.__name__} failed: {e}', exc_info=True)
                return error_response(code, message, status)
        return wrapper
    return decorator
