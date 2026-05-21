"""把每个 person 的 cover_face 所在 file mirror 到公开桶 covers/ 下,
   顺便把 cluster 之后不再是 cover 的 stale mirror 从公开桶删掉。

为啥要 mirror:
  - 公开桶才允许动态 URL 参数(?rect=x,y,w,h&w=200),用来从原图裁出 person 头像缩略图
  - 私有桶签名 URL 只能带预设 style,做不到任意 bbox crop
  - 完整背景见 [[decision_public_mirror_bucket]]

路径约定:
  - 正式 cover 一律 `covers/<原 s3_key>`(不散在根目录,跟 _inspect/ 等调试前缀分开)
  - 路径常量 + helper 在 S3PublicService.cover_key()
  - 前端 _person_thumb_url 走 cover_key,改 prefix 不用改前端

prune(必须做,以前漏的):
  - 反复跑 cluster 后,cover_face_id 会切到别的 file,公开桶里的旧 cover 文件成"孤儿"
  - 这里在 mirror 之前,先算 stale = mirrored - current_covers,逐个删除 + 把
    files.public_mirror_at 设回 NULL
  - 安全前提:正式 cover 都在 covers/ 前缀下,删除范围天然受限

幂等:
  - persons.cover_face_id NULL 跳过
  - files.public_mirror_at 非空 且 仍是 current cover → 跳过
  - 桶里有但 DB 标记没的,也会顺手删(防 DB/桶 漂移)

Usage:
  python scripts/mirror_cover_files.py             # prune + mirror
  python scripts/mirror_cover_files.py --dry-run   # 只打印,啥都不动
  python scripts/mirror_cover_files.py --skip-prune  # 只 mirror 不 prune(老行为)

退出码:0 成功 / 1 部分失败 / 2 启动错
"""
import argparse
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import bindparam, text  # noqa: E402

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from services.s3_public_service import S3PublicService  # noqa: E402


log = logging.getLogger("mirror_cover")


def setup_logging(verbose):
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    for noisy in ("botocore", "boto3", "urllib3", "s3transfer"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def fetch_current_covers():
    """当前所有 cover 文件 → 返 dict[file_id] = (s3_key, public_mirror_at)。"""
    rows = db.session.execute(
        text(
            "SELECT DISTINCT fi.id, fi.s3_key, fi.public_mirror_at "
            "FROM persons p "
            "JOIN faces f ON p.cover_face_id = f.face_id "
            "JOIN files fi ON f.file_id = fi.id "
            "WHERE p.cover_face_id IS NOT NULL"
        )
    ).all()
    return {int(r[0]): (r[1], r[2]) for r in rows}


def fetch_db_mirrored():
    """DB 里被标记成已 mirror 的 file → dict[file_id] = s3_key。"""
    rows = db.session.execute(
        text("SELECT id, s3_key FROM files WHERE public_mirror_at IS NOT NULL")
    ).all()
    return {int(r[0]): r[1] for r in rows}


def prune_stale_covers(current_covers, dry_run):
    """删除公开桶 covers/ 下所有"不在 current cover 集合"的对象,
       并把对应 files.public_mirror_at 设回 NULL。

    包含两条:
    1. DB 标记了 mirror 但当前不是任何 person 的 cover → file 还在 DB,清状态 + 删桶
    2. 桶里有 covers/key 但 DB 没标记 → 漂移孤儿,只删桶
    """
    s3pub = S3PublicService()
    db_mirrored = fetch_db_mirrored()                  # file_id -> s3_key
    current_s3_keys = {key for key, _ in current_covers.values()}
    current_file_ids = set(current_covers.keys())

    # ---- 第一类:DB 标 mirror 但不是当前 cover ----
    stale_files = [
        (fid, key) for fid, key in db_mirrored.items()
        if fid not in current_file_ids
    ]
    log.info("DB 里 mirror 但已经不是 cover 的: %d 个", len(stale_files))
    if dry_run:
        for fid, key in stale_files[:10]:
            log.info("  [stale-db] file=%d  covers/%s", fid, key)
        if len(stale_files) > 10:
            log.info("  ... +%d 个", len(stale_files) - 10)
    else:
        cleared = 0
        for fid, key in stale_files:
            s3pub.unmirror_cover(key)
            db.session.execute(
                text("UPDATE files SET public_mirror_at = NULL WHERE id = :id"),
                {"id": fid},
            )
            cleared += 1
            if cleared % 20 == 0:
                db.session.commit()
                log.info("  pruned %d/%d", cleared, len(stale_files))
        db.session.commit()
        log.info("第一类清除完成: %d 个", cleared)

    # ---- 第二类:桶里有但 DB 没标记的孤儿 ----
    try:
        in_bucket = set(s3pub.list_cover_keys())
    except Exception as e:
        log.warning("list_cover_keys 失败,跳过孤儿扫描: %s", e)
        return
    orphans = [k for k in in_bucket if k not in current_s3_keys
               and k not in db_mirrored.values()]
    log.info("桶里有但 DB 没标(漂移孤儿): %d 个", len(orphans))
    if dry_run:
        for k in orphans[:10]:
            log.info("  [orphan]   covers/%s", k)
        if len(orphans) > 10:
            log.info("  ... +%d 个", len(orphans) - 10)
    else:
        for k in orphans:
            s3pub.unmirror_cover(k)
        log.info("第二类清除完成: %d 个", len(orphans))


def run_in_context(dry_run=False, skip_prune=False):
    """假定已在 app_context 内,跑一遍 prune + mirror。

    给 cluster_faces.run_clustering 调用,让 cron / 手动跑聚类后自动收敛 cover mirror;
    也是 main() 的核心。返 (ok, fail) 或 (0, 0) 表示无事可做。
    """
    current_covers = fetch_current_covers()
    if not current_covers:
        log.info("当前没 cover(persons.cover_face_id 全空,先跑 cluster_faces)")
        if not skip_prune:
            prune_stale_covers({}, dry_run)
        return 0, 0

    log.info("当前 cover 涉及 %d 个 unique file", len(current_covers))

    if not skip_prune:
        prune_stale_covers(current_covers, dry_run)
    else:
        log.info("--skip-prune,不删 stale")

    pending = [(fid, key) for fid, (key, mat) in current_covers.items() if not mat]
    log.info("当前 cover 中未 mirror 的: %d 个", len(pending))

    if dry_run:
        for fid, key in pending[:10]:
            log.info("  [to-mirror] file=%d  covers/%s", fid, key)
        if len(pending) > 10:
            log.info("  ... +%d 个", len(pending) - 10)
        return 0, 0

    s3pub = S3PublicService()
    ok, fail = 0, 0
    now = datetime.now(timezone.utc).isoformat()
    for file_id, key in pending:
        try:
            s3pub.mirror_cover(key)
            db.session.execute(
                text("UPDATE files SET public_mirror_at = :ts WHERE id = :id"),
                {"ts": now, "id": file_id},
            )
            ok += 1
            if ok % 20 == 0:
                db.session.commit()
                log.info("  mirrored %d/%d", ok, len(pending))
        except Exception as e:
            log.warning("file=%d FAILED: %s", file_id, e)
            fail += 1
    db.session.commit()
    log.info("done: mirrored=%d  failed=%d", ok, fail)
    return ok, fail


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    p.add_argument("--skip-prune", action="store_true",
                   help="只 mirror,不删 stale。一般别用,留着应急。")
    args = p.parse_args()
    setup_logging(args.verbose)

    app = create_app()
    with app.app_context():
        ok, fail = run_in_context(dry_run=args.dry_run, skip_prune=args.skip_prune)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
