"""
缤纷云 → 阿里云 OSS 迁移。在 Lock001 上跑（和桶同在杭州，走内网不收流量费）。

每一步默认只看不做（dry-run），加 --apply 才真的执行；都可以反复跑，做过的会跳过。
新 key 由老 key 算出来（uuid5），重跑结果不变，不需要额外的对照表。

  copy        把数据库里每个文件从缤纷云复制到 lock-cloud 的 files/{uuid}{ext}。
              OSS 触发器会让媒体 FC 自动处理每个新文件。
              切换前先跑一遍把大头搬完，停服后再跑一遍补增量。
  rewrite-db  改数据库：建新列和表、s3_key 换成新 key、目录按 活动类型/年/月 重算、
              去掉 public_url / public_mirror_at、收下已经写好的 media.json。改之前会在同目录备份一份。
              头像归 LockAuth 管，这里不碰（LockCloud 显示头像时直接问 LockAuth）。
  orphans     列出缤纷云桶里有、数据库里没有的对象（只读），写到 CSV。

步骤（LockCloud 切换）：
  1. copy --db <生产库副本> --apply                 （服务照常，先搬大头）
  2. 停 LockCloud 后端，拿最新的生产库
  3. copy --db <生产库> --apply                     （补增量）
  4. rewrite-db --db <生产库> --apply
  5. 换新代码和 .env，启动

环境变量：
  OSS_*                  和后端 .env 相同（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET /
                         OSS_INTERNAL_ENDPOINT …）
  BITIFUL_ACCESS_KEY_ID / BITIFUL_SECRET_ACCESS_KEY   缤纷云的密钥（没配时读老的 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）
  BITIFUL_ENDPOINT       默认 https://s3.bitiful.net
  BITIFUL_REGION         默认 cn-east-1
  BITIFUL_BUCKET         默认 funkandlove-cloud2

Usage:
    python scripts/migrate_to_oss.py copy --db instance/lockcloud.db [--apply] [--workers 8]
    python scripts/migrate_to_oss.py rewrite-db --db instance/lockcloud.db [--apply]
    python scripts/migrate_to_oss.py orphans --db instance/lockcloud.db
"""
import argparse
import csv
import mimetypes
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from migrations.add_oss_storage import migrate as add_oss_storage  # noqa: E402
from services import media  # noqa: E402
from services.storage import FILES_PREFIX, is_file_key, storage  # noqa: E402

KEY_NAMESPACE = uuid.UUID('5b0c6a51-7c1e-4a8e-9f0e-6c6f636b636c')  # 固定值，改了新 key 就全变了


def env(name, *fallbacks, default=None):
    for n in (name, *fallbacks):
        if os.environ.get(n):
            return os.environ[n]
    return default


# ---------------------------------------------------------------- 连接

def bitiful():
    import boto3
    from botocore.config import Config
    key_id = env('BITIFUL_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID')
    secret = env('BITIFUL_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY')
    if not key_id or not secret:
        sys.exit('缺缤纷云密钥：BITIFUL_ACCESS_KEY_ID / BITIFUL_SECRET_ACCESS_KEY')
    return boto3.client(
        's3',
        endpoint_url=env('BITIFUL_ENDPOINT', default='https://s3.bitiful.net'),
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name=env('BITIFUL_REGION', default='cn-east-1'),
        config=Config(signature_version='s3v4', retries={'max_attempts': 5}, max_pool_connections=32),
    )


def open_db(path):
    if not os.path.exists(path):
        sys.exit(f'找不到数据库: {path}')
    con = sqlite3.connect(path)
    # 库里有 sqlite-vec 的虚表，改表结构时 SQLite 要能解析整个 schema
    try:
        import sqlite_vec
        con.enable_load_extension(True)
        sqlite_vec.load(con)
        con.enable_load_extension(False)
    except Exception as e:
        print(f'[warn] sqlite-vec 没加载: {e}')
    return con


def backup_db(path):
    dst = f'{path}.bak-{datetime.now():%Y%m%d%H%M%S}'
    src = sqlite3.connect(path)
    out = sqlite3.connect(dst)
    src.backup(out)
    out.close()
    src.close()
    print(f'备份: {dst}')


# ---------------------------------------------------------------- key

def new_key(old_key):
    base = old_key.rsplit('/', 1)[-1]
    ext = os.path.splitext(base)[1].lower()
    # 和 storage.is_file_key 的规则一致，否则新 key 会被当成老 key 再搬一次
    if not re.fullmatch(r'\.[a-z0-9]{1,8}', ext):
        ext = ''
    return f'{FILES_PREFIX}{uuid.uuid5(KEY_NAMESPACE, old_key).hex}{ext}'


def load_rows(con):
    cur = con.execute('SELECT id, s3_key, size, content_type FROM files ORDER BY id')
    return [SimpleNamespace(id=r[0], s3_key=r[1], size=r[2] or 0, content_type=r[3]) for r in cur]


def fmt_size(n):
    return f'{n / 1024 ** 3:.1f} GB'


# ---------------------------------------------------------------- copy

def cmd_copy(args):
    from botocore.exceptions import ClientError
    con = open_db(args.db)
    rows = [r for r in load_rows(con) if not is_file_key(r.s3_key)]
    con.close()
    total = sum(r.size for r in rows)
    print(f'要搬的文件: {len(rows)} 个，{fmt_size(total)}')
    if not args.apply:
        for r in rows[:5]:
            print(f'  {r.s3_key} → {new_key(r.s3_key)}')
        print('dry-run：加 --apply 开始复制')
        return 0

    s3 = bitiful()
    src_bucket = env('BITIFUL_BUCKET', default='funkandlove-cloud2')
    # 在指定目录下新建一个子目录，结束时只删它，不动 --tmp 指向的目录本身
    tmp_root = tempfile.mkdtemp(prefix='.migrate_tmp-', dir=args.tmp or os.getcwd())
    lock = threading.Lock()
    stats = {'copied': 0, 'skipped': 0, 'missing': 0, 'failed': 0, 'bytes': 0}
    problems = []

    def one(row):
        dst = new_key(row.s3_key)
        try:
            src_size = s3.head_object(Bucket=src_bucket, Key=row.s3_key)['ContentLength']
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code in ('404', 'NoSuchKey', 'NotFound'):
                return 'missing', row, dst, '缤纷云上没有'
            if code in ('403', 'AccessDenied'):
                # 缤纷云对不存在的对象也返回 403
                return 'missing', row, dst, '缤纷云返回 403（多半是没有这个文件）'
            raise
        if storage.head(dst) == src_size:
            return 'skipped', row, dst, ''
        fd, path = tempfile.mkstemp(dir=tmp_root)
        os.close(fd)
        try:
            s3.download_file(src_bucket, row.s3_key, path)
            ctype = row.content_type or mimetypes.guess_type(row.s3_key)[0] or 'application/octet-stream'
            storage.put_file(dst, path, ctype)
        finally:
            os.remove(path)
        got = storage.head(dst)
        if got != src_size:
            return 'failed', row, dst, f'大小不一致 {got} != {src_size}'
        return 'copied', row, dst, src_size

    pool = ThreadPoolExecutor(args.workers)
    futures = {pool.submit(one, r): r for r in rows}
    try:
        for i, fut in enumerate(as_completed(futures), 1):
            row = futures[fut]
            try:
                state, _, dst, extra = fut.result()
            except Exception as e:
                state, dst, extra = 'failed', new_key(row.s3_key), str(e)
            with lock:
                stats[state] += 1
                if state == 'copied':
                    stats['bytes'] += extra
                elif state in ('missing', 'failed'):
                    problems.append((row.id, row.s3_key, dst, extra))
            if i % 50 == 0 or i == len(futures):
                print(f'[{i}/{len(futures)}] 复制 {stats["copied"]}（{fmt_size(stats["bytes"])}）'
                      f' 已有 {stats["skipped"]} 缺失 {stats["missing"]} 失败 {stats["failed"]}', flush=True)
    except KeyboardInterrupt:
        # 不取消的话，线程池退出前会把排队的几千个文件全部跑完
        print('中断：等正在传的几个文件结束，排队的不再开始；重跑会跳过已经拷完的', flush=True)
        pool.shutdown(wait=True, cancel_futures=True)
        shutil.rmtree(tmp_root, ignore_errors=True)
        return 130
    pool.shutdown()

    shutil.rmtree(tmp_root, ignore_errors=True)
    if problems:
        out = f'migrate_problems_{datetime.now():%Y%m%d%H%M%S}.csv'
        with open(out, 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(['file_id', 'old_key', 'new_key', 'problem'])
            w.writerows(problems)
        print(f'有问题的文件写在 {out}')
    return 1 if stats['failed'] else 0


# ---------------------------------------------------------------- rewrite-db

def _drop_column(con, table, column):
    cols = [r[1] for r in con.execute(f'PRAGMA table_info({table})')]
    if column in cols:
        con.execute(f'ALTER TABLE {table} DROP COLUMN {column}')
        print(f'去掉 {table}.{column}')


def head_all(rows, workers=16):
    """并发查每个新 key 在 OSS 上的大小（不在是 None），每 200 个打一次进度。"""
    sizes, total = {}, len(rows)
    with ThreadPoolExecutor(workers) as pool:
        for i, (row, size) in enumerate(zip(rows, pool.map(lambda r: storage.head(new_key(r.s3_key)), rows)), 1):
            sizes[row.id] = size
            if i % 200 == 0 or i == total:
                print(f'  核对 OSS: {i}/{total}', flush=True)
    return sizes


def cmd_rewrite_db(args):
    con = open_db(args.db)
    rows = [r for r in load_rows(con) if not is_file_key(r.s3_key)]
    print(f'要改 key 的文件: {len(rows)} 个')

    sizes = head_all(rows)
    missing = [r for r in rows if sizes[r.id] is None]
    mismatched = [r for r in rows if sizes[r.id] is not None and r.size and sizes[r.id] != r.size]
    if mismatched:
        print(f'[注意] OSS 上有 {len(mismatched)} 个文件和数据库记的大小不一样（照常改 key，之后抽查一下）：')
        for r in mismatched[:10]:
            print(f'  #{r.id} {r.s3_key} 库里 {r.size}，OSS {sizes[r.id]}')
    if missing:
        print(f'OSS 上还缺 {len(missing)} 个文件，先跑 copy：')
        for r in missing[:10]:
            print(f'  #{r.id} {r.s3_key}')
        if not args.allow_missing:
            print('确认这些文件本来就丢了的话加 --allow-missing（它们的行保持原样，之后打不开）')
            return 1
    missing_ids = {r.id for r in missing}

    if not args.apply:
        print('dry-run：加 --apply 执行（会先备份数据库）')
        return 0

    con.close()
    backup_db(args.db)
    con = open_db(args.db)
    add_oss_storage(con)

    changed = 0
    for r in rows:
        if r.id in missing_ids:
            continue
        key = new_key(r.s3_key)
        con.execute('UPDATE files SET s3_key = ?, media_status = ? WHERE id = ?',
                    (key, media.initial_media_status(key), r.id))
        changed += 1

    # 目录 = 活动类型/年/月，只是分类。日期格式 SQLite 认不出来的行保留原目录并列出来
    con.execute(
        "UPDATE files SET directory = activity_type || '/' || strftime('%Y', activity_date) || '/' "
        "|| strftime('%m', activity_date) WHERE activity_type IS NOT NULL AND activity_type != '' "
        "AND strftime('%Y', activity_date) IS NOT NULL"
    )
    odd_dates = con.execute(
        "SELECT id, activity_date FROM files WHERE activity_type IS NOT NULL AND activity_type != '' "
        "AND activity_date IS NOT NULL AND strftime('%Y', activity_date) IS NULL").fetchall()
    for fid, d in odd_dates:
        print(f'[注意] #{fid} 的活动日期 {d!r} 解析不了，目录没重算')

    con.execute('DROP INDEX IF EXISTS idx_files_public_mirror_at')
    _drop_column(con, 'files', 'public_mirror_at')
    _drop_column(con, 'files', 'public_url')
    con.commit()

    # 媒体 FC 已经处理完的，结果收进来；没处理完的等它回调
    received = 0
    pending = con.execute(
        "SELECT id, s3_key, media_status, media_info, thumbhash, raw_w, raw_h, orientation "
        "FROM files WHERE media_status = 'pending'").fetchall()
    for row in pending:
        f = SimpleNamespace(id=row[0], s3_key=row[1], media_status=row[2], media_info=row[3],
                            thumbhash=row[4], raw_w=row[5], raw_h=row[6], orientation=row[7])
        if is_file_key(f.s3_key) and media.ingest_media_json(f):
            con.execute('UPDATE files SET media_status = ?, media_info = ?, thumbhash = ?, raw_w = ?, '
                        'raw_h = ?, orientation = ? WHERE id = ?',
                        (f.media_status, f.media_info, f.thumbhash, f.raw_w, f.raw_h, f.orientation, f.id))
            received += 1
    con.commit()

    dup = con.execute('SELECT directory, filename, COUNT(*) FROM files GROUP BY directory, filename '
                      'HAVING COUNT(*) > 1').fetchall()
    con.close()
    print(f'改了 {changed} 个 key；媒体结果收到 {received} / {len(pending)}，其余等 FC 回调')
    if dup:
        print(f'[注意] 目录重算后有 {len(dup)} 组同名文件（不影响使用，只是列表里重名）：')
        for d in dup[:10]:
            print(f'  {d[0]}/{d[1]} × {d[2]}')
    return 0


# ---------------------------------------------------------------- orphans

def cmd_orphans(args):
    con = open_db(args.db)
    known = {r.s3_key for r in load_rows(con)}
    con.close()
    s3 = bitiful()
    src_bucket = env('BITIFUL_BUCKET', default='funkandlove-cloud2')
    orphans = []
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=src_bucket):
        for obj in page.get('Contents', []):
            if obj['Key'] not in known:
                orphans.append((obj['Key'], obj['Size'], obj['LastModified'].isoformat()))
    out = f'bitiful_orphans_{datetime.now():%Y%m%d%H%M%S}.csv'
    with open(out, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['key', 'size', 'last_modified'])
        w.writerows(orphans)
    print(f'桶里有、数据库里没有: {len(orphans)} 个，{fmt_size(sum(o[1] for o in orphans))}，写在 {out}')
    return 0


def main():
    parser = argparse.ArgumentParser(description='缤纷云 → 阿里云 OSS 迁移')
    sub = parser.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('copy')
    p.add_argument('--db', required=True)
    p.add_argument('--apply', action='store_true')
    p.add_argument('--workers', type=int, default=8)
    p.add_argument('--tmp', help='下载中转目录，默认当前目录下的 .migrate_tmp')

    p = sub.add_parser('rewrite-db')
    p.add_argument('--db', required=True)
    p.add_argument('--apply', action='store_true')
    p.add_argument('--allow-missing', action='store_true')

    p = sub.add_parser('orphans')
    p.add_argument('--db', required=True)

    args = parser.parse_args()
    handler = {'copy': cmd_copy, 'rewrite-db': cmd_rewrite_db, 'orphans': cmd_orphans}
    return handler[args.cmd](args)


if __name__ == '__main__':
    sys.exit(main())
