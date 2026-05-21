"""自动触发 face_worker:File 表 insert/delete 之后异步检查 pending 并跑 worker。

跟 [[embed_trigger.py]] 同模式,只是后端跑 face_worker 而不是 embed_worker。
两个 trigger 各自一个线程互不阻塞:同一次 File insert 会同时触发图文 embedding
和人脸入库两条 pipeline。

注意:
  - 这里只跑 face_worker(检测 + 入库 faces 表),**不**做单脸归入 person 这步
  - 单脸归入 person 是聚类的"增量"形式,放后续 cluster_faces.py 的增量逻辑;
    MVP 阶段先让新脸 person_id=0,夜间 cron 跑 cluster_faces 即可

Caveat 同 embed_trigger:进程级 lock,gunicorn 多 worker 有竞争(可接受)。
"""
import logging
import threading

from sqlalchemy import event

from extensions import db
from files.models import File

log = logging.getLogger(__name__)

_DIRTY_KEY = "_face_files_dirty"

_lock = threading.Lock()
_running = False
_dirty = False


def init_face_trigger(app):
    """注册 SA 事件钩子;app factory 里调用一次。"""
    import os
    if not os.environ.get("FACE_FC_ENDPOINT"):
        app.logger.warning("auto-face 触发已禁用(FACE_FC_ENDPOINT 未设)")
        return

    logging.getLogger("face_worker").setLevel(logging.INFO)
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

    app.logger.info("auto-face 触发已启用(File insert/delete 后异步跑 face_worker)")


def _mark_dirty():
    try:
        db.session.info[_DIRTY_KEY] = True
    except Exception:
        pass


def _trigger(app):
    global _running, _dirty
    with _lock:
        if _running:
            _dirty = True
            log.debug("auto-face worker 已在跑,设 dirty")
            return
        _running = True

    threading.Thread(
        target=_worker_loop, args=(app,), daemon=True, name="face-auto",
    ).start()


def _worker_loop(app):
    global _running, _dirty
    from scripts.face_worker import run_in_context

    log.info("auto-face worker 启动")
    try:
        while True:
            try:
                with app.app_context():
                    run_in_context(limit=None, dry_run=False, workers=16)
            except Exception:
                log.exception("auto-face worker 崩溃,继续看 dirty")
            with _lock:
                if not _dirty:
                    _running = False
                    log.info("auto-face worker 退出(无新 pending)")
                    return
                _dirty = False
                log.info("auto-face worker 检测到 dirty,再扫一轮")
    except Exception:
        with _lock:
            _running = False
            _dirty = False
        log.exception("auto-face loop 崩溃,已清零状态")
