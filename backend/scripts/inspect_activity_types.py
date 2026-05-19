#!/usr/bin/env python3
"""一次性脚本:列出 files 表里 activity_type 的实际分布,用于规划 enum 收敛。
只读,不写任何数据。

Usage:
    python scripts/inspect_activity_types.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db
from sqlalchemy import text


def main():
    app = create_app()
    with app.app_context():
        rows = db.session.execute(
            text(
                "SELECT activity_type, COUNT(*) AS n "
                "FROM files "
                "GROUP BY activity_type "
                "ORDER BY n DESC"
            )
        ).fetchall()

        print(f"{'activity_type':<32} {'count':>8}")
        print("-" * 42)
        total = 0
        for value, n in rows:
            label = value if value is not None else "<NULL>"
            print(f"{label:<32} {n:>8}")
            total += n
        print("-" * 42)
        print(f"{'TOTAL':<32} {total:>8}")

        instr_rows = db.session.execute(
            text(
                "SELECT instructor, COUNT(*) AS n "
                "FROM files "
                "WHERE instructor IS NOT NULL AND instructor <> '' "
                "GROUP BY instructor "
                "ORDER BY n DESC"
            )
        ).fetchall()

        print()
        print("instructor 非空分布(确认是否真没在用):")
        if not instr_rows:
            print("  (无任何非空值)")
        else:
            for value, n in instr_rows:
                print(f"  {value!r:<40} {n}")

        preset_rows = db.session.execute(
            text(
                "SELECT value, display_name, is_active "
                "FROM tag_presets "
                "WHERE category = 'activity_type' "
                "ORDER BY is_active DESC, display_name"
            )
        ).fetchall()

        print()
        print("tag_presets 表里 activity_type 当前内容(前端编辑对话框拉的就是这里):")
        if not preset_rows:
            print("  (空表)")
        else:
            for value, display_name, is_active in preset_rows:
                flag = "✓" if is_active else "✗"
                print(f"  [{flag}] {value:<24} {display_name}")


if __name__ == "__main__":
    main()
