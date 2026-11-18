"""把 segment_trial.py 跑出来的结果收进数据库，当成已经完成的 LockAI 分析（不用再调一遍模型）。

只新增 / 更新 lockai_jobs 行和 files.lockai_status，不动别的。已经有分析记录（排队、分析中、完成）的视频跳过。

    conda activate lockcloud
    cd backend
    python scripts/lockai_import_trial.py --user 1                # 看看会收哪些
    python scripts/lockai_import_trial.py --user 1 --apply        # 写库（先跑一次后端或这里会自动补表）
"""
import argparse
import glob
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database  # noqa: E402
from files.models import File, LockAIJob  # noqa: E402
from services.lockai import chapters_of  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--user', type=int, required=True, help='记成谁发起的（users.id）')
    p.add_argument('--dir', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                 'instance', 'segment_trial'))
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()

    database.migrate()   # 补 lockai_jobs 表和新列（只加不删，和后端启动时一样）
    with database.session() as db:
        for path in sorted(glob.glob(os.path.join(args.dir, '*.json'))):
            rec = json.load(open(path, encoding='utf-8'))
            file = db.get(File, rec['file_id'])
            chapters = chapters_of(rec.get('result'), float(rec.get('duration') or 0))
            job = db.query(LockAIJob).filter_by(file_id=rec['file_id']).first()
            if not file or not chapters:
                print(f'#{rec["file_id"]} 跳过（文件不在或没有分段）')
                continue
            if job and job.status != 'failed':
                print(f'#{file.id} 跳过（已有分析记录：{job.status}）')
                continue
            print(f'#{file.id} {rec["name"]}  {len(chapters)} 段')
            if not args.apply:
                continue
            job = job or LockAIJob(file_id=file.id)
            db.add(job)
            now = datetime.utcnow()
            job.requested_by, job.requested_at, job.status, job.attempts = args.user, now, 'ready', 1
            job.started_at = job.finished_at = now
            job.error = None
            job.model = rec.get('model')
            job.result = {'chapters': chapters, 'notes': (rec.get('result') or {}).get('notes')}
            job.usage = rec.get('usage')
            file.lockai_status = 'ready'
        if args.apply:
            db.commit()
            print('已写入')
        else:
            print('（没加 --apply，没写库）')


if __name__ == '__main__':
    main()
