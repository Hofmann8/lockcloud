"""Live Photo：iPhone 的"实况照片"导出来是一张照片加一段几秒的视频（同名的 .HEIC / .MOV）。

两边都带同一个标识：照片在 Apple MakerNote 的 ContentIdentifier，视频在 QuickTime 元数据
com.apple.quicktime.content.identifier。媒体 FC 读出来放进 media.json 的 live_id，后端收结果时在这里配对：

- 同一个上传者、同一个 live_id 的一张照片和一段视频配成一对；
- 视频的 live_photo_id = 照片 id，对 ORM 查询不可见（files/models.py 的钩子），列表、搜索、人物里只出照片；
- 照片的 live_video_id = 视频 id，照片的详情里带动态部分的播放地址（routers/media.py）。

两个文件谁先处理完都行：后到的那个配对。不靠文件名（文件名可以随便改）。
动态部分跟着照片走：照片进回收站、恢复、彻底删除，它都一起。
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session, object_session

log = logging.getLogger(__name__)


def _raw(db: Session):
    from files.models import INCLUDE_DELETED, File
    return db.query(File).execution_options(**INCLUDE_DELETED)


def pair(file) -> None:
    """file 刚拿到 live_id：找另一半，配上就挂好。不 commit。"""
    from files.models import File
    from services import media

    db = object_session(file)
    if db is None or not file.live_id or file.deleted_at is not None:
        return
    db.flush()
    others = _raw(db).filter(File.live_id == file.live_id, File.id != file.id, File.deleted_at.is_(None),
                             File.uploader_id == file.uploader_id).order_by(File.id).all()
    # 同一份导出可能传了两遍：只和还没配上的另一半配
    if media.is_image(file) and not file.live_video_id:
        photo = file
        video = next((f for f in others if media.is_video(f) and not f.live_photo_id), None)
    elif media.is_video(file) and not file.live_photo_id:
        video = file
        photo = next((f for f in others if media.is_image(f) and not f.live_video_id), None)
    else:
        return
    if not photo or not video:
        return
    photo.live_video_id = video.id
    video.live_photo_id = photo.id
    # 动态部分不单独做帧检索、帧人脸（几秒的画面和照片本身一样）
    for column in ('frame_embedding_status', 'frame_face_status'):
        if getattr(video, column) == 'pending':
            setattr(video, column, 'no_frames')
    log.info(f'Live Photo paired: photo {photo.id} + video {video.id}')


def motion_of(db: Session, photo) -> Optional[object]:
    """照片的动态部分（不管在不在回收站）。没有返回 None。"""
    from files.models import File
    if not photo.live_video_id:
        return None
    video = _raw(db).filter(File.id == photo.live_video_id).first()
    return video if video is not None and video.live_photo_id == photo.id else None
