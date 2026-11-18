"""文件、标签、上传票据、评论、打包下载。

回收站：files.deleted_at 不为空的文件对 ORM 查询一律不可见（见文件末尾的 do_orm_execute 钩子），
Live Photo 的动态部分（live_photo_id 不为空的视频，挂在照片名下）也一样不可见。
要看到它们（回收站、清理、FC 回调）给查询加 execution_options(include_deleted=True)。
原生 SQL（人脸、向量表）不走这个钩子，要自己加条件，见 VISIBLE_FILES_SQL / HIDDEN_FILES_SQL。
"""
import json
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.orm import Session, relationship, with_loader_criteria

from database import Base

INCLUDE_DELETED = {'include_deleted': True}
# 原生 SQL 里过滤：... AND file_id IN (VISIBLE_FILES_SQL) 或 ... AND file_id NOT IN (HIDDEN_FILES_SQL)
VISIBLE_FILES_SQL = 'SELECT id FROM files WHERE deleted_at IS NULL AND live_photo_id IS NULL'
HIDDEN_FILES_SQL = 'SELECT id FROM files WHERE deleted_at IS NOT NULL OR live_photo_id IS NOT NULL'
TRASHED_FILES_SQL = 'SELECT id FROM files WHERE deleted_at IS NOT NULL'


class Tag(Base):
    """Free tag model for user-defined categorization"""
    __tablename__ = 'tags'
    
    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(100), nullable=False, unique=True, index=True)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow)
    created_by = sa.Column(sa.Integer, sa.ForeignKey('users.id'), nullable=False)
    
    # Relationship to files via junction table
    files = relationship('File', secondary='file_tags', back_populates='tags')
    
    def __repr__(self):
        return f'<Tag {self.name}>'
    
    def to_dict(self):
        """Convert tag to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name
        }


class FileTag(Base):
    """Junction table for file-tag many-to-many relationship"""
    __tablename__ = 'file_tags'
    
    file_id = sa.Column(sa.Integer, sa.ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    tag_id = sa.Column(sa.Integer, sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<FileTag file_id={self.file_id} tag_id={self.tag_id}>'


class File(Base):
    """File model for storing file metadata"""
    __tablename__ = 'files'
    
    id = sa.Column(sa.Integer, primary_key=True)
    filename = sa.Column(sa.String(255), nullable=False)
    directory = sa.Column(sa.String(500), nullable=False, index=True)
    s3_key = sa.Column(sa.String(1000), nullable=False, unique=True)
    size = sa.Column(sa.BigInteger, nullable=False)
    content_type = sa.Column(sa.String(100))
    uploader_id = sa.Column(sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True)
    uploaded_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # New fields for refactored storage logic
    original_filename = sa.Column(sa.String(255))  # User's original filename
    activity_date = sa.Column(sa.Date, nullable=True, index=True)  # Activity date
    activity_type = sa.Column(sa.String(50), nullable=True, index=True)  # Activity type
    activity_name = sa.Column(sa.String(200), nullable=True, index=True)  # Activity name (e.g., "周末特训")
    is_legacy = sa.Column(sa.Boolean, default=False, nullable=False)  # Legacy naming system flag
    thumbhash = sa.Column(sa.String(50), nullable=True)  # ThumbHash for blur placeholder

    # Embedding / face 入库状态机(由 add_vector_tables.py 迁移加列,worker 驱动)
    # 取值:pending / ok / failed / skipped_too_large / skipped_unsupported
    embedding_status = sa.Column(
        sa.String(32), nullable=False, default='pending', index=True
    )
    face_status = sa.Column(
        sa.String(32), nullable=False, default='pending', index=True
    )

    # 原图尺寸和 EXIF 方向(add_files_image_dims.py 加的列;人脸 bbox 用 raw 坐标,靠这三列换算)
    raw_w = sa.Column(sa.Integer, nullable=True)
    raw_h = sa.Column(sa.Integer, nullable=True)
    orientation = sa.Column(sa.Integer, nullable=False, default=1)

    # 媒体处理(add_oss_storage.py 加的列,转码 FC 回调写入)
    # media_status: pending 等 FC / ready 处理完 / failed 失败 / skipped 不是图片视频
    # media_info: FC 的结果 JSON(时长、尺寸、清晰度档位、有没有封面)
    media_status = sa.Column(sa.String(16), nullable=False, default='pending', index=True)
    media_info = sa.Column(sa.Text, nullable=True)

    # 拍摄时间：媒体 FC 读 EXIF / 视频 creation_time，ISO 8601 原样存（带时区就带，不带是拍摄地本地时间）
    taken_at = sa.Column(sa.String(40), nullable=True)

    # 回收站：软删除的时间和操作人（users.id），30 天后每日任务彻底清掉
    deleted_at = sa.Column(sa.DateTime, nullable=True, index=True)
    deleted_by = sa.Column(sa.Integer, nullable=True)

    # 2026-09 到 11 月手动校过的八拍"1"。2026-11 起八拍不再手动改（分段交给 LockAI），这几列不再读写
    beats_ones = sa.Column(sa.JSON(none_as_null=True), nullable=True)
    beats_updated_by = sa.Column(sa.Integer, nullable=True)
    beats_updated_at = sa.Column(sa.DateTime, nullable=True)

    # 视频抽帧的 embedding / 人脸进度（worker 驱动，只看视频）：pending / ok / failed / no_frames
    frame_embedding_status = sa.Column(sa.String(16), nullable=False, default='pending', server_default='pending')
    frame_face_status = sa.Column(sa.String(16), nullable=False, default='pending', server_default='pending')

    # LockAI 分析（只看视频）：NULL 没分析过 / queued / processing / ready / failed，详情在 lockai_jobs
    lockai_status = sa.Column(sa.String(16), nullable=True, index=True)

    # Live Photo（2026-11）：媒体 FC 从照片的 Apple MakerNote、视频的 QuickTime 元数据读出的同一个标识。
    # 配上对之后视频挂在照片名下（live_photo_id = 照片 id），列表里只出照片；照片的 live_video_id 指回视频
    live_id = sa.Column(sa.String(64), nullable=True, index=True)
    live_photo_id = sa.Column(sa.Integer, nullable=True, index=True)
    live_video_id = sa.Column(sa.Integer, nullable=True)

    # Relationships
    logs = relationship('FileLog', backref='file', lazy='dynamic')
    tags = relationship('Tag', secondary='file_tags', back_populates='files')
    
    # Table arguments for composite indexes
    __table_args__ = (
        sa.Index('idx_files_activity_date_type', 'activity_date', 'activity_type'),
        sa.Index('idx_files_activity_date_name', 'activity_date', 'activity_name'),
    )
    
    def __repr__(self):
        return f'<File {self.filename}>'

    def refresh_directory(self):
        """目录 = 活动类型/年/月，只是数据库里的分类，改了类型或日期就重算。桶里的路径不受影响。"""
        if self.activity_date and self.activity_type:
            self.directory = f"{self.activity_type}/{self.activity_date.year}/{self.activity_date.month:02d}"
    
    def to_dict(self, include_uploader=False, include_tags=True):
        """
        Convert file to dictionary for JSON serialization
        
        Args:
            include_uploader: Whether to include uploader information
            include_tags: Whether to include free tags
            
        Returns:
            dict: File metadata
        """
        data = {
            'id': self.id,
            'filename': self.filename,
            'directory': self.directory,
            's3_key': self.s3_key,
            'size': self.size,
            'content_type': self.content_type,
            'uploader_id': self.uploader_id,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'original_filename': self.original_filename,
            'activity_date': self.activity_date.isoformat() if self.activity_date else None,
            'activity_type': self.activity_type,
            'activity_name': self.activity_name,
            'is_legacy': self.is_legacy,
            'thumbhash': self.thumbhash,
            'media_status': self.media_status,
            'lockai_status': self.lockai_status,
            'taken_at': self.taken_at or None,
            # 视频的宽高已经是转正后的，方向永远是 1
            'orientation': 1 if (self.content_type or '').startswith('video/') else int(self.orientation or 1),
            'live': bool(self.live_video_id),
        }
        if self.media_info:
            try:
                info = json.loads(self.media_info)
                data['duration'] = info.get('duration')
                data['width'] = info.get('width')
                data['height'] = info.get('height')
                if (self.content_type or '').startswith('audio/'):
                    # 音频卡片：有封面显示封面，没有画波形
                    data['cover'] = bool(info.get('poster')) and self.media_status == 'ready'
                    data['waveform'] = info.get('waveform') or None
            except ValueError:
                pass
        
        if include_uploader and self.uploader:
            data['uploader'] = {
                'id': self.uploader.id,
                'name': self.uploader.name,
                'email': self.uploader.email,
                'avatar_url': self.uploader.avatar_url,
            }
        
        if include_tags:
            data['free_tags'] = [{'id': t.id, 'name': t.name} for t in self.tags]
        
        return data
    
    def get_size_formatted(self):
        """
        Get human-readable file size
        
        Returns:
            str: Formatted file size (e.g., "1.5 MB")
        """
        size = self.size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} PB"


class LockAIJob(Base):
    """一个视频的 LockAI 分析：谁发起的、排队到完成的状态、模型的理解结果。每个视频一行，失败后重新发起复用这一行。

    status：queued 排队 / processing 分析中 / ready 完成 / failed 失败（失败的不占发起人的额度）。
    result：{"chapters": [{"start", "end", "kind": dance|talk|other, "title", "piece"}], "notes"}，见 services/lockai.py。
    """

    __tablename__ = 'lockai_jobs'

    id = sa.Column(sa.Integer, primary_key=True)
    file_id = sa.Column(sa.Integer, sa.ForeignKey('files.id'), nullable=False, unique=True)
    requested_by = sa.Column(sa.Integer, nullable=False, index=True)
    requested_at = sa.Column(sa.DateTime, nullable=False, default=datetime.utcnow, index=True)
    status = sa.Column(sa.String(16), nullable=False, default='queued', index=True)
    attempts = sa.Column(sa.Integer, nullable=False, default=0)
    started_at = sa.Column(sa.DateTime, nullable=True)
    finished_at = sa.Column(sa.DateTime, nullable=True)
    error = sa.Column(sa.Text, nullable=True)
    model = sa.Column(sa.String(64), nullable=True)
    result = sa.Column(sa.JSON(none_as_null=True), nullable=True)
    usage = sa.Column(sa.JSON(none_as_null=True), nullable=True)


class BeatFix(Base):
    """人改过的八拍：这个视频里哪些时刻是"1"（秒）。每个视频一行。

    只存时刻、不存下标：拍点算法升级、重新分析以后，改过的地方照样套得上（services/beat_grid.py 的 apply_ones）。
    上传者和管理员直接改，别人走修改申请（request_type = beats）。
    """

    __tablename__ = 'beat_fixes'

    file_id = sa.Column(sa.Integer, sa.ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    ones = sa.Column(sa.JSON, nullable=False, default=list)
    updated_by = sa.Column(sa.Integer, nullable=True)
    updated_at = sa.Column(sa.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UploadTicket(Base):
    """签发上传地址时记一笔:确认上传时核对是不是本人、文件名用哪个。

    没确认的票据(用户中途取消、上传失败)由每日任务连同桶里的残留对象一起清掉。
    """
    __tablename__ = 'upload_tickets'

    s3_key = sa.Column(sa.String(255), primary_key=True)
    user_id = sa.Column(sa.Integer, nullable=False)
    filename = sa.Column(sa.String(255), nullable=False)
    content_type = sa.Column(sa.String(100), nullable=False)
    size = sa.Column(sa.BigInteger, nullable=False)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)


class Comment(Base):
    """文件下的评论。t 是视频里的时刻（秒），可以没有。文件进回收站时跟着隐藏，彻底删除时一起删。"""
    __tablename__ = 'comments'

    id = sa.Column(sa.Integer, primary_key=True)
    file_id = sa.Column(sa.Integer, sa.ForeignKey('files.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = sa.Column(sa.Integer, sa.ForeignKey('users.id'), nullable=False)
    body = sa.Column(sa.Text, nullable=False)
    t = sa.Column(sa.Float, nullable=True)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = sa.Column(sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship('User')


class Download(Base):
    """打包下载任务：媒体 FC 把文件打成 zip 放到 media/_downloads/{id}.zip（桶生命周期 1 天后删）。

    status: pending 等 FC / running FC 在打 / ready 可以下 / failed 失败（error 里是原因）
    """
    __tablename__ = 'downloads'

    id = sa.Column(sa.String(40), primary_key=True)
    user_id = sa.Column(sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True)
    name = sa.Column(sa.String(200), nullable=False)
    status = sa.Column(sa.String(16), nullable=False, default='pending')
    file_ids = sa.Column(sa.Text, nullable=False)  # JSON 数组
    file_count = sa.Column(sa.Integer, nullable=False, default=0)
    size = sa.Column(sa.BigInteger, nullable=False, default=0)
    zip_size = sa.Column(sa.BigInteger, nullable=True)
    error = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = sa.Column(sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    finished_at = sa.Column(sa.DateTime, nullable=True)


@event.listens_for(Session, 'do_orm_execute')
def _hide_trashed(state):
    """回收站里的文件、Live Photo 的动态部分对所有 ORM 查询不可见（列表、详情、统计、关系加载）。

    关系的懒加载不单独加：父查询上的条件会自动带过去。刷新列（refresh）不加，不然改完 deleted_at 读不回来。
    """
    if (state.is_select and not state.is_column_load and not state.is_relationship_load
            and not state.execution_options.get('include_deleted', False)):
        state.statement = state.statement.options(
            with_loader_criteria(File, sa.and_(File.deleted_at.is_(None), File.live_photo_id.is_(None)),
                                 include_aliases=True))
