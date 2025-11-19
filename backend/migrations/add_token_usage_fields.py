"""
Migration: Add token usage fields to ai_messages table
Date: 2025-11-19
Description: Add prompt_tokens, completion_tokens, total_tokens fields to track token usage
"""

import sqlite3
import os

def migrate():
    """Add token usage fields to ai_messages table"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'lockcloud.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(ai_messages)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add prompt_tokens if not exists
        if 'prompt_tokens' not in columns:
            print("Adding prompt_tokens column...")
            cursor.execute("ALTER TABLE ai_messages ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
            print("✓ prompt_tokens column added")
        else:
            print("✓ prompt_tokens column already exists")
        
        # Add completion_tokens if not exists
        if 'completion_tokens' not in columns:
            print("Adding completion_tokens column...")
            cursor.execute("ALTER TABLE ai_messages ADD COLUMN completion_tokens INTEGER DEFAULT 0")
            print("✓ completion_tokens column added")
        else:
            print("✓ completion_tokens column already exists")
        
        # Add total_tokens if not exists
        if 'total_tokens' not in columns:
            print("Adding total_tokens column...")
            cursor.execute("ALTER TABLE ai_messages ADD COLUMN total_tokens INTEGER DEFAULT 0")
            print("✓ total_tokens column added")
        else:
            print("✓ total_tokens column already exists")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        return False
        
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
