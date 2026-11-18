"""数据库：SQLAlchemy 2.0，每个请求一个会话（FastAPI 依赖 get_db），脚本和后台线程用 session()。

生产库是 instance/lockcloud.db（SQLite + sqlite-vec）。表结构沿用 Flask 版建的表，
migrate() 只补缺的表和列，可以反复执行。人脸、向量、人物这些表是原生 SQL 建的，见 migrations/。
"""

from __future__ import annotations

import logging
import math
import os
import sqlite3
from collections.abc import Iterator

import sqlalchemy as sa
import sqlite_vec
from sqlalchemy import event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import BACKEND_DIR, settings

logger = logging.getLogger(__name__)

INSTANCE_DIR = BACKEND_DIR / "instance"


class Base(DeclarativeBase):
    pass


@event.listens_for(Engine, "connect")
def _on_connect(dbapi_conn, _record):
    # 只对 SQLite 连接加载 sqlite-vec；以后换 Postgres 这里自动跳过
    if isinstance(dbapi_conn, sqlite3.Connection):
        dbapi_conn.enable_load_extension(True)
        sqlite_vec.load(dbapi_conn)
        dbapi_conn.enable_load_extension(False)
        # WAL：后台 worker 写库时接口照样能读；busy_timeout：遇到写锁先等 10 秒再报错
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=10000")
        cur.close()


def resolve_database_url(raw: str | None = None) -> sa.URL:
    """相对路径的 SQLite 放进 instance/，和 Flask-SQLAlchemy 的位置一致。"""
    url = make_url(raw or settings.database_url)
    if url.get_backend_name() == "sqlite":
        database = url.database or ""
        if database and database != ":memory:" and not os.path.isabs(database):
            INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
            url = url.set(database=str(INSTANCE_DIR / database))
    return url


engine: sa.Engine | None = None
# 和 Flask-SQLAlchemy 的默认值一样：自动 flush、提交后过期
SessionLocal = sessionmaker(autoflush=True, expire_on_commit=True)


def init_engine(url: str | None = None) -> sa.Engine:
    """建引擎；重复调用会换库。"""
    global engine
    resolved = resolve_database_url(url)
    kwargs: dict = {}
    if resolved.get_backend_name() == "sqlite":
        # 同一个请求的会话可能在不同的线程池线程里用到
        kwargs["connect_args"] = {"check_same_thread": False}
    if engine is not None:
        engine.dispose()
    engine = sa.create_engine(resolved, **kwargs)
    SessionLocal.configure(bind=engine)
    return engine


def get_engine() -> sa.Engine:
    return engine if engine is not None else init_engine()


def session() -> Session:
    """脚本、后台线程用：with database.session() as db: ..."""
    get_engine()
    return SessionLocal()


def get_db() -> Iterator[Session]:
    db = session()
    try:
        yield db
    finally:
        db.close()


class Page:
    """分页结果，字段和算法同 Flask-SQLAlchemy 的 paginate(error_out=False)。"""

    def __init__(self, query, page: int, per_page: int):
        self.page = page if page >= 1 else 1
        self.per_page = per_page if per_page >= 1 else 20
        self.items = query.limit(self.per_page).offset((self.page - 1) * self.per_page).all()
        self.total = query.order_by(None).count()

    @property
    def pages(self) -> int:
        return math.ceil(self.total / self.per_page) if self.total else 0

    @property
    def has_next(self) -> bool:
        return self.page < self.pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1

    def meta(self) -> dict:
        return {'page': self.page, 'per_page': self.per_page, 'total': self.total, 'pages': self.pages,
                'has_next': self.has_next, 'has_prev': self.has_prev}


def paginate(query, page: int, per_page: int) -> Page:
    return Page(query, page, per_page)


# (表, 列, 类型)：老库缺哪列补哪列。都是历次迁移加过的列，线上库早就有了
_ADDED_COLUMNS = [
    ("files", "original_filename", "VARCHAR(255)"),
    ("files", "activity_date", "DATE"),
    ("files", "activity_type", "VARCHAR(50)"),
    ("files", "activity_name", "VARCHAR(200)"),
    ("files", "is_legacy", "BOOLEAN NOT NULL DEFAULT 0"),
    ("files", "thumbhash", "VARCHAR(50)"),
    ("files", "embedding_status", "VARCHAR(32) NOT NULL DEFAULT 'pending'"),
    ("files", "face_status", "VARCHAR(32) NOT NULL DEFAULT 'pending'"),
    ("files", "raw_w", "INTEGER"),
    ("files", "raw_h", "INTEGER"),
    ("files", "orientation", "INTEGER NOT NULL DEFAULT 1"),
    ("files", "media_status", "VARCHAR(16) NOT NULL DEFAULT 'pending'"),
    ("files", "media_info", "TEXT"),
    ("file_requests", "directory_info", "JSON"),
    # 2026-09 重构：拍摄时间、回收站、手动八拍、视频抽帧进度
    ("files", "taken_at", "VARCHAR(40)"),
    ("files", "deleted_at", "DATETIME"),
    ("files", "deleted_by", "INTEGER"),
    ("files", "beats_ones", "JSON"),
    ("files", "beats_updated_by", "INTEGER"),
    ("files", "beats_updated_at", "DATETIME"),
    # 2026-11：LockAI 分析的状态（详情在 lockai_jobs 表，create_all 建）
    ("files", "lockai_status", "VARCHAR(16)"),
    ("files", "frame_embedding_status", "VARCHAR(16) NOT NULL DEFAULT 'pending'"),
    ("files", "frame_face_status", "VARCHAR(16) NOT NULL DEFAULT 'pending'"),
    # 人物锚点记帧号（视频抽帧里的脸），见 services/person_anchors.py。real_people 是迁移脚本建的，没有就跳过
    ("real_people", "anchor_frame_id", "INTEGER"),
    # 2026-11：Live Photo 配对，见 services/live_photo.py
    ("files", "live_id", "VARCHAR(64)"),
    ("files", "live_photo_id", "INTEGER"),
    ("files", "live_video_id", "INTEGER"),
]

# 补列之后要补的索引（名字和模型 index=True 生成的一致，新库由 create_all 建）
_ADDED_INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_files_deleted_at ON files (deleted_at)",
    "CREATE INDEX IF NOT EXISTS ix_files_lockai_status ON files (lockai_status)",
    "CREATE INDEX IF NOT EXISTS ix_files_live_id ON files (live_id)",
    "CREATE INDEX IF NOT EXISTS ix_files_live_photo_id ON files (live_photo_id)",
]


def import_models() -> None:
    import auth.models  # noqa: F401
    import files.models  # noqa: F401
    import files.request_models  # noqa: F401
    import logs.models  # noqa: F401


def migrate() -> None:
    """建缺失的表、补缺失的列。只加不删。"""
    import_models()
    eng = get_engine()
    Base.metadata.create_all(eng)
    inspector = sa.inspect(eng)
    added = set()
    with eng.begin() as conn:
        if eng.dialect.name == "sqlite":
            # 人物的附加锚点表（合并进来的 cluster 靠它在重新聚类后链回来）
            from services.person_anchors import ANCHORS_DDL
            for ddl in ANCHORS_DDL:
                conn.execute(sa.text(ddl))
        for table, column, ddl in _ADDED_COLUMNS:
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                added.add((table, column))
                logger.info("[DB] 已添加 %s.%s 列", table, column)
        for ddl in _ADDED_INDEXES:
            conn.execute(sa.text(ddl))
        if ("files", "taken_at") in added and eng.dialect.name == "sqlite":
            # 新加的拍摄时间列：从已有的 media.json 结果里补上
            conn.execute(sa.text(
                "UPDATE files SET taken_at = json_extract(media_info, '$.taken_at') "
                "WHERE taken_at IS NULL AND json_valid(media_info) "
                "AND COALESCE(json_extract(media_info, '$.taken_at'), '') != ''"))
