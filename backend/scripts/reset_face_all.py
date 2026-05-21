"""完全重置人脸数据,准备用新模型重跑 face_worker。

清掉:
  - faces 表所有行(vec0 虚表,DELETE 走 vec0 layer)
  - persons 表所有行
  - files.face_status 全部改回 'pending'
  - files.public_mirror_at 全部清空(之前 mirror 过的 cover 也无效了)

不动:
  - files 行本身
  - image_embeddings(图文 embedding 跟人脸 worker 独立)
  - 公开桶里残留的对象(用 inspect_clusters --cleanup / mirror_cover_files 单独清)

什么时候用:
  - 升级 InsightFace 模型(buffalo_l → antelopev2 等),embedding 不兼容,
    必须全量重跑;之前的 person_id / cluster 也无意义
  - 大调 face_worker 入库逻辑

Usage:
  python scripts/reset_face_all.py --dry-run     # 看会动多少行
  python scripts/reset_face_all.py               # 真删,带二次确认
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
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    app = create_app()
    with app.app_context():
        n_faces = db.session.execute(text("SELECT COUNT(*) FROM faces")).scalar()
        n_persons = db.session.execute(text("SELECT COUNT(*) FROM persons")).scalar()
        n_pending = db.session.execute(
            text("SELECT COUNT(*) FROM files WHERE face_status != 'pending'")
        ).scalar()
        n_mirrored = db.session.execute(
            text("SELECT COUNT(*) FROM files WHERE public_mirror_at IS NOT NULL")
        ).scalar()

        print(f"faces rows:                  {n_faces}")
        print(f"persons rows:                {n_persons}")
        print(f"files.face_status != pending: {n_pending}")
        print(f"files.public_mirror_at set:  {n_mirrored}")

        if args.dry_run:
            print("\n--dry-run,未删除")
            return 0

        ans = input("\n确认全部重置? [yes/N] ").strip().lower()
        if ans != "yes":
            print("取消。")
            return 0

        db.session.execute(text("DELETE FROM faces"))
        db.session.execute(text("DELETE FROM persons"))
        db.session.execute(
            text("UPDATE files SET face_status = 'pending' WHERE face_status != 'pending'")
        )
        db.session.execute(
            text("UPDATE files SET public_mirror_at = NULL WHERE public_mirror_at IS NOT NULL")
        )
        db.session.commit()
        print("重置完成。下一步:重 build FC 镜像并部署,然后跑 face_worker。")
        return 0


if __name__ == "__main__":
    sys.exit(main())
