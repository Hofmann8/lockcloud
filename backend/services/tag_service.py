"""
自由标签：给文件打标签、搜标签。

每个方法第一个参数是数据库会话；增删方法会在这个会话上直接提交（沿用 Flask 版的行为，
调用方的其他改动会一起提交）。
"""
import logging
from typing import List, NamedTuple

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from files.models import File, FileTag, Tag

log = logging.getLogger(__name__)


class TagWithCount(NamedTuple):
    id: int
    name: str
    count: int


class TagService:

    @staticmethod
    def get_or_create_tag(db: Session, name: str, user_id: int) -> Tag:
        """按名字取标签，没有就建。名字去掉首尾空白；为空抛 ValueError。"""
        if not name:
            raise ValueError('Tag name cannot be None or empty')
        trimmed_name = name.strip()
        if not trimmed_name:
            raise ValueError('Tag name cannot be empty after trimming whitespace')

        existing_tag = db.query(Tag).filter_by(name=trimmed_name).first()
        if existing_tag:
            return existing_tag

        new_tag = Tag(name=trimmed_name, created_by=user_id)
        db.add(new_tag)
        db.commit()
        log.info(f'Created new tag: {trimmed_name} by user {user_id}')
        return new_tag

    @staticmethod
    def add_tag_to_file(db: Session, file_id: int, tag_name: str, user_id: int) -> FileTag:
        """给文件加标签，标签不存在就建。文件不存在抛 LookupError。"""
        if not file_id:
            raise ValueError('file_id cannot be None')
        if not tag_name:
            raise ValueError('tag_name cannot be None or empty')

        if not db.get(File, file_id):
            raise LookupError(f'File not found: {file_id}')

        tag = TagService.get_or_create_tag(db, tag_name, user_id)
        existing = db.query(FileTag).filter_by(file_id=file_id, tag_id=tag.id).first()
        if existing:
            return existing

        file_tag = FileTag(file_id=file_id, tag_id=tag.id)
        db.add(file_tag)
        db.commit()
        log.info(f'Added tag {tag.name} to file {file_id}')
        return file_tag

    @staticmethod
    def remove_tag_from_file(db: Session, file_id: int, tag_id: int) -> bool:
        """去掉文件上的标签，标签本身保留。文件上本来没有返回 False。"""
        if not file_id:
            raise ValueError('file_id cannot be None')
        if not tag_id:
            raise ValueError('tag_id cannot be None')

        file_tag = db.query(FileTag).filter_by(file_id=file_id, tag_id=tag_id).first()
        if not file_tag:
            return False
        db.delete(file_tag)
        db.commit()
        log.info(f'Removed tag {tag_id} from file {file_id}')
        return True

    @staticmethod
    def sync_file_tags(db: Session, file: File, raw_tags: list, user_id: int) -> bool:
        """把文件的标签换成 raw_tags（去空白、去空），会直接提交。返回有没有变化。"""
        current_names = set(t.name for t in file.tags)
        new_names = set(t.strip() for t in raw_tags if t and t.strip())
        changed = False
        for tag in list(file.tags):
            if tag.name not in new_names:
                TagService.remove_tag_from_file(db, file.id, tag.id)
                changed = True
        for name in new_names:
            if name not in current_names:
                TagService.add_tag_to_file(db, file.id, name, user_id)
                changed = True
        return changed

    @staticmethod
    def get_file_tags(db: Session, file_id: int) -> List[Tag]:
        if not file_id:
            raise ValueError('file_id cannot be None')
        file = db.get(File, file_id)
        if not file:
            raise LookupError(f'File not found: {file_id}')
        return list(file.tags)

    @staticmethod
    def search_tags(db: Session, prefix: str, limit: int = 10) -> List[TagWithCount]:
        """前缀搜索，不分大小写，用得多的在前。"""
        if prefix is None:
            raise ValueError('prefix cannot be None')
        results = db.query(
            Tag.id, Tag.name, func.count(File.id).label('count')
        ).outerjoin(
            FileTag, Tag.id == FileTag.tag_id
        ).outerjoin(
            # 回收站里的文件不算
            File, and_(File.id == FileTag.file_id, File.deleted_at.is_(None))
        ).filter(
            Tag.name.ilike(f'{prefix}%')
        ).group_by(
            Tag.id, Tag.name
        ).order_by(
            func.count(File.id).desc(), Tag.name
        ).limit(limit).all()
        return [TagWithCount(id=r.id, name=r.name, count=r.count) for r in results]

    @staticmethod
    def get_all_tags_with_count(db: Session) -> List[TagWithCount]:
        results = db.query(
            Tag.id, Tag.name, func.count(File.id).label('count')
        ).outerjoin(
            FileTag, Tag.id == FileTag.tag_id
        ).outerjoin(
            # 回收站里的文件不算
            File, and_(File.id == FileTag.file_id, File.deleted_at.is_(None))
        ).group_by(
            Tag.id, Tag.name
        ).order_by(
            func.count(File.id).desc(), Tag.name
        ).all()
        return [TagWithCount(id=r.id, name=r.name, count=r.count) for r in results]


tag_service = TagService()
