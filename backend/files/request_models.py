"""
File modification request models for LockCloud
Handles edit/delete requests from non-owners
"""
from datetime import datetime
from extensions import db


class FileRequest(db.Model):
    """Model for file modification/deletion requests"""
    __tablename__ = 'file_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    # file_id is nullable for directory requests
    file_id = db.Column(db.Integer, db.ForeignKey('files.id', ondelete='CASCADE'), nullable=True)
    requester_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Request type: 'edit', 'delete', or 'directory_edit'
    request_type = db.Column(db.String(20), nullable=False)
    
    # Status: 'pending', 'approved', 'rejected'
    status = db.Column(db.String(20), default='pending', nullable=False)
    
    # For edit requests: JSON of proposed changes
    proposed_changes = db.Column(db.JSON, nullable=True)
    
    # For directory requests: store directory info
    directory_info = db.Column(db.JSON, nullable=True)
    # directory_info format: {
    #   "activity_date": "2025-03-15",
    #   "activity_name": "周末团建",
    #   "activity_type": "team_building"
    # }
    
    # Optional message from requester
    message = db.Column(db.Text, nullable=True)
    
    # Response message from owner
    response_message = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    file = db.relationship('File', backref=db.backref('requests', lazy='dynamic', cascade='all, delete-orphan'))
    requester = db.relationship('User', foreign_keys=[requester_id], backref='sent_requests')
    owner = db.relationship('User', foreign_keys=[owner_id], backref='received_requests')
    
    __table_args__ = (
        db.Index('idx_requests_owner_status', 'owner_id', 'status'),
        db.Index('idx_requests_requester', 'requester_id'),
    )
    
    def to_dict(self, include_file=False, include_users=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'file_id': self.file_id,
            'requester_id': self.requester_id,
            'owner_id': self.owner_id,
            'request_type': self.request_type,
            'status': self.status,
            'proposed_changes': self.proposed_changes,
            'directory_info': self.directory_info,
            'message': self.message,
            'response_message': self.response_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_file and self.file:
            data['file'] = {
                'id': self.file.id,
                'filename': self.file.filename,
                'activity_date': self.file.activity_date.isoformat() if self.file.activity_date else None,
                'activity_type': self.file.activity_type,
                'activity_name': self.file.activity_name,
            }
        
        if include_users:
            if self.requester:
                data['requester'] = {
                    'id': self.requester.id,
                    'name': self.requester.name,
                }
            if self.owner:
                data['owner'] = {
                    'id': self.owner.id,
                    'name': self.owner.name,
                }
        
        return data
