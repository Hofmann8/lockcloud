"""
File models for LockCloud
"""
from datetime import datetime
from extensions import db


class Tag(db.Model):
    """Free tag model for user-defined categorization"""
    __tablename__ = 'tags'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationship to files via junction table
    files = db.relationship('File', secondary='file_tags', back_populates='tags')
    
    def __repr__(self):
        return f'<Tag {self.name}>'
    
    def to_dict(self):
        """Convert tag to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name
        }


class FileTag(db.Model):
    """Junction table for file-tag many-to-many relationship"""
    __tablename__ = 'file_tags'
    
    file_id = db.Column(db.Integer, db.ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<FileTag file_id={self.file_id} tag_id={self.tag_id}>'


class File(db.Model):
    """File model for storing file metadata"""
    __tablename__ = 'files'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    directory = db.Column(db.String(500), nullable=False, index=True)
    s3_key = db.Column(db.String(1000), nullable=False, unique=True)
    size = db.Column(db.BigInteger, nullable=False)
    content_type = db.Column(db.String(100))
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    public_url = db.Column(db.Text)
    
    # New fields for refactored storage logic
    original_filename = db.Column(db.String(255))  # User's original filename
    activity_date = db.Column(db.Date, nullable=True, index=True)  # Activity date
    activity_type = db.Column(db.String(50), nullable=True, index=True)  # Activity type
    activity_name = db.Column(db.String(200), nullable=True, index=True)  # Activity name (e.g., "周末特训")
    instructor = db.Column(db.String(100), nullable=True, index=True)  # Instructor name
    is_legacy = db.Column(db.Boolean, default=False, nullable=False)  # Legacy naming system flag
    
    # Relationships
    logs = db.relationship('FileLog', backref='file', lazy='dynamic')
    tags = db.relationship('Tag', secondary='file_tags', back_populates='files')
    
    # Table arguments for composite indexes
    __table_args__ = (
        db.Index('idx_files_activity_date_type', 'activity_date', 'activity_type'),
        db.Index('idx_files_activity_date_name', 'activity_date', 'activity_name'),
    )
    
    def __repr__(self):
        return f'<File {self.filename}>'
    
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
            'public_url': self.public_url,
            'original_filename': self.original_filename,
            'activity_date': self.activity_date.isoformat() if self.activity_date else None,
            'activity_type': self.activity_type,
            'activity_name': self.activity_name,
            'instructor': self.instructor,
            'is_legacy': self.is_legacy
        }
        
        if include_uploader and self.uploader:
            data['uploader'] = {
                'id': self.uploader.id,
                'name': self.uploader.name,
                'email': self.uploader.email
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


class TagPreset(db.Model):
    """Tag preset model for managing predefined tags"""
    __tablename__ = 'tag_presets'
    
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False, index=True)  # 'activity_type' or 'instructor'
    value = db.Column(db.String(100), nullable=False)  # Tag value
    display_name = db.Column(db.String(100), nullable=False)  # Display name
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Active status
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Unique constraint: same category cannot have duplicate values
    __table_args__ = (
        db.UniqueConstraint('category', 'value', name='uq_category_value'),
    )
    
    def __repr__(self):
        return f'<TagPreset {self.category}:{self.value}>'
    
    def to_dict(self):
        """
        Convert tag preset to dictionary for JSON serialization
        
        Returns:
            dict: Tag preset data
        """
        return {
            'id': self.id,
            'category': self.category,
            'value': self.value,
            'display_name': self.display_name,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
