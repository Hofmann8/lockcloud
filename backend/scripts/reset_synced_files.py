"""把指定 id 范围内的 file 状态拉回 pending,等 worker 重新处理。

适用场景:
  通过 sync_files_from_latest.py 把生产 DB 同步过来时,因为走的是裸 SQL
  绕过了 SQLAlchemy ORM,face_trigger / embed_trigger 没被叫醒。后来手动
  跑 worker 写入的脸全是 person_id=0,临时归属没赶上车。

  本脚本把这批文件的 face_status / embedding_status 全清回 pending,
  顺手把已写的 faces / image_embeddings 行删干净,然后让 worker 重跑
  一次 —— 这次 insert_faces 会带上 per-face KNN 临时归属。

Usage:
  python scripts/reset_synced_files.py            # 默认 id >= 3788 全部重置
  python scripts/reset_synced_files.py --min-id 3788 --max-id 3807
  python scripts/reset_synced_files.py --dry-run
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402
from app import create_app  # noqa: E402
from extensions import db  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--min-id", type=int, default=3788)
    p.add_argument("--max-id", type=int, default=None,
                   help="不填 = 不限上界(>= min-id 全部)")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    where_files = "id >= :lo"
    where_faces = "file_id >= :lo"
    where_embed = "file_id >= :lo"
    params = {"lo": args.min_id}
    if args.max_id is not None:
        where_files += " AND id <= :hi"
        where_faces += " AND file_id <= :hi"
        where_embed += " AND file_id <= :hi"
        params["hi"] = args.max_id

    app = create_app()
    with app.app_context():
        files_n = db.session.execute(
            text(f"SELECT COUNT(*) FROM files WHERE {where_files}"), params
        ).scalar()
        faces_n = db.session.execute(
            text(f"SELECT COUNT(*) FROM faces WHERE {where_faces}"), params
        ).scalar()
        embed_n = db.session.execute(
            text(f"SELECT COUNT(*) FROM image_embeddings WHERE {where_embed}"),
            params,
        ).scalar()

        print(f"目标范围 id {args.min_id} .. "
              f"{'∞' if args.max_id is None else args.max_id}")
        print(f"  files            : {files_n} 行将拉回 pending")
        print(f"  faces            : {faces_n} 行将 DELETE(让 worker 重写)")
        print(f"  image_embeddings : {embed_n} 行将 DELETE(让 worker 重写)")

        if args.dry_run:
            print("\n--dry-run,未写入")
            return 0
        if files_n == 0:
            print("\n没有匹配的 file,啥也不做")
            return 0

        # 1) 清旧 faces / embeddings(worker 重跑会重写)
        db.session.execute(
            text(f"DELETE FROM faces WHERE {where_faces}"), params
        )
        db.session.execute(
            text(f"DELETE FROM image_embeddings WHERE {where_embed}"), params
        )
        # 2) 状态拉回 pending,trigger / 手动 worker 都会重新认领
        db.session.execute(
            text(
                f"UPDATE files SET face_status='pending', "
                f"embedding_status='pending' WHERE {where_files}"
            ),
            params,
        )
        db.session.commit()
        print(f"\n✓ 重置完成。下一步:")
        print(f"  python scripts/embed_worker.py")
        print(f"  python scripts/face_worker.py --workers 16")
        return 0


if __name__ == "__main__":
    sys.exit(main())
