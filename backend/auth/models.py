"""
Authentication models for LockCloud
"""
import random
import bcrypt
from datetime import datetime, timedelta
from app import db


class User(db.Model):
    """User model for authenticated users"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    # AI usage statistics
    ai_total_prompt_tokens = db.Column(db.Integer, default=0, nullable=False)
    ai_total_completion_tokens = db.Column(db.Integer, default=0, nullable=False)
    ai_total_tokens = db.Column(db.Integer, default=0, nullable=False)
    ai_total_cost = db.Column(db.Float, default=0.0, nullable=False)
    ai_conversation_count = db.Column(db.Integer, default=0, nullable=False)
    
    # Relationships
    files = db.relationship('File', backref='uploader', lazy='dynamic')
    logs = db.relationship('FileLog', backref='user', lazy='dynamic')
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    @staticmethod
    def validate_zju_email(email):
        """
        Validate that email is from ZJU domain
        
        Args:
            email: Email address to validate
            
        Returns:
            bool: True if valid ZJU email, False otherwise
        """
        if not email or '@' not in email:
            return False
        return email.lower().endswith('@zju.edu.cn')
    
    def set_password(self, password):
        """
        Hash and set user password using bcrypt
        
        Args:
            password: Plain text password
        """
        # Generate salt and hash password
        salt = bcrypt.gensalt(rounds=12)
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, salt)
        self.password_hash = hashed.decode('utf-8')
    
    def check_password(self, password):
        """
        Verify password against stored hash
        
        Args:
            password: Plain text password to verify
            
        Returns:
            bool: True if password matches, False otherwise
        """
        password_bytes = password.encode('utf-8')
        hash_bytes = self.password_hash.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'ai_stats': {
                'total_prompt_tokens': self.ai_total_prompt_tokens or 0,
                'total_completion_tokens': self.ai_total_completion_tokens or 0,
                'total_tokens': self.ai_total_tokens or 0,
                'total_cost': self.ai_total_cost or 0.0,
                'conversation_count': self.ai_conversation_count or 0
            }
        }


class VerificationCode(db.Model):
    """Verification code model for email verification during registration"""
    __tablename__ = 'verification_codes'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    code = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    used = db.Column(db.Boolean, default=False, nullable=False)
    
    def __repr__(self):
        return f'<VerificationCode {self.email} - {self.code}>'
    
    @staticmethod
    def generate_code():
        """
        Generate a random 6-digit verification code
        
        Returns:
            str: 6-digit numeric code
        """
        return str(random.randint(100000, 999999))
    
    @classmethod
    def create_code(cls, email):
        """
        Create a new verification code for an email
        
        Args:
            email: Email address to send code to
            
        Returns:
            VerificationCode: New verification code instance
        """
        code = cls.generate_code()
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(minutes=10)
        
        verification_code = cls(
            email=email,
            code=code,
            created_at=created_at,
            expires_at=expires_at,
            used=False
        )
        
        return verification_code
    
    def is_expired(self):
        """
        Check if verification code has expired
        
        Returns:
            bool: True if expired, False otherwise
        """
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self):
        """
        Check if verification code is valid (not expired and not used)
        
        Returns:
            bool: True if valid, False otherwise
        """
        return not self.used and not self.is_expired()
    
    def mark_as_used(self):
        """Mark verification code as used"""
        self.used = True
