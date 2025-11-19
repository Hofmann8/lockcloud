"""
Add title column to ai_conversations table
Run with: python migrations/add_conversation_title.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db

def migrate():
    """Add title column to ai_conversations"""
    app = create_app()
    
    with app.app_context():
        print("Adding title column to ai_conversations...")
        
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE ai_conversations ADD COLUMN title VARCHAR(200) DEFAULT '未命名对话'"))
                conn.commit()
            print("✓ Title column added successfully")
        except Exception as e:
            if 'duplicate column name' in str(e).lower():
                print("⚠ Title column already exists")
            else:
                raise

if __name__ == '__main__':
    migrate()
