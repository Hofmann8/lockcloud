"""
Tag Service for LockCloud
Handles management of free tags for file categorization
"""
from typing import List, Optional, NamedTuple
from flask import current_app
from sqlalchemy import func
from extensions import db
from files.models import Tag, FileTag, File


class TagWithCount(NamedTuple):
    """Tag with usage count"""
    id: int
    name: str
    count: int


class TagService:
    """Service class for managing free tag operations"""
    
    @staticmethod
    def get_or_create_tag(name: str, user_id: int) -> Tag:
        """
        Get an existing tag by name or create a new one.
        Whitespace is trimmed from the tag name.
        
        Args:
            name: Tag name (will be trimmed)
            user_id: User ID of the creator (used only if creating new tag)
        
        Returns:
            Tag object
        
        Raises:
            ValueError: If tag name is empty after trimming
        """
        if not name:
            raise ValueError('Tag name cannot be None or empty')
        
        # Trim whitespace (Requirements 3.5)
        trimmed_name = name.strip()
        
        if not trimmed_name:
            raise ValueError('Tag name cannot be empty after trimming whitespace')
        
        # Check if tag already exists
        existing_tag = Tag.query.filter_by(name=trimmed_name).first()
        
        if existing_tag:
            current_app.logger.debug(f'Found existing tag: {trimmed_name}')
            return existing_tag
        
        # Create new tag
        new_tag = Tag(
            name=trimmed_name,
            created_by=user_id
        )
        db.session.add(new_tag)
        db.session.commit()
        
        current_app.logger.info(f'Created new tag: {trimmed_name} by user {user_id}')
        return new_tag

    
    @staticmethod
    def add_tag_to_file(file_id: int, tag_name: str, user_id: int) -> FileTag:
        """
        Add a tag to a file. Creates the tag if it doesn't exist.
        
        Args:
            file_id: ID of the file to tag
            tag_name: Name of the tag to add
            user_id: User ID performing the operation
        
        Returns:
            FileTag junction record
        
        Raises:
            ValueError: If file_id or tag_name is invalid
            LookupError: If file is not found
        """
        if not file_id:
            raise ValueError('file_id cannot be None')
        if not tag_name:
            raise ValueError('tag_name cannot be None or empty')
        
        # Verify file exists
        file = File.query.get(file_id)
        if not file:
            raise LookupError(f'File not found: {file_id}')
        
        # Get or create the tag
        tag = TagService.get_or_create_tag(tag_name, user_id)
        
        # Check if association already exists
        existing = FileTag.query.filter_by(
            file_id=file_id,
            tag_id=tag.id
        ).first()
        
        if existing:
            current_app.logger.debug(
                f'Tag {tag.name} already exists on file {file_id}'
            )
            return existing
        
        # Create new association
        file_tag = FileTag(
            file_id=file_id,
            tag_id=tag.id
        )
        db.session.add(file_tag)
        db.session.commit()
        
        current_app.logger.info(
            f'Added tag {tag.name} to file {file_id}'
        )
        return file_tag
    
    @staticmethod
    def remove_tag_from_file(file_id: int, tag_id: int) -> bool:
        """
        Remove a tag from a file.
        The tag itself is retained for future use (Requirements 7.3).
        
        Args:
            file_id: ID of the file
            tag_id: ID of the tag to remove
        
        Returns:
            True if tag was removed, False if association didn't exist
        
        Raises:
            ValueError: If file_id or tag_id is invalid
        """
        if not file_id:
            raise ValueError('file_id cannot be None')
        if not tag_id:
            raise ValueError('tag_id cannot be None')
        
        # Find the association
        file_tag = FileTag.query.filter_by(
            file_id=file_id,
            tag_id=tag_id
        ).first()
        
        if not file_tag:
            current_app.logger.debug(
                f'Tag {tag_id} not found on file {file_id}'
            )
            return False
        
        db.session.delete(file_tag)
        db.session.commit()
        
        current_app.logger.info(
            f'Removed tag {tag_id} from file {file_id}'
        )
        return True
    
    @staticmethod
    def get_file_tags(file_id: int) -> List[Tag]:
        """
        Get all tags associated with a file.
        
        Args:
            file_id: ID of the file
        
        Returns:
            List of Tag objects
        
        Raises:
            ValueError: If file_id is invalid
            LookupError: If file is not found
        """
        if not file_id:
            raise ValueError('file_id cannot be None')
        
        file = File.query.get(file_id)
        if not file:
            raise LookupError(f'File not found: {file_id}')
        
        return list(file.tags)

    
    @staticmethod
    def search_tags(prefix: str, limit: int = 10) -> List[TagWithCount]:
        """
        Search tags by prefix with usage count, ordered by usage frequency.
        
        Args:
            prefix: Search prefix (case-insensitive)
            limit: Maximum number of results to return
        
        Returns:
            List of TagWithCount objects ordered by count descending
        
        Raises:
            ValueError: If prefix is None
        """
        if prefix is None:
            raise ValueError('prefix cannot be None')
        
        # Query tags with count, filtered by prefix
        # Using LEFT JOIN to include tags with 0 files
        results = db.session.query(
            Tag.id,
            Tag.name,
            func.count(FileTag.file_id).label('count')
        ).outerjoin(
            FileTag, Tag.id == FileTag.tag_id
        ).filter(
            Tag.name.ilike(f'{prefix}%')
        ).group_by(
            Tag.id, Tag.name
        ).order_by(
            func.count(FileTag.file_id).desc(),
            Tag.name
        ).limit(limit).all()
        
        return [
            TagWithCount(id=r.id, name=r.name, count=r.count)
            for r in results
        ]
    
    @staticmethod
    def get_all_tags_with_count() -> List[TagWithCount]:
        """
        Get all tags with their usage counts, ordered by usage frequency.
        
        Returns:
            List of TagWithCount objects ordered by count descending
        """
        results = db.session.query(
            Tag.id,
            Tag.name,
            func.count(FileTag.file_id).label('count')
        ).outerjoin(
            FileTag, Tag.id == FileTag.tag_id
        ).group_by(
            Tag.id, Tag.name
        ).order_by(
            func.count(FileTag.file_id).desc(),
            Tag.name
        ).all()
        
        return [
            TagWithCount(id=r.id, name=r.name, count=r.count)
            for r in results
        ]
    
    @staticmethod
    def batch_add_tag(file_ids: List[int], tag_name: str, user_id: int) -> int:
        """
        Add a tag to multiple files.
        
        Args:
            file_ids: List of file IDs to tag
            tag_name: Name of the tag to add
            user_id: User ID performing the operation
        
        Returns:
            Number of files successfully tagged
        
        Raises:
            ValueError: If file_ids is empty or tag_name is invalid
        """
        if not file_ids:
            raise ValueError('file_ids cannot be empty')
        if not tag_name:
            raise ValueError('tag_name cannot be None or empty')
        
        # Get or create the tag
        tag = TagService.get_or_create_tag(tag_name, user_id)
        
        count = 0
        for file_id in file_ids:
            # Check if file exists
            file = File.query.get(file_id)
            if not file:
                current_app.logger.warning(f'File not found for batch tag: {file_id}')
                continue
            
            # Check if association already exists
            existing = FileTag.query.filter_by(
                file_id=file_id,
                tag_id=tag.id
            ).first()
            
            if not existing:
                file_tag = FileTag(file_id=file_id, tag_id=tag.id)
                db.session.add(file_tag)
                count += 1
        
        db.session.commit()
        current_app.logger.info(
            f'Batch added tag {tag.name} to {count} files'
        )
        return count
    
    @staticmethod
    def batch_remove_tag(file_ids: List[int], tag_id: int) -> int:
        """
        Remove a tag from multiple files.
        
        Args:
            file_ids: List of file IDs
            tag_id: ID of the tag to remove
        
        Returns:
            Number of files from which tag was removed
        
        Raises:
            ValueError: If file_ids is empty or tag_id is invalid
        """
        if not file_ids:
            raise ValueError('file_ids cannot be empty')
        if not tag_id:
            raise ValueError('tag_id cannot be None')
        
        # Delete all matching associations
        result = FileTag.query.filter(
            FileTag.file_id.in_(file_ids),
            FileTag.tag_id == tag_id
        ).delete(synchronize_session=False)
        
        db.session.commit()
        current_app.logger.info(
            f'Batch removed tag {tag_id} from {result} files'
        )
        return result


# Global tag service instance
tag_service = TagService()
