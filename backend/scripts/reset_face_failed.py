"""把 face_status='failed' 的行重置回 'pending',下次 face_worker 再试。

用途:worker 因为环境/网络等非数据问题失败时(SSL、超时等),没必要
人工挑出哪些行该重试,统一回滚 pending 让 worker 重跑即可。

Usage:
  python scripts/reset_face_failed.py             # 全部 failed → pending
  python scripts/reset_face_failed.py --ids 49,50 # 指定 file_id
  python scripts/reset_face_failed.py --dry-run   # 只看不写
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import bindparam, text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ids", type=str, default=None, help="逗号分隔的 file_id")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    app = create_app()
    with app.app_context():
        if args.ids:
            ids = [int(x) for x in args.ids.split(",") if x.strip()]
            stmt = text(
                "SELECT id, filename, face_status FROM files "
                "WHERE id IN :ids AND face_status='failed'"
            ).bindparams(bindparam("ids", expanding=True))
            rows = db.session.execute(stmt, {"ids": ids}).fetchall()
        else:
            rows = db.session.execute(
                text(
                    "SELECT id, filename, face_status FROM files "
                    "WHERE face_status='failed' ORDER BY id"
                )
            ).fetchall()

        print(f"找到 {len(rows)} 行 face_status=failed:")
        for r in rows:
            print(f"  id={r[0]:>5}  {r[1]}")

        if args.dry_run:
            print("\n--dry-run,未写入。")
            return 0
        if not rows:
            return 0

        ans = input(f"\n确认把这 {len(rows)} 行改回 pending? [y/N] ").strip().lower()
        if ans != "y":
            print("取消。")
            return 0

        if args.ids:
            stmt = text(
                "UPDATE files SET face_status='pending' "
                "WHERE id IN :ids AND face_status='failed'"
            ).bindparams(bindparam("ids", expanding=True))
            db.session.execute(stmt, {"ids": ids})
        else:
            db.session.execute(
                text("UPDATE files SET face_status='pending' WHERE face_status='failed'")
            )
        db.session.commit()
        print(f"已重置 {len(rows)} 行。")
        return 0


if __name__ == "__main__":
    sys.exit(main())
