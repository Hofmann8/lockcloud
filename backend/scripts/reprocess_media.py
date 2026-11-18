"""批量让媒体 FC 重跑（管理页的"重跑"一次最多 200 个，全量用这个）。

异步调 FC 的 /jobs/process，FC 跑完自己回调后端。默认只列出要重跑的文件，加 --apply 才真的发。

Usage:
  python scripts/reprocess_media.py --steps beats              # 看看有多少个
  python scripts/reprocess_media.py --steps beats --apply      # 节拍算法换了：所有有音轨的视频重算节拍
  python scripts/reprocess_media.py --steps sprite frames --ids 12 34 --apply
  python scripts/reprocess_media.py --large-images --apply     # 超过 20 MB 的图片补一张缩小版（OSS 图片处理不收大图）
  python scripts/reprocess_media.py --large-images --collect --apply   # FC 跑完了但回调没送到：把桶里的结果收进库
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database  # noqa: E402
from files.models import File  # noqa: E402
from routers.admin import VIDEO_STEPS  # noqa: E402
from services import fc_jobs, media  # noqa: E402
from services.storage import is_file_key  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    what = p.add_mutually_exclusive_group(required=True)
    what.add_argument('--steps', nargs='+', choices=VIDEO_STEPS, help='视频重跑这几步')
    what.add_argument('--large-images', action='store_true', help='超过 20 MB、还没有缩小版的图片整个重跑')
    p.add_argument('--ids', nargs='+', type=int, help='只跑这些文件（默认所有处理好的）')
    p.add_argument('--collect', action='store_true',
                   help='不调 FC，只把桶里 FC 写好的 media.json 收进数据库（回调没送到时用，比如回调地址还指着旧站）')
    p.add_argument('--apply', action='store_true', help='真的执行（发给 FC，或者 --collect 时写数据库）')
    args = p.parse_args()

    database.import_models()
    with database.session() as db:
        q = db.query(File).filter(File.media_status == 'ready')
        if args.ids:
            q = q.filter(File.id.in_(args.ids))
        files = [f for f in q.order_by(File.id).all() if is_file_key(f.s3_key)]
        if args.large_images:
            files = [f for f in files if media.is_image(f) and (f.size or 0) > media.OSS_IMAGE_LIMIT
                     and not media.media_info(f).get('preview')]
            body = {}
        else:
            files = [f for f in files if media.is_video(f)]
            if args.steps == ['beats']:
                files = [f for f in files if media.media_info(f).get('audio') is not False]
            body = {'steps': args.steps}

        what = '大图补缩小版' if args.large_images else '视频的 ' + ' '.join(args.steps)
        print(f'{"要收结果" if args.collect else "要重跑"}的文件: {len(files)} 个（{what}）')
        if not args.apply:
            print('（没加 --apply，只看数量）')
            return 0
        return collect(db, files) if args.collect else send(files, body)


def send(files, body) -> int:
    failed = 0
    for n, f in enumerate(files, 1):
        try:
            fc_jobs.invoke('/jobs/process', {'key': f.s3_key, **body})
        except Exception as e:  # noqa: BLE001  单个失败记下来接着发
            failed += 1
            print(f'  #{f.id} 发送失败: {e}', flush=True)
        if n % 20 == 0 or n == len(files):
            print(f'  已发 {n}/{len(files)}，失败 {failed}', flush=True)
        time.sleep(0.05)
    print('都发出去了。FC 异步处理，跑完会回调后端；FC 控制台的异步任务里能看进度。')
    return 1 if failed else 0


def collect(db, files) -> int:
    got = 0
    for n, f in enumerate(files, 1):
        data = media.read_media_json(f)
        if data is not None:
            media.apply_media_result(f, data)
            got += 1
        if n % 50 == 0 or n == len(files):
            db.commit()
            print(f'  已看 {n}/{len(files)}，收进 {got}', flush=True)
    print(f'收进 {got} 个。还没跑完的过一会儿再收一次。')
    return 0

if __name__ == '__main__':
    sys.exit(main())
