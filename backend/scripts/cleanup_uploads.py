"""
每天 03:00 由 services/scheduler.py 调，做两件事：

1. 清掉超过一天还没确认的上传：upload_tickets 里的票据，以及桶里已经传上去、但没人确认的对象。
   用户中途取消、网络断了、页面关了，都会留下这种残留。
2. 补收媒体 FC 的结果：FC 回调没送到（后端重启、网络抖动）的文件一直是 pending，
   桶里的 media.json 已经写好了，这里读进来。

Usage:
    python scripts/cleanup_uploads.py [--dry-run]
"""
import argparse
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import database  # noqa: E402
from files.models import INCLUDE_DELETED, File, UploadTicket  # noqa: E402
from services import media  # noqa: E402
from services.storage import storage  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    prefix = '[dry-run] ' if args.dry_run else ''

    with database.session() as db:
        cutoff = datetime.utcnow() - timedelta(days=1)
        stale = db.query(UploadTicket).filter(UploadTicket.created_at < cutoff).all()
        removed = 0
        for ticket in stale:
            # 票据还在说明没确认过；万一文件已经登记了（不该发生），只删票据不动对象
            if not db.query(File).execution_options(**INCLUDE_DELETED).filter_by(s3_key=ticket.s3_key).first():
                if not args.dry_run:
                    storage.delete_file(ticket.s3_key)
                removed += 1
            if not args.dry_run:
                db.delete(ticket)
        if not args.dry_run:
            db.commit()
        print(f'{prefix}stale tickets: {len(stale)}, objects removed: {removed}')

        # 长视频转码要几十分钟，一小时内的先不管
        pending = db.query(File).execution_options(**INCLUDE_DELETED).filter(
            File.media_status == 'pending',
            File.uploaded_at < datetime.utcnow() - timedelta(hours=1),
        ).all()
        received = 0
        for file in pending:
            if media.ingest_media_json(file):
                received += 1
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
        print(f'{prefix}pending media: {len(pending)}, results received: {received}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
