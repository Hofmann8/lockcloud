from extensions import db
from datetime import datetime


class AIConversation(db.Model):
    """AI conversation history"""
    __tablename__ = 'ai_conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), default='未命名对话')
    model = db.Column(db.String(50), nullable=False)
    total_credits = db.Column(db.Integer, default=0)  # Total credits used
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('ai_conversations', lazy='dynamic'))
    messages = db.relationship('AIMessage', backref='conversation', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'model': self.model,
            'created_at': self.created_at.isoformat(),
            'message_count': self.messages.count()
        }


class AIMessage(db.Model):
    """Individual messages in AI conversations"""
    __tablename__ = 'ai_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('ai_conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    credits = db.Column(db.Integer, default=0)  # Credits used for this message (deprecated)
    prompt_tokens = db.Column(db.Integer, default=0)  # Input tokens
    completion_tokens = db.Column(db.Integer, default=0)  # Output tokens
    total_tokens = db.Column(db.Integer, default=0)  # Total tokens
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'prompt_tokens': self.prompt_tokens,
            'completion_tokens': self.completion_tokens,
            'total_tokens': self.total_tokens,
            'created_at': self.created_at.isoformat()
        }
