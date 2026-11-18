"""用户：账号归 LockAuth 管，这里只存 SSO 登录时同步过来的一份。"""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = 'users'

    id = sa.Column(sa.Integer, primary_key=True)
    email = sa.Column(sa.String(255), unique=True, nullable=False, index=True)
    name = sa.Column(sa.String(100), nullable=False)
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    last_login = sa.Column(sa.DateTime)
    is_active = sa.Column(sa.Boolean, default=True, nullable=False)
    is_admin = sa.Column(sa.Boolean, default=False, nullable=False)

    files = relationship('File', backref='uploader', lazy='dynamic')
    logs = relationship('FileLog', backref='user', lazy='dynamic')

    def __repr__(self):
        return f'<User {self.email}>'

    @property
    def avatar_url(self):
        """头像公开地址。头像归 LockAuth 管，这里按邮箱问它，见 services/avatars.py"""
        from services.avatars import avatar_url
        return avatar_url(self.email)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active,
            'is_admin': self.is_admin
        }
