"""
LockCloud 后端入口（FastAPI）。

开发：python app.py            （默认端口 5000，读取 backend/.env）
生产：gunicorn -c gunicorn.conf.py asgi:app   （旧命令 wsgi:app 也能用）
接口文档：/docs（仅非生产环境）
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

import database
from config import BACKEND_DIR, settings
from errors import ApiError, HTTPError, debug_details, error_response, json_response
from exceptions import LockCloudException
from middleware import HttpLayer
from routers import (activities, admin, auth, beat_lab, comments, compare, downloads, file_requests, files, lockai, logs,
                     media, people, search, tags, trash)

logger = logging.getLogger('lockcloud')


def configure_logging() -> None:
    """控制台 + logs/app.log（10MB 轮转 5 份）。"""
    root = logging.getLogger()
    if getattr(root, '_lockcloud_configured', False):
        return
    root._lockcloud_configured = True  # type: ignore[attr-defined]
    root.setLevel(logging.INFO)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', '%H:%M:%S'))
    root.addHandler(console)
    log_dir = BACKEND_DIR / 'logs'
    log_dir.mkdir(exist_ok=True)
    handler = RotatingFileHandler(log_dir / 'app.log', maxBytes=10 * 1024 * 1024, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(name)s (%(filename)s:%(lineno)d): %(message)s', '%Y-%m-%d %H:%M:%S'))
    root.addHandler(handler)
    logging.getLogger('httpx').setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    database.migrate()
    # 文件增删后自动跑 embedding / 人脸 worker；定时任务（清上传、备份、聚类）
    from services.embed_trigger import init_embed_trigger
    from services.face_trigger import init_face_trigger
    from services.lockai import init_lockai
    from services.scheduler import shutdown_scheduler, start_scheduler
    init_embed_trigger()
    init_face_trigger()
    init_lockai()
    start_scheduler()
    logger.info('LockCloud 后端启动（%s）', settings.env)
    yield
    shutdown_scheduler()


app = FastAPI(
    title='LockCloud',
    lifespan=lifespan,
    redirect_slashes=False,
    docs_url=None if settings.is_production else '/docs',
    redoc_url=None,
    openapi_url=None if settings.is_production else '/openapi.json',
)
app.add_middleware(HttpLayer)


@app.exception_handler(ApiError)
async def _on_api_error(_: Request, exc: ApiError):
    return exc.response()


@app.exception_handler(LockCloudException)
async def _on_lockcloud_error(_: Request, exc: LockCloudException):
    return json_response(exc.to_dict(), exc.status_code)


@app.exception_handler(HTTPError)
async def _on_http_error(_: Request, exc: HTTPError):
    if exc.status == 400:
        return error_response('BAD_REQUEST', '请求参数错误', 400, details=debug_details(f'400 Bad Request: {exc}'))
    return error_response(f'HTTP_{exc.status}', exc.description, exc.status,
                          details=debug_details(f'{exc.status}: {exc}'))


@app.exception_handler(RequestValidationError)
async def _on_validation_error(_: Request, exc: RequestValidationError):
    return error_response('BAD_REQUEST', '请求参数错误', 400, details=debug_details(str(exc.errors())))


_HTTP_ERRORS = {
    404: ('NOT_FOUND', '请求的资源不存在', '404 Not Found: The requested URL was not found on the server. '
          'If you entered the URL manually please check your spelling and try again.'),
    405: ('METHOD_NOT_ALLOWED', '不支持的请求方法', '405 Method Not Allowed: The method is not allowed for the '
          'requested URL.'),
}


@app.exception_handler(StarletteHTTPException)
async def _on_starlette_error(_: Request, exc: StarletteHTTPException):
    code, message, detail = _HTTP_ERRORS.get(exc.status_code, (f'HTTP_{exc.status_code}', '请求处理失败', str(exc)))
    return error_response(code, message, exc.status_code, details=debug_details(detail))


@app.get('/')
def index():
    return json_response({'status': 'ok', 'message': 'LockCloud API 正在运行'})


@app.get('/health')
def health():
    return json_response({'status': 'healthy', 'service': 'lockcloud-backend'})


for module in (auth, files, media, people, logs, admin, tags, file_requests, trash, compare, activities, search,
               comments, downloads, lockai, beat_lab):
    app.include_router(module.router)


if __name__ == '__main__':
    import uvicorn

    # 开发用 5000（前端 .env.development 的 NEXT_PUBLIC_API_URL 指向这个端口）；生产走 gunicorn，绑 5001，见 gunicorn.conf.py
    uvicorn.run('app:app', host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')),
                reload=os.getenv('DEV_RELOAD', 'false').lower() == 'true')
