"""
Migration: persons 加 cover_pinned 列,标记代表脸是否由用户手动指定。

背景:
  原 persons.cover_face_id 在 cluster_faces.py 写库时按 area*conf 自动选最大最清晰的脸。
  但用户可能想钦定某张图作为该 person 的"代表头像",指定后下一次 worker / 增量分类
  就不该再覆盖。新增列做这事:
    cover_pinned = 0  → 自动选(默认),worker / cluster 可改写
    cover_pinned = 1  → 用户手动指定,后续逻辑必须保留

Run:
  cd backend && python migrations/add_persons_cover_pinned.py
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

    if _has_column(cur, "persons", "cover_pinned"):
        print("persons.cover_pinned already exists, skip")
    else:
        cur.execute(
            "ALTER TABLE persons ADD COLUMN cover_pinned INTEGER NOT NULL DEFAULT 0"
        )
        print("added persons.cover_pinned (default 0)")

    con.commit()
    con.close()

    now = datetime.now(timezone.utc).isoformat()
    print(f"\nMigration completed at {now}")


if __name__ == "__main__":
    migrate()
