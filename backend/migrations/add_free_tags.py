"""
Migration script to add free tags tables (tags and file_tags)
Run with: python migrations/add_free_tags.py

Requirements: 7.1 - Creates tags table with many-to-many relationship to files
"""
import sys
import os
import sqlite3

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_db_path():
    """Get the database path from environment or default"""
    return os.environ.get('DATABASE_PATH', 'instance/lockcloud.db')


def table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cursor.fetchone() is not None


def index_exists(cursor, index_name):
    """Check if an index exists in the database"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,)
    )
    return cursor.fetchone() is not None


def migrate():
    """Create tags and file_tags tables"""
    db_path = get_db_path()
    
    print(f"Connecting to database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if tables already exist
        if table_exists(cursor, 'tags'):
            print("✓ tags table already exists, skipping creation")
        else:
            print("Creating tags table...")
            cursor.execute("""
                CREATE TABLE tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER NOT NULL REFERENCES users(id)
                )
            """)
            print("✓ tags table created")
        
        # Create index for tags.name if not exists
        if not index_exists(cursor, 'idx_tags_name'):
            print("Creating index idx_tags_name...")
            cursor.execute("CREATE INDEX idx_tags_name ON tags(name)")
            print("✓ idx_tags_name created")
        else:
            print("✓ idx_tags_name already exists")
        
        # Create file_tags junction table
        if table_exists(cursor, 'file_tags'):
            print("✓ file_tags table already exists, skipping creation")
        else:
            print("Creating file_tags junction table...")
            cursor.execute("""
                CREATE TABLE file_tags (
                    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (file_id, tag_id)
                )
            """)
            print("✓ file_tags table created")
        
        # Create indexes for file_tags
        if not index_exists(cursor, 'idx_file_tags_file_id'):
            print("Creating index idx_file_tags_file_id...")
            cursor.execute("CREATE INDEX idx_file_tags_file_id ON file_tags(file_id)")
            print("✓ idx_file_tags_file_id created")
        else:
            print("✓ idx_file_tags_file_id already exists")
        
        if not index_exists(cursor, 'idx_file_tags_tag_id'):
            print("Creating index idx_file_tags_tag_id...")
            cursor.execute("CREATE INDEX idx_file_tags_tag_id ON file_tags(tag_id)")
            print("✓ idx_file_tags_tag_id created")
        else:
            print("✓ idx_file_tags_tag_id already exists")
        
        # Commit changes
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
        # Verify data integrity
        print("\nVerifying data integrity...")
        cursor.execute("SELECT COUNT(*) FROM files")
        file_count = cursor.fetchone()[0]
        print(f"  - Files table: {file_count} records")
        
        cursor.execute("SELECT COUNT(*) FROM tags")
        tag_count = cursor.fetchone()[0]
        print(f"  - Tags table: {tag_count} records")
        
        cursor.execute("SELECT COUNT(*) FROM file_tags")
        file_tag_count = cursor.fetchone()[0]
        print(f"  - File_tags table: {file_tag_count} records")
        
        return True
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
