# Gunicorn 配置文件
import multiprocessing
import os

# 服务器绑定
bind = "0.0.0.0:5001"

# Worker 配置
workers = 2
worker_class = "sync"  # 同步 worker

# Timeout 配置 - 关键！
# AI 请求最多需要 300 秒，所以设置为 360 秒（6 分钟）留出缓冲
timeout = 360
graceful_timeout = 30
keepalive = 5

# 日志配置
accesslog = os.path.join(os.path.dirname(__file__), "logs", "gunicorn_access.log")
errorlog = os.path.join(os.path.dirname(__file__), "logs", "gunicorn_error.log")
loglevel = "debug"  # 改为 debug 级别以捕获更多信息
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 日志处理器配置
def on_starting(server):
    """服务器启动时的回调"""
    server.log.info("=" * 80)
    server.log.info("LockCloud Backend 正在启动...")
    server.log.info(f"Workers: {workers}")
    server.log.info(f"Timeout: {timeout}s")
    server.log.info(f"日志级别: {loglevel}")
    server.log.info("=" * 80)

# 进程命名
proc_name = "lockcloud-backend"

# 预加载应用（可选，提高性能）
preload_app = False

# Worker 重启配置
max_requests = 1000  # 处理 1000 个请求后重启 worker，防止内存泄漏
max_requests_jitter = 50  # 添加随机抖动，避免所有 worker 同时重启

# 安全配置
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190
