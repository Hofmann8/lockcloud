"""回滚 add_image_dimensions.py:把 files.image_w / image_h 删掉。

原因:UI 改方案,详情页不再画 bbox 框,改成显示该图里出现的"人物代表头像"。
原图绝对像素坐标不再需要被前端归一化,所以这两列没用了。

SQLite 3.35+ 支持 ALTER TABLE DROP COLUMN(Python 3.10 自带 sqlite 是 3.40+)。

幂等。
Run:
  cd backend && python migrations/drop_image_dimensions.py
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "instance",
    "lockcloud.db",
)


def _has_column(cur, table, col):
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == col for row in cur.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"DB not found: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    print(f"sqlite version: {sqlite3.sqlite_version}")

    for col in ("image_w", "image_h"):
        if _has_column(cur, "files", col):
            cur.execute(f"ALTER TABLE files DROP COLUMN {col}")
            print(f"dropped files.{col}")
        else:
            print(f"files.{col} not present, skip")

    con.commit()
    con.close()
    print("Rollback completed.")


if __name__ == "__main__":
    migrate()
