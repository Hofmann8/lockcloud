"""APScheduler 进程内调度,跑那些"理应有 cron 但没接"的任务。

为什么不用系统 cron:
  - 仓库即文档:时间表写在代码里,push 即生效,VPS 重装不丢
  - 没有"代码改了 / VPS 漏配"的双源真理问题

设计要点:
  - BackgroundScheduler + SQLAlchemyJobStore(主 DB,共享 sqlite 表 apscheduler_jobs)
  - **只在 app.py 的 lifespan 里调用 start_scheduler() 才启动** —— scripts 不导入 app,
    避免 `python scripts/xxx.py` 也偷偷起一个 scheduler
  - SQLAlchemyJobStore 会 pickle job function + args 落库,所以:
    * job function 必须是 **模块顶级函数**(不能是 closure / lambda)
    * args 必须是 **picklable 基础类型**(str / list / int)
  - 任务用 subprocess 调起,每个任务是独立 Python 进程,
    出错不影响主 web 进程;日志独立到 logs/scheduler/<task>.log
  - 时区固定 Asia/Shanghai

任务表(每天):
  03:00  cleanup_uploads    清掉超过一天没确认的上传(票据 + 桶里的残留对象)
  03:00  purge_trash        彻底删除进回收站超过 30 天的文件(桶里的对象 + 人脸、向量、评论、行)
  03:30  backup_database    sqlite 落私有桶 backups/db/(参 [[backup_database.py]])
  04:00  cluster_faces      DBSCAN 重整 person 簇,把新积的 noise 拉进来

错峰 30min:避免同一时段 CPU/网 同时爆。

加新任务:在 JOBS 表里加一行,re-deploy 后 SQLAlchemyJobStore 会通过
replace_existing=True 自动更新表里的 next_run_time。
"""
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

log = logging.getLogger("scheduler")

_scheduler = None  # 进程级单例

BACKEND_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BACKEND_DIR / "logs" / "scheduler"


def run_subprocess(task_name, argv):
    """跑一个 subprocess 任务。

    必须是模块顶级函数 —— SQLAlchemyJobStore pickle 时只能引用 qualified name。
    args 全是 str / list,picklable。
    日志直接写文件。
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"{task_name}.log"
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(log_path, "a", encoding="utf-8") as logf:
            logf.write(f"\n{'=' * 60}\n[{ts}] {task_name} START: {' '.join(argv)}\n{'=' * 60}\n")
            logf.flush()
            ret = subprocess.run(
                argv,
                cwd=str(BACKEND_DIR),
                stdout=logf,
                stderr=subprocess.STDOUT,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
                check=False,
                timeout=3600,    # 1h 上限,防卡死
            )
            logf.write(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
                       f"{task_name} END rc={ret.returncode}\n")
        log.info("[scheduler] %s done rc=%s", task_name, ret.returncode)
    except subprocess.TimeoutExpired:
        log.error("[scheduler] %s timed out (>1h),killed", task_name)
    except Exception:
        log.exception("[scheduler] %s crashed", task_name)


# 任务表(改时间或加任务就改这里)
# id, hour, minute, argv
_PY = [sys.executable]
JOBS = [
    ("cleanup_uploads",  3, 0,  _PY + ["scripts/cleanup_uploads.py"]),
    ("purge_trash",      3, 0,  _PY + ["scripts/purge_trash.py"]),
    ("backup_database",  3, 30, _PY + ["scripts/backup_database.py"]),
    ("cluster_faces",    4, 0,  _PY + ["scripts/cluster_faces.py"]),
]


def start_scheduler():
    """启动 BackgroundScheduler。重复调用 idempotent。

    生产只有 1 个 worker(见 gunicorn.conf.py);万一开了多个,下面的文件锁保证只有一个起。
    多 gunicorn worker 的坑:
      1) 每个 worker fork 后都会调 start_scheduler,**两边一起 CREATE TABLE
         apscheduler_jobs 会撞表**,一个赢一个 crash → master 退出
      2) 就算建表过了,两边各跑一个 scheduler,cron 会**重复触发**
         (backup_database 跑 2 次、cluster_faces 跑 2 次 etc.)
    解决:文件锁。第一个 worker 抢到锁 → 真正起 scheduler;
    其他 worker 抢不到 → 安静地什么都不做。锁文件留在 /tmp,进程退出自动释放。
    """
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        log.info("[scheduler] 已经在跑,跳过")
        return _scheduler

    if os.environ.get("LOCKCLOUD_SCHEDULER_DISABLED") == "1":
        log.info("[scheduler] LOCKCLOUD_SCHEDULER_DISABLED=1,不启动")
        return None

    # ---- 抢文件锁,避免多 worker 同时起 ----
    # Windows 没 fcntl,直接跳过(开发机一般 workers=1)
    try:
        import fcntl
    except ImportError:
        fcntl = None

    if fcntl is not None:
        lock_path = "/tmp/lockcloud_scheduler.lock"
        try:
            _lock_fh = open(lock_path, "w")
            fcntl.flock(_lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # 进程退出时自动释放(fh 全局保留即可,防止 GC)
            globals()["_scheduler_lock_fh"] = _lock_fh
        except (BlockingIOError, OSError):
            log.info("[scheduler] 另一个 worker 已经持有锁,本 worker 不启 scheduler")
            return None

    from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    # 和 Flask 版一样直接用 DATABASE_URL：相对路径按工作目录（backend/）解析，任务表不在 instance/ 的主库里
    from config import settings
    jobstore = SQLAlchemyJobStore(url=settings.database_url, tablename="apscheduler_jobs")

    sched = BackgroundScheduler(
        jobstores={"default": jobstore},
        job_defaults={
            "coalesce": True,             # 错过的多次触发合并为一次
            "max_instances": 1,           # 同一 job 同时只能有一个实例
            "misfire_grace_time": 3600,   # 错过 ≤1h 仍补跑
        },
        timezone="Asia/Shanghai",
    )

    for job_id, hour, minute, argv in JOBS:
        sched.add_job(
            run_subprocess,                  # 顶级函数,可 pickle
            args=[job_id, argv],             # 全 str / list,可 pickle
            trigger=CronTrigger(hour=hour, minute=minute),
            id=job_id,
            replace_existing=True,
        )

    sched.start()
    _scheduler = sched

    lines = ["[scheduler] 启动完成,任务表(Asia/Shanghai):"]
    for job in sched.get_jobs():
        lines.append(f"  - {job.id:<20s} next={job.next_run_time}")
    log.info("\n".join(lines))
    return sched


def shutdown_scheduler():
    """进程退出时(lifespan 结束)调,优雅停。"""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None
