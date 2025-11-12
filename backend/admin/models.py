"""
Admin models for LockCloud
"""
from datetime import datetime
from app import db


class EmailBlacklist(db.Model):
    """Email blacklist model for blocking users"""
    __tablename__ = 'email_blacklist'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    reason = db.Column(db.String(500))
    blocked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blocked_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship
    blocker = db.relationship('User', foreign_keys=[blocked_by])
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'reason': self.reason,
            'blocked_by': self.blocked_by,
            'blocker_name': self.blocker.name if self.blocker else None,
            'blocked_at': self.blocked_at.isoformat() if self.blocked_at else None
        }
    
    @staticmethod
    def is_blacklisted(email):
        """Check if email is blacklisted"""
        return EmailBlacklist.query.filter_by(email=email.lower()).first() is not None
    
    def __repr__(self):
        return f'<EmailBlacklist {self.email}>'
