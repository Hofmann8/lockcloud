"""把生产库的快照同步成本机的开发库。只在本机跑，不要在服务器上跑。

线上切到 OSS 之前，生产库还是旧结构（s3_key 是缤纷云的老路径），所以不是拷过来就能用：
快照要先转成新结构（scripts/migrate_to_oss.py 的 rewrite-db），转之前快照里的文件必须已经搬到 OSS 上
（在 Lock001 上跑 migrate_to_oss.py copy，见 DEPLOY.md 第二段）。切换之后快照本来就是新结构，这一步自动跳过。

分三步，每一步都是单独的一条命令：

  1. 只看不做：两边各有多少，同步会丢掉本机的什么
       python scripts/sync_local_db.py --snapshot D:\\lc-snapshot.db
  2. 备份本机库，把快照转成新结构，放在旁边的 lockcloud.db.sync-<时间>（本机正在用的库不动）
       python scripts/sync_local_db.py --snapshot D:\\lc-snapshot.db --apply
     转结构时会逐个查 OSS 上有没有对应的文件（只读），缺的话会停下来，提示先去跑 copy。
  3. 换上去：把第 2 步的结果写进本机正在用的库。先关掉本机后端
       python scripts/sync_local_db.py --swap instance\\lockcloud.db.sync-<时间>

备份在 instance/lockcloud.db.bak-local-<时间>，要退回去就对它做第 3 步。脚本不删任何文件，用完的中间文件自己清。
"""
import argparse
import os
import sqlite3
import sys
from datetime import datetime
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import database  # noqa: E402
from services.storage import is_file_key  # noqa: E402


def _load_vec(con):
    # 库里有 sqlite-vec 的虚表，查它们、整库检查都要先加载扩展
    import sqlite_vec
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)
    return con


def open_ro(path):
    if not os.path.exists(path):
        sys.exit(f'找不到数据库: {path}')
    return _load_vec(sqlite3.connect('file:' + os.path.abspath(path).replace('\\', '/') + '?mode=ro', uri=True))


def scalar(con, sql, default=0):
    """查一个数；表或列不存在（旧结构）时给默认值。"""
    try:
        row = con.execute(sql).fetchone()
        return row[0] if row and row[0] is not None else default
    except sqlite3.OperationalError:
        return default


def summary(con):
    keys = [r[0] for r in con.execute('SELECT s3_key FROM files')]
    return {
        '文件': len(keys),
        '最大文件 id': scalar(con, 'SELECT MAX(id) FROM files'),
        '最后上传': scalar(con, 'SELECT MAX(uploaded_at) FROM files', '-'),
        '还是老路径的文件': sum(1 for k in keys if not is_file_key(k)),
        '成员': scalar(con, 'SELECT COUNT(*) FROM users'),
        '有名字的人物': scalar(con, 'SELECT COUNT(*) FROM real_people WHERE name IS NOT NULL'),
        '人脸': scalar(con, 'SELECT COUNT(*) FROM faces'),
        '图片向量': scalar(con, 'SELECT COUNT(*) FROM image_embeddings'),
        '操作日志': scalar(con, 'SELECT COUNT(*) FROM file_logs'),
    }


def local_only(local, snap):
    """本机有、同步后会没掉的东西。都是 0 才算干净。"""
    snap_ids = {r[0] for r in snap.execute('SELECT id FROM files')}
    extra = [r for r in local.execute('SELECT id, filename FROM files ORDER BY id') if r[0] not in snap_ids]
    snap_names = {r[0] for r in snap.execute('SELECT name FROM real_people WHERE name IS NOT NULL')}
    names = [r[0] for r in local.execute('SELECT name FROM real_people WHERE name IS NOT NULL') if r[0] not in snap_names]
    return {
        '快照里没有的文件（本机传的，或线上已经删了的）': (len(extra), [f'#{i} {n}' for i, n in extra[:5]]),
        '快照里没有的人物名字': (len(names), names[:5]),
        '评论': (scalar(local, 'SELECT COUNT(*) FROM comments'), []),
        '回收站里的文件': (scalar(local, 'SELECT COUNT(*) FROM files WHERE deleted_at IS NOT NULL'), []),
        '手动校过八拍的视频': (scalar(local, 'SELECT COUNT(*) FROM files WHERE beats_ones IS NOT NULL'), []),
        '人物的附加锚点（合并记录）': (scalar(local, 'SELECT COUNT(*) FROM real_people_anchors'), []),
        '视频抽帧向量': (scalar(local, 'SELECT COUNT(*) FROM video_frame_embeddings'), []),
    }


def copy_db(src_path, dst_path):
    """用 SQLite 的备份接口拷一份（连没写回主文件的 WAL 一起带上），拷完核对文件数。"""
    if os.path.exists(dst_path):
        sys.exit(f'已经有这个文件了，不覆盖: {dst_path}')
    src = open_ro(src_path)
    dst = sqlite3.connect(dst_path)
    src.backup(dst)
    dst.close()
    out = open_ro(dst_path)
    same = scalar(src, 'SELECT COUNT(*) FROM files') == scalar(out, 'SELECT COUNT(*) FROM files')
    ok = out.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    src.close()
    out.close()
    if not (same and ok):
        sys.exit(f'拷出来的库和原来的对不上，停下: {dst_path}')


def show(title, data):
    print(title)
    for k, v in data.items():
        print(f'  {k}: {v}')


def cmd_prepare(args, local_path):
    snap = open_ro(args.snapshot)
    if snap.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        sys.exit('快照文件是坏的（quick_check 没过），重新拿一份')
    local = open_ro(local_path)
    s, cur = summary(snap), summary(local)
    show(f'快照 {args.snapshot}', s)
    show(f'本机 {local_path}', cur)
    snap_ids = {r[0] for r in snap.execute('SELECT id FROM files')}
    local_ids = {r[0] for r in local.execute('SELECT id FROM files')}
    print(f'快照比本机多 {len(snap_ids - local_ids)} 个文件')

    lost = local_only(local, snap)
    dirty = {k: v for k, v in lost.items() if v[0]}
    snap.close()
    local.close()
    if dirty:
        print('同步后本机这些会没掉：')
        for k, (n, examples) in dirty.items():
            print(f'  {k}: {n}' + (f'（{"、".join(examples)}…）' if examples else ''))
    else:
        print('本机没有快照里没有的东西，同步不会丢什么')

    if not args.apply:
        print('只看不做。加 --apply 备份本机库并准备好新库（本机正在用的库不动）')
        return 0
    if dirty and not args.discard_local:
        print('上面这些会丢。确认不要了再加 --discard-local')
        return 1

    stamp = f'{datetime.now():%Y%m%d%H%M%S}'
    backup = f'{local_path}.bak-local-{stamp}'
    copy_db(local_path, backup)
    print(f'本机库备份好了: {backup}')

    staging = f'{local_path}.sync-{stamp}'
    copy_db(args.snapshot, staging)
    if s['还是老路径的文件']:
        print('快照是旧结构，转成新结构（逐个查 OSS 上有没有对应的文件）…')
        from scripts import migrate_to_oss
        rc = migrate_to_oss.cmd_rewrite_db(SimpleNamespace(db=staging, apply=True, allow_missing=args.allow_missing))
        if rc:
            print('没转成：OSS 上还缺文件。先在 Lock001 上对这份快照跑 migrate_to_oss.py copy --apply（DEPLOY.md 第二段），'
                  '搬完再重跑这一步。')
            print(f'本机正在用的库没动。可以删的中间文件: {staging}、{backup}')
            return 1
    # 补上新版的表和列（和后端启动时做的一样）
    database.init_engine('sqlite:///' + os.path.abspath(staging).replace('\\', '/'))
    database.migrate()
    database.get_engine().dispose()

    out = open_ro(staging)
    show(f'准备好的新库 {staging}', summary(out))
    print(f'  媒体处理: {dict(out.execute("SELECT media_status, COUNT(*) FROM files GROUP BY 1").fetchall())}')
    out.close()
    print('下一步（先关掉本机后端）:')
    print(f'  python scripts/sync_local_db.py --swap "{staging}"')
    return 0


def cmd_swap(args, local_path):
    staging = args.swap
    src = open_ro(staging)
    if src.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        sys.exit(f'这个库是坏的，不换: {staging}')
    want = scalar(src, 'SELECT COUNT(*) FROM files')
    if any(not is_file_key(r[0]) for r in src.execute('SELECT s3_key FROM files')) and not args.allow_missing:
        sys.exit('这个库里还有老路径的文件，新版后端打不开它们。确认要换就加 --allow-missing')

    # 换之前旁边必须留着一份和现在内容一样的库（--apply 做的备份，或者上次换上来的那份新库），这样随时能退回去
    cur = open_ro(local_path)
    have = scalar(cur, 'SELECT COUNT(*) FROM files'), scalar(cur, 'SELECT MAX(id) FROM file_logs')
    cur.close()
    folder, base = os.path.split(os.path.abspath(local_path))
    backups = sorted(f for f in os.listdir(folder)
                     if f.startswith((base + '.bak-', base + '.sync-')) and not f.endswith(('-shm', '-wal'))
                     and os.path.abspath(os.path.join(folder, f)) != os.path.abspath(staging))
    matched = None
    for name in reversed(backups):
        b = open_ro(os.path.join(folder, name))
        same = (scalar(b, 'SELECT COUNT(*) FROM files'), scalar(b, 'SELECT MAX(id) FROM file_logs')) == have
        b.close()
        if same:
            matched = name
            break
    if not matched:
        sys.exit('旁边没有和本机库现在内容一致的备份，不换。先跑一次 --apply（它会备份）')

    dst = sqlite3.connect(local_path, timeout=3)
    try:
        dst.execute('BEGIN EXCLUSIVE')
        dst.execute('ROLLBACK')
    except sqlite3.OperationalError:
        sys.exit('本机库正被占用，先关掉本机后端再换')
    src.backup(dst)
    dst.close()
    src.close()

    done = open_ro(local_path)
    got = scalar(done, 'SELECT COUNT(*) FROM files')
    ok = done.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    show(f'本机库现在是 {local_path}', summary(done))
    done.close()
    if got != want or not ok:
        print(f'[注意] 换完核对没过（应有 {want} 个文件，实际 {got}）。用备份退回去: --swap "{os.path.join(folder, matched)}"')
        return 1
    print(f'换好了。原来的库在 {os.path.join(folder, matched)}')
    print('还没算向量、人脸的新文件要跑 embed_worker.py / face_worker.py（会调 DashScope 和人脸 FC，花钱，自己决定什么时候跑）')
    return 0


def main():
    p = argparse.ArgumentParser(description='把生产库快照同步成本机开发库（只在本机跑）')
    p.add_argument('--snapshot', help='生产库快照（服务器上 sqlite3 .backup 出来再拷到本机的文件）')
    p.add_argument('--apply', action='store_true', help='备份本机库并准备好新库；不加只看')
    p.add_argument('--swap', metavar='新库', help='把准备好的新库（或某个备份）写进本机正在用的库')
    p.add_argument('--local', help='本机库的位置，默认按 .env 的 DATABASE_URL')
    p.add_argument('--discard-local', action='store_true', help='本机有快照里没有的东西也照样同步（会丢）')
    p.add_argument('--allow-missing', action='store_true', help='OSS 上缺文件也继续（这些文件之后打不开）')
    args = p.parse_args()

    local_path = args.local or database.resolve_database_url().database
    if args.swap:
        return cmd_swap(args, local_path)
    if not args.snapshot:
        p.error('要给 --snapshot 或 --swap')
    return cmd_prepare(args, local_path)


if __name__ == '__main__':
    sys.exit(main())
