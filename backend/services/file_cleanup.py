"""
删除文件：先进回收站（软删除，只写 deleted_at / deleted_by），30 天后彻底清掉。

彻底删除（purge）要一起清掉的东西：桶里的原文件和 media/{uuid}/（封面、HLS、抽帧、media.json），
以及数据库里挂在这个文件上的人脸、embedding、人物锚点、评论、标签关联。
Live Photo 的动态部分（services/live_photo.py）跟着照片：一起进回收站、一起恢复、一起彻底删除。
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.orm import Session, object_session

from services import live_photo
from services.storage import storage

log = logging.getLogger(__name__)

TRASH_DAYS = 30


def _motion(file):
    db = object_session(file)
    return live_photo.motion_of(db, file) if db is not None else None


def soft_delete(file, user_id: int) -> None:
    """进回收站。不 commit；对象、人脸、向量都不动，恢复时原样回来。"""
    now = datetime.utcnow()
    for f in filter(None, (file, _motion(file))):
        f.deleted_at = now
        f.deleted_by = user_id


def restore(file) -> None:
    """从回收站拿回来。不 commit。"""
    for f in filter(None, (file, _motion(file))):
        f.deleted_at = None
        f.deleted_by = None


def purge_at(file):
    return file.deleted_at + timedelta(days=TRASH_DAYS) if file.deleted_at else None


def purge(db: Session, file) -> None:
    """彻底删除一个文件。桶里删失败直接抛出（行还留着，下次再清）。不 commit。"""
    from files.models import BeatFix, Comment, LockAIJob
    from files.request_models import FileRequest

    motion = live_photo.motion_of(db, file)
    if motion is not None:
        purge(db, motion)
    delete_objects(file)
    delete_rows(db, file.id)
    db.query(Comment).filter(Comment.file_id == file.id).delete(synchronize_session=False)
    db.query(LockAIJob).filter(LockAIJob.file_id == file.id).delete(synchronize_session=False)
    db.query(BeatFix).filter(BeatFix.file_id == file.id).delete(synchronize_session=False)
    # 批准过的删除申请留下来（file_id 置空），申请人在"我发出的"里还能看到；其余申请随文件删掉
    db.execute(sa.update(FileRequest).where(
        FileRequest.file_id == file.id, FileRequest.request_type == 'delete', FileRequest.status == 'approved',
    ).values(file_id=None))
    db.delete(file)


def purge_expired(db: Session, days: int = TRASH_DAYS, dry_run: bool = False) -> tuple[int, int]:
    """清掉进回收站超过 days 天的文件。每个文件单独提交，一个失败不影响别的。返回 (清掉, 失败)。"""
    from files.models import INCLUDE_DELETED, File

    cutoff = datetime.utcnow() - timedelta(days=days)
    expired = db.query(File).execution_options(**INCLUDE_DELETED).filter(
        File.deleted_at.isnot(None), File.deleted_at < cutoff).order_by(File.deleted_at).all()
    purged = failed = 0
    photos = {f.id for f in expired}
    for file in expired:
        if file.live_photo_id and file.live_photo_id in photos:
            continue   # Live Photo 的动态部分随照片一起清
        if dry_run:
            purged += 1
            continue
        try:
            purge(db, file)
            db.commit()
            purged += 1
        except Exception as e:
            db.rollback()
            failed += 1
            log.error(f'Purge of file {file.id} failed: {e}')
    return purged, failed


def delete_objects(file) -> None:
    """删桶里的对象。失败直接抛出，调用方决定要不要继续删数据库。"""
    storage.delete_file(file.s3_key)


def delete_rows(db: Session, file_id: int) -> None:
    """清掉数据库里挂在这个文件上的派生数据。不 commit。

    faces / embedding 是 sqlite-vec 的 vec0 虚表，只能按主键删，所以先查出主键。
    """
    try:
        # 放在保存点里：这里出错只回滚这一段，不影响外面删文件本身
        with db.begin_nested():
            _delete_rows(db, file_id)
    except Exception as e:
        # 向量表没建（老库）或扩展没加载时不挡删除；残留的向量搜索时本来就会跳过
        log.warning(f'Cleanup of derived rows for file {file_id} failed: {e}')


def _delete_rows(db: Session, file_id: int) -> None:
    face_ids = [r[0] for r in db.execute(
        text("SELECT face_id FROM faces WHERE file_id = :fid"), {"fid": file_id}).all()]
    for face_id in face_ids:
        db.execute(text("DELETE FROM faces WHERE face_id = :id"), {"id": face_id})
    if face_ids:
        db.execute(
            text("UPDATE persons SET cover_face_id = NULL WHERE cover_face_id IN (%s)"
                 % ','.join(str(int(i)) for i in face_ids)))

    frame_ids = [r[0] for r in db.execute(
        text("SELECT frame_id FROM video_frame_embeddings WHERE file_id = :fid"), {"fid": file_id}).all()]
    for frame_id in frame_ids:
        db.execute(text("DELETE FROM video_frame_embeddings WHERE frame_id = :id"), {"id": frame_id})

    db.execute(text("DELETE FROM image_embeddings WHERE file_id = :fid"), {"fid": file_id})
    # 人物的锚点落在这个文件上的：换一张这个人别的脸当锚点（没有别的脸才置空）。
    # 只置空的话，下次重新聚类这个人的名字就链不回来了
    from services import person_anchors
    person_anchors.ensure_schema(db)
    person_anchors.forget_file(db, file_id)
