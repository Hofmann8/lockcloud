"""
Migration: Add AI usage statistics fields to users table
Date: 2025-11-19
Description: Add fields to track per-user AI usage statistics (tokens and cost)
             This is a SAFE migration - only adds new columns, never deletes data
"""

import sqlite3
import os

def migrate():
    """Add AI usage statistics fields to users table"""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance', 'lockcloud.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return False
    
    print(f"📁 Database path: {db_path}")
    print("🔍 Checking current table structure...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"✓ Current users table columns: {', '.join(columns)}")
        
        fields_to_add = [
            ('ai_total_prompt_tokens', 'INTEGER DEFAULT 0', 'Total input tokens used'),
            ('ai_total_completion_tokens', 'INTEGER DEFAULT 0', 'Total output tokens used'),
            ('ai_total_tokens', 'INTEGER DEFAULT 0', 'Total tokens used'),
            ('ai_total_cost', 'REAL DEFAULT 0.0', 'Total cost in USD'),
            ('ai_conversation_count', 'INTEGER DEFAULT 0', 'Total number of conversations'),
        ]
        
        added_count = 0
        for field_name, field_type, description in fields_to_add:
            if field_name not in columns:
                print(f"➕ Adding {field_name} column ({description})...")
                cursor.execute(f"ALTER TABLE users ADD COLUMN {field_name} {field_type}")
                added_count += 1
                print(f"   ✓ {field_name} column added")
            else:
                print(f"   ⚠ {field_name} column already exists, skipping")
        
        conn.commit()
        
        if added_count > 0:
            print(f"\n✅ Migration completed successfully! Added {added_count} new columns.")
        else:
            print(f"\n✅ All columns already exist. No changes needed.")
        
        print("\n📊 New user AI statistics fields:")
        print("   - ai_total_prompt_tokens: Tracks input tokens")
        print("   - ai_total_completion_tokens: Tracks output tokens")
        print("   - ai_total_tokens: Tracks total tokens")
        print("   - ai_total_cost: Tracks total cost in USD")
        print("   - ai_conversation_count: Tracks number of conversations")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting User AI Statistics Migration")
    print("=" * 60)
    success = migrate()
    print("=" * 60)
    if success:
        print("✅ Migration completed successfully!")
    else:
        print("❌ Migration failed!")
    print("=" * 60)
