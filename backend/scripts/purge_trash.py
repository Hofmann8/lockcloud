"""
每天 03:00 由 services/scheduler.py 调：彻底删除进回收站超过 30 天的文件
（桶里的 files/{uuid}、media/{uuid}/，人脸、向量、评论、数据库行），见 services/file_cleanup.py。

Usage:
    python scripts/purge_trash.py [--days 30] [--dry-run]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import database  # noqa: E402
from services.file_cleanup import TRASH_DAYS, purge_expired  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description='彻底删除回收站里超过 N 天的文件')
    parser.add_argument('--days', type=int, default=TRASH_DAYS, help=f'默认 {TRASH_DAYS} 天')
    parser.add_argument('--dry-run', action='store_true', help='只数一下，不删')
    args = parser.parse_args()
    database.import_models()
    with database.session() as db:
        purged, failed = purge_expired(db, days=args.days, dry_run=args.dry_run)
    prefix = '[dry-run] ' if args.dry_run else ''
    print(f'{prefix}trash purged: {purged}, failed: {failed}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
