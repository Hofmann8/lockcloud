"""
File models for LockCloud
"""
from datetime import datetime
from extensions import db


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
    instructor = db.Column(db.String(100), nullable=True, index=True)  # Instructor name
    is_legacy = db.Column(db.Boolean, default=False, nullable=False)  # Legacy naming system flag
    
    # Relationships
    logs = db.relationship('FileLog', backref='file', lazy='dynamic')
    
    # Table arguments for composite indexes
    __table_args__ = (
        db.Index('idx_files_activity_date_type', 'activity_date', 'activity_type'),
    )
    
    def __repr__(self):
        return f'<File {self.filename}>'
    
    def to_dict(self, include_uploader=False):
        """
        Convert file to dictionary for JSON serialization
        
        Args:
            include_uploader: Whether to include uploader information
            
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
            'instructor': self.instructor,
            'is_legacy': self.is_legacy
        }
        
        if include_uploader and self.uploader:
            data['uploader'] = {
                'id': self.uploader.id,
                'name': self.uploader.name,
                'email': self.uploader.email
            }
        
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
