"""
重置 files.embedding_status 状态 —— 让 embed_worker 重新捡起来。

常见场景:
  - 之前因为 5MB 上限被标 skipped_too_large 的图,现在 worker 改走缤纷云实时变换,要重新跑
  - 之前 failed 的想再重试一遍
  - 手动想清掉某种状态重新分类

会先 SELECT COUNT 给你看,然后 input 确认再 UPDATE,数据库改动不偷跑。

Usage:
  python scripts/reset_embedding_status.py skipped_too_large   # 把 skipped_too_large -> pending
  python scripts/reset_embedding_status.py failed              # 把 failed -> pending
  python scripts/reset_embedding_status.py skipped_too_large failed   # 多个一起
  python scripts/reset_embedding_status.py --yes failed        # 跳过确认(慎用)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402


ALLOWED_FROM = {"failed", "skipped_too_large", "skipped_unsupported", "ok"}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("statuses", nargs="+",
                   help=f"要重置的状态值(支持多个),允许: {sorted(ALLOWED_FROM)}")
    p.add_argument("--yes", action="store_true", help="跳过交互确认")
    args = p.parse_args()

    for s in args.statuses:
        if s not in ALLOWED_FROM:
            print(f"[错误] 不允许重置状态 {s!r}(允许: {sorted(ALLOWED_FROM)})")
            return 2

    app = create_app()
    with app.app_context():
        # SQLAlchemy 对 IN + tuple 的处理在不同版本有差异,用占位符安全拼
        placeholders = ",".join(f":s{i}" for i in range(len(args.statuses)))
        params = {f"s{i}": s for i, s in enumerate(args.statuses)}
        rows = db.session.execute(
            text(
                f"SELECT embedding_status, COUNT(*) AS n FROM files "
                f"WHERE embedding_status IN ({placeholders}) "
                f"GROUP BY embedding_status"
            ),
            params,
        ).all()

        if not rows:
            print(f"没有匹配 {args.statuses} 的行,啥也没干")
            return 0

        total = 0
        for status, n in rows:
            print(f"  {status:25s} {n:6d} 行")
            total += n
        print(f"  {'合计':25s} {total:6d} 行 -> 即将改为 pending")

        if not args.yes:
            ans = input("确认?[y/N] ").strip().lower()
            if ans != "y":
                print("已取消")
                return 0

        result = db.session.execute(
            text(
                f"UPDATE files SET embedding_status='pending' "
                f"WHERE embedding_status IN ({placeholders})"
            ),
            params,
        )
        db.session.commit()
        print(f"已更新 {result.rowcount} 行 -> pending")
        return 0


if __name__ == "__main__":
    sys.exit(main())
