"""
Migration: 迁到阿里云 OSS 需要的表结构。

  files.media_status  TEXT NOT NULL DEFAULT 'pending'   pending / ready / failed / skipped
  files.media_info    TEXT NULL                         转码 FC 写的 JSON：时长、尺寸、清晰度档位、有没有封面
  upload_tickets                                        签发上传地址时记一笔，确认上传时核对

可重复执行。scripts/migrate_to_oss.py 的 rewrite-db 步骤会自动调它，一般不用单独跑。

Run:
  cd backend && python migrations/add_oss_storage.py [--db 路径]
"""
import argparse
import os
import sqlite3

DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "lockcloud.db")


def _has_column(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def migrate(con: sqlite3.Connection) -> None:
    cur = con.cursor()
    if not _has_column(cur, "files", "media_status"):
        cur.execute("ALTER TABLE files ADD COLUMN media_status TEXT NOT NULL DEFAULT 'pending'")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_files_media_status ON files(media_status)")
        print("added files.media_status")
    if not _has_column(cur, "files", "media_info"):
        cur.execute("ALTER TABLE files ADD COLUMN media_info TEXT")
        print("added files.media_info")
    cur.execute(
        "CREATE TABLE IF NOT EXISTS upload_tickets ("
        " s3_key VARCHAR(255) PRIMARY KEY,"
        " user_id INTEGER NOT NULL,"
        " filename VARCHAR(255) NOT NULL,"
        " content_type VARCHAR(100) NOT NULL,"
        " size BIGINT NOT NULL,"
        " created_at DATETIME NOT NULL)"
    )
    # 不是图片也不是视频的文件不用等 FC；svg 也处理不了
    cur.execute(
        "UPDATE files SET media_status = 'skipped' WHERE media_status = 'pending' "
        "AND (content_type IS NULL OR content_type = 'image/svg+xml' "
        "OR (content_type NOT LIKE 'image/%' AND content_type NOT LIKE 'video/%'))"
    )
    con.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=DEFAULT_DB)
    args = parser.parse_args()
    if not os.path.exists(args.db):
        raise SystemExit(f"DB not found: {args.db}")
    connection = sqlite3.connect(args.db)
    migrate(connection)
    connection.close()
    print("done")
