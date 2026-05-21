"""
Migration: 新建 real_people 表 + persons.real_person_id 外键。

核心架构变更:
  - persons 表退化成"纯 cluster 状态"(face_count, cover_face_id, 等),**不再存身份信息**
  - real_people 表存"用户认定的人":name + cover_pinned + anchor(file_id + bbox)
  - persons.real_person_id 是 cluster → 真人 的弱引用,reset 后会清空,要 reconcile

为什么 anchor 用 (file_id, bbox):
  - face_id 是 AUTOINCREMENT,reset 后旧 face_id 全失效;用它做锚点会丢
  - file_id 跟 file 一辈子绑定,稳定不变
  - 同一个 file 可能有多个人脸,需要 bbox 区分具体哪张脸
  - reset + face_worker 后用 (file_id, IoU > 0.5) 反查就能找到 anchor 对应的新 face,
    进而知道新 cluster 是谁

加完之后 reset 安全:
  - reset_face_all 只清 faces + persons,real_people 留着
  - 重跑完 cluster 后 reconcile_real_people 把 anchor → 新 cluster 链接补回

Run:
  cd backend && python migrations/add_real_people.py
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


def _has_table(cur, name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:n",
        {"n": name},
    )
    return cur.fetchone() is not None


def _has_column(cur, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"DB not found: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    if _has_table(cur, "real_people"):
        print("real_people 已存在,跳过建表")
    else:
        cur.execute(
            """
            CREATE TABLE real_people (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT,
              cover_pinned INTEGER NOT NULL DEFAULT 0,
              -- anchor:用来 reset 后反查"我是哪个新 cluster"
              anchor_file_id INTEGER,
              anchor_bbox_x INTEGER,
              anchor_bbox_y INTEGER,
              anchor_bbox_w INTEGER,
              anchor_bbox_h INTEGER,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        # 同名不允许两份(merge 流程依赖这点)
        cur.execute(
            "CREATE UNIQUE INDEX idx_real_people_name "
            "ON real_people(name) WHERE name IS NOT NULL"
        )
        cur.execute(
            "CREATE INDEX idx_real_people_anchor_file ON real_people(anchor_file_id)"
        )
        print("created real_people + indexes")

    if _has_column(cur, "persons", "real_person_id"):
        print("persons.real_person_id 已存在,跳过")
    else:
        cur.execute("ALTER TABLE persons ADD COLUMN real_person_id INTEGER")
        cur.execute(
            "CREATE INDEX idx_persons_real_person ON persons(real_person_id) "
            "WHERE real_person_id IS NOT NULL"
        )
        print("added persons.real_person_id + index")

    con.commit()
    con.close()
    now = datetime.now(timezone.utc).isoformat()
    print(f"\nMigration completed at {now}")


if __name__ == "__main__":
    migrate()
