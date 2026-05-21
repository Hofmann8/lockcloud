"""
Migration: files 加 public_mirror_at 列,记录被 mirror 到 public 桶的时间。

背景:
  人脸/视频抽帧等"需要对图做自定义参数处理"的功能,缤纷云只允许公开桶用动态 URL
  参数(?rect=...等)。所以引入"公开桶 = 中转操作区"模式:
    - 私有桶 funkandlove-cloud2 = 原始/权威数据
    - 公开桶 funkandlove-cloud-public = backend 真正动过手的文件的副本
  face_worker 检测到 ≥1 张脸时,server-side copy 原文件到公开桶,记 mirror_at。
  前端拼公开桶 URL + rect 参数取人脸 thumb。

新增对象:
  files.public_mirror_at  TEXT NULL   ISO 时间,NULL = 还没 mirror

Run:
  cd backend && python migrations/add_public_mirror_at.py
"""
import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "instance",
    "lockcloud.db",
)


def _has_column(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"DB not found: {DB_PATH}")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    if _has_column(cur, "files", "public_mirror_at"):
        print("files.public_mirror_at already exists, skip")
    else:
        cur.execute("ALTER TABLE files ADD COLUMN public_mirror_at TEXT")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_files_public_mirror_at "
            "ON files(public_mirror_at) WHERE public_mirror_at IS NOT NULL"
        )
        print("added files.public_mirror_at + partial index")

    con.commit()
    con.close()

    now = datetime.now(timezone.utc).isoformat()
    print(f"\nMigration completed at {now}")


if __name__ == "__main__":
    migrate()
