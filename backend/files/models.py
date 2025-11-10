"""
File models for LockCloud
"""
from datetime import datetime
from app import db


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
    
    # Relationships
    logs = db.relationship('FileLog', backref='file', lazy='dynamic')
    
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
            'public_url': self.public_url
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
