"""
Migration script to add AI conversation tables
Run this script to create the necessary tables for LockAI feature
Run with: python migrations/add_ai_tables.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from ai.models import AIConversation, AIMessage

def migrate():
    """Create AI tables"""
    app = create_app()
    
    with app.app_context():
        print("Creating AI tables...")
        
        # Create tables
        db.create_all()
        
        print("✓ AI tables created successfully!")
        print("  - ai_conversations")
        print("  - ai_messages")

if __name__ == '__main__':
    migrate()
