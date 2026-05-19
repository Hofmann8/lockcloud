"""
Migration: 删除 tag_presets 表 + files.instructor 列,把 activity_type='未分类' 归一化为 NULL。

背景:
- TagPreset 全套机制下线,activity_type 改为代码层 6 元素白名单
- instructor 字段(267 条:'none' 202 + 'dragon' 65)整列废弃
- 历史脏数据 activity_type='未分类'(40 条)→ NULL

操作顺序很重要:
  1) UPDATE 把 '未分类' 改 NULL(纯数据修复,事务内)
  2) DROP INDEX idx_files_instructor(若存在)
  3) ALTER TABLE files DROP COLUMN instructor
  4) DROP TABLE tag_presets

幂等:每一步都先检查是否需要执行。重复跑安全。
不可逆:跑完前 instructor 列上的数据(包括 'dragon' 65 条)将不可恢复。

Run: python migrations/drop_tag_presets_and_instructor.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

from app import create_app
from extensions import db


def _has_table(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _has_column(inspector, table: str, column: str) -> bool:
    if not _has_table(inspector, table):
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def _has_index(inspector, table: str, index: str) -> bool:
    if not _has_table(inspector, table):
        return False
    return index in {i["name"] for i in inspector.get_indexes(table)}


def migrate():
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)

        # Step 1: normalize '未分类' -> NULL
        affected = db.session.execute(
            text(
                "UPDATE files SET activity_type = NULL "
                "WHERE activity_type = :legacy"
            ),
            {"legacy": "未分类"},
        ).rowcount
        print(f"[1/4] normalize activity_type='未分类' -> NULL: {affected} rows")

        # Step 2: drop index on instructor if present
        # (column might already be gone on a re-run; guard accordingly)
        if _has_column(inspector, "files", "instructor"):
            if _has_index(inspector, "files", "idx_files_instructor"):
                db.session.execute(text("DROP INDEX idx_files_instructor"))
                print("[2/4] dropped index idx_files_instructor")
            else:
                print("[2/4] index idx_files_instructor not found, skip")
        else:
            print("[2/4] column instructor already gone, skip index")

        # Step 3: drop column instructor
        if _has_column(inspector, "files", "instructor"):
            db.session.execute(text("ALTER TABLE files DROP COLUMN instructor"))
            print("[3/4] dropped column files.instructor")
        else:
            print("[3/4] column files.instructor already gone, skip")

        # Step 4: drop tag_presets table
        if _has_table(inspector, "tag_presets"):
            db.session.execute(text("DROP TABLE tag_presets"))
            print("[4/4] dropped table tag_presets")
        else:
            print("[4/4] table tag_presets already gone, skip")

        db.session.commit()
        print("Migration completed successfully.")


if __name__ == "__main__":
    migrate()
