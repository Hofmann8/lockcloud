"""
Safe migration script to add AI conversation tables
This script ONLY creates new tables, does NOT modify or delete existing data
Run with: python migrations/add_ai_tables_safe.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db

def migrate():
    """Safely create AI tables without touching existing data"""
    app = create_app()
    
    with app.app_context():
        print("Checking existing tables...")
        
        # Check if AI tables already exist
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        print(f"Existing tables: {existing_tables}")
        
        if 'ai_conversations' in existing_tables:
            print("⚠ ai_conversations table already exists, skipping...")
        else:
            print("Creating ai_conversations table...")
            with db.engine.connect() as conn:
                conn.execute(db.text("""
                    CREATE TABLE ai_conversations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        model VARCHAR(50) NOT NULL,
                        total_credits INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                conn.commit()
            print("✓ ai_conversations table created")
        
        if 'ai_messages' in existing_tables:
            print("⚠ ai_messages table already exists, skipping...")
        else:
            print("Creating ai_messages table...")
            with db.engine.connect() as conn:
                conn.execute(db.text("""
                    CREATE TABLE ai_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        conversation_id INTEGER NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        content TEXT NOT NULL,
                        credits INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
                    )
                """))
                conn.commit()
            print("✓ ai_messages table created")
        
        # Create indexes
        print("Creating indexes...")
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id)"))
                conn.execute(db.text("CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at)"))
                conn.execute(db.text("CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id)"))
                conn.execute(db.text("CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at)"))
                conn.commit()
            print("✓ Indexes created")
        except Exception as e:
            print(f"Note: Some indexes may already exist: {e}")
        
        print("\n✓ Migration completed successfully!")
        print("  - Existing data preserved")
        print("  - AI tables ready")

if __name__ == '__main__':
    migrate()
