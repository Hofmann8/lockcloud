"""
Migration: files 加 raw_w / raw_h / orientation,给"在已加载大图上做 CSS 裁切"用。

背景:
  FC handler 检测时已经算了 raw 尺寸 + EXIF orientation,但 face_worker 只写了 faces
  表的 bbox(raw 系),没把 file 元信息落库。
  详情页要在已经加载的大图上画 person chip(零额外网络),需要把 raw bbox 反变换到
  EXIF 应用后的坐标系,而 EXIF 应用尺寸 = raw 尺寸 swap if orientation ∈ {5,6,7,8}。
  所以需要 raw_w / raw_h / orientation 三件套。

新增列(全允许 NULL,旧文件慢慢补):
  files.raw_w        INTEGER   磁盘字节像素宽
  files.raw_h        INTEGER   磁盘字节像素高
  files.orientation  INTEGER   EXIF orientation 1..8,默认 1

Run:
  cd backend && python migrations/add_files_image_dims.py
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

    added = []
    for col, ddl in [
        ("raw_w", "ALTER TABLE files ADD COLUMN raw_w INTEGER"),
        ("raw_h", "ALTER TABLE files ADD COLUMN raw_h INTEGER"),
        ("orientation",
         "ALTER TABLE files ADD COLUMN orientation INTEGER NOT NULL DEFAULT 1"),
    ]:
        if _has_column(cur, "files", col):
            print(f"files.{col} 已存在,跳过")
        else:
            cur.execute(ddl)
            added.append(col)
            print(f"added files.{col}")

    con.commit()
    con.close()

    now = datetime.now(timezone.utc).isoformat()
    print(f"\nMigration completed at {now}; added {added or '无新列'}")


if __name__ == "__main__":
    migrate()
