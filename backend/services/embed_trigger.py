"""
自动触发 embedding worker:File 表 insert/delete 之后,异步检查 pending 并跑 worker。

设计:
  - SQLAlchemy mapper 事件(after_insert / after_delete)在 flush 时在
    session.info 上打脏标
  - session after_commit 看到脏标就 fire-and-forget 启线程跑 worker
  - 模块级 lock + dirty 双标志保证全局最多一个 worker 线程在跑;
    跑期间又来 trigger,设 dirty,当前批次结束后再扫一轮

Why 这样设计:
  - worker 跑 1634 张要 3-4 分钟,期间可能有新上传,不能丢
  - 但不能并发跑多个 worker(SQLite 单写 + API 配额)
  - subprocess 冷启贵(每次加载 Flask + 客户端 5-10s),in-process 复用便宜
  - 改 routes 不如挂模型事件 —— routes 有十几处 File 增删,
    sprinkle 触发点容易漏,SA 事件保证覆盖全部

Caveat:
  - 进程级互斥(threading.Lock),如果 gunicorn 多 worker,跨 worker
    会有竞争 —— 同一 file_id 可能被两个进程同时跑,落地时一个 UNIQUE
    冲突。本项目当前 1-2 gunicorn worker,可接受。规模上去要换文件锁。
"""
import logging
import threading

from sqlalchemy import event

from extensions import db
from files.models import File

log = logging.getLogger(__name__)

_DIRTY_KEY = "_embed_files_dirty"

_lock = threading.Lock()
_running = False
_dirty = False


def init_embed_trigger(app):
    """注册 SA 事件钩子;app factory 里调用一次。"""
    try:
        # 启动时 smoke 客户端配置,避免每次上传都喷 init error
        from services.embedding_service import EmbeddingClient
        EmbeddingClient.from_env()
    except Exception as e:
        app.logger.warning("auto-embed 触发已禁用(client 初始化失败): %s", e)
        return

    # worker 模块的日志接到 root,Flask logging 体系才看得见
    logging.getLogger("embed_worker").setLevel(logging.INFO)
    logging.getLogger(__name__).setLevel(logging.INFO)

    @event.listens_for(File, "after_insert")
    def _on_insert(mapper, connection, target):
        _mark_dirty()

    @event.listens_for(File, "after_delete")
    def _on_delete(mapper, connection, target):
        _mark_dirty()

    @event.listens_for(db.session, "after_commit")
    def _on_commit(session):
        if session.info.pop(_DIRTY_KEY, False):
            _trigger(app)

    app.logger.info("auto-embed 触发已启用(File insert/delete 后异步跑 worker)")


def _mark_dirty():
    try:
        db.session.info[_DIRTY_KEY] = True
    except Exception:
        # 极少数无 session context 的场景(后台脚本通过 SA 直接操作)兜底
        pass


def _trigger(app):
    """启动 worker 线程(如果还没跑);已在跑则设 dirty 让其循环。"""
    global _running, _dirty
    with _lock:
        if _running:
            _dirty = True
            log.debug("auto-embed worker 已在跑,设 dirty")
            return
        _running = True

    threading.Thread(
        target=_worker_loop, args=(app,), daemon=True, name="embed-auto",
    ).start()


def _worker_loop(app):
    """线程主体:跑 worker → 若 dirty 再跑 → 直到 dirty 清空。"""
    global _running, _dirty
    from scripts.embed_worker import run_in_context

    log.info("auto-embed worker 启动")
    try:
        while True:
            try:
                with app.app_context():
                    run_in_context(limit=None, dry_run=False, workers=16)
            except Exception:
                log.exception("auto-embed worker 运行崩溃,继续看 dirty 是否要重跑")
            with _lock:
                if not _dirty:
                    _running = False
                    log.info("auto-embed worker 退出(无新 pending)")
                    return
                _dirty = False
                log.info("auto-embed worker 检测到 dirty,再扫一轮")
    except Exception:
        # 兜底:线程崩溃也要清零状态,否则后续 trigger 都被 _running=True 卡死
        with _lock:
            _running = False
            _dirty = False
        log.exception("auto-embed loop 崩溃,已清零状态")
