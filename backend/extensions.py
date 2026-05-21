"""
Flask extensions initialization
Separate file to avoid circular imports
"""
import sqlite3

import sqlite_vec
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import event
from sqlalchemy.engine import Engine

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)


@event.listens_for(Engine, "connect")
def _load_sqlite_vec(dbapi_conn, _connection_record):
    # 仅对 SQLite 连接加载 sqlite-vec。未来若切 Postgres,这里自动跳过。
    if isinstance(dbapi_conn, sqlite3.Connection):
        dbapi_conn.enable_load_extension(True)
        sqlite_vec.load(dbapi_conn)
        dbapi_conn.enable_load_extension(False)

        # 提升并发能力:
        # 1) WAL:读不阻塞写,后台 sweep / cluster 写 DB 时,前端 API 还能读
        # 2) busy_timeout=10s:遇到写锁先等 10s 再报错,够 sweep 分批 commit
        #    之间的间隙挤进来。比直接抛"database is locked"友好得多。
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=10000")
        cur.close()


@limiter.request_filter
def exempt_options_requests():
    """Exempt OPTIONS requests from rate limiting for CORS preflight"""
    from flask import request
    return request.method == 'OPTIONS'
