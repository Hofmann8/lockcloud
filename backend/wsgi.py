"""WSGI entry point for production deployment.

scheduler 只在这里启,scripts/CLI 调用 create_app() 不会偷偷起。
"""
from app import create_app
from services.scheduler import start_scheduler

app = create_app()
start_scheduler(app)

if __name__ == "__main__":
    app.run(port=5001)
