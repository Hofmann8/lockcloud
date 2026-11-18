"""
Gunicorn 配置（FastAPI / ASGI）。

启动：gunicorn -c gunicorn.conf.py asgi:app
（旧命令 wsgi:app 也能用，见 wsgi.py）
"""
import os

# 只听本机，由 nginx 反代
bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:5001")

# 限流计数、定时任务、embedding / 人脸的待处理队列都在进程内存里，保持 1 个 worker。
# 普通接口是同步函数，在 worker 的线程池里并发执行。
workers = int(os.environ.get("GUNICORN_WORKERS", 1))
worker_class = "uvicorn_worker.UvicornWorker"

# AI 请求最多需要 300 秒，留出缓冲
timeout = 360
graceful_timeout = 30
keepalive = 5

# 日志(目录不存在就建,部署时 logs/ 不进包)
_LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(_LOG_DIR, exist_ok=True)
accesslog = os.path.join(_LOG_DIR, "gunicorn_access.log")
errorlog = os.path.join(_LOG_DIR, "gunicorn_error.log")
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")


def on_starting(server):
    server.log.info("=" * 80)
    server.log.info("LockCloud Backend 正在启动...")
    server.log.info(f"Bind: {bind}  Workers: {workers}  Timeout: {timeout}s")
    server.log.info("=" * 80)


proc_name = "lockcloud-backend"
preload_app = False

# 不设 max_requests：worker 定期重启会丢掉进程内的 embedding / 人脸队列和限流计数

limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190
