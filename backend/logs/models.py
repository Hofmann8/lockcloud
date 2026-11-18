"""操作日志。"""
import enum
from datetime import datetime

import sqlalchemy as sa

from database import Base


class OperationType(enum.Enum):
    """Enum for file operation types"""
    UPLOAD = 'upload'
    DELETE = 'delete'
    ACCESS = 'access'
    UPDATE = 'update'


class FileLog(Base):
    """File log model for audit trail"""
    __tablename__ = 'file_logs'
    
    id = sa.Column(sa.Integer, primary_key=True)
    user_id = sa.Column(sa.Integer, sa.ForeignKey('users.id'), nullable=False, index=True)
    file_id = sa.Column(sa.Integer, sa.ForeignKey('files.id'), nullable=True, index=True)
    operation = sa.Column(sa.Enum(OperationType), nullable=False, index=True)
    file_path = sa.Column(sa.String(1000))
    timestamp = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False, index=True)
    ip_address = sa.Column(sa.String(45))
    user_agent = sa.Column(sa.Text)
    
    def __repr__(self):
        return f'<FileLog {self.operation.value} by user {self.user_id}>'
    
    def to_dict(self, include_user=False, include_file=False):
        """
        Convert log to dictionary for JSON serialization
        
        Args:
            include_user: Whether to include user information
            include_file: Whether to include file information
            
        Returns:
            dict: Log data
        """
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'file_id': self.file_id,
            'operation': self.operation.value,
            'file_path': self.file_path,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'name': self.user.name,
                'email': self.user.email
            }
        
        if include_file and self.file:
            data['file'] = {
                'id': self.file.id,
                'filename': self.file.filename,
                'directory': self.file.directory
            }
        
        return data
    
    @classmethod
    def create_log(cls, user_id, operation, file_id=None, file_path=None, 
                   ip_address=None, user_agent=None):
        """
        Create a new file log entry
        
        Args:
            user_id: ID of the user performing the operation
            operation: Type of operation (OperationType enum or string)
            file_id: ID of the file (optional)
            file_path: Path of the file
            ip_address: IP address of the user
            user_agent: User agent string
            
        Returns:
            FileLog: New log entry
        """
        # Convert string to enum if necessary
        if isinstance(operation, str):
            operation = OperationType(operation)
        
        log = cls(
            user_id=user_id,
            file_id=file_id,
            operation=operation,
            file_path=file_path,
            timestamp=datetime.utcnow(),
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return log
