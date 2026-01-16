"""
Authentication models for LockCloud
SSO-based authentication - users are managed via Funk & Love Auth Service
"""
from datetime import datetime
from extensions import db


class User(db.Model):
    """User model for authenticated users (synced from SSO)"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    avatar_key = db.Column(db.String(255), nullable=True)  # S3 key for avatar
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    # Relationships
    files = db.relationship('File', backref='uploader', lazy='dynamic')
    logs = db.relationship('FileLog', backref='user', lazy='dynamic')
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    @property
    def avatar_url(self):
        """Get avatar URL (signed URL for private bucket)"""
        if not self.avatar_key:
            return None
        # Return the key, frontend will request signed URL
        return self.avatar_key
    
    def to_dict(self):
        """
        Convert user to dictionary for JSON serialization
        
        Returns:
            dict: User data without sensitive information
        """
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'avatar_key': self.avatar_key,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active,
            'is_admin': self.is_admin
        }
