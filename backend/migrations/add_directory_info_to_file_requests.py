"""
Migration script to add directory_info column to file_requests table
and make file_id nullable for directory edit requests.

Run with: python migrations/add_directory_info_to_file_requests.py
"""
import sys
import os
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_db_path():
    """Get the database path from environment or default"""
    return os.environ.get('DATABASE_PATH', 'instance/lockcloud.db')


def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cursor.fetchone() is not None


def migrate():
    """Add directory_info column and make file_id nullable"""
    db_path = get_db_path()
    
    print(f"Connecting to database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if file_requests table exists
        if not table_exists(cursor, 'file_requests'):
            print("Error: file_requests table does not exist")
            return False
        
        # Check if directory_info column already exists
        if column_exists(cursor, 'file_requests', 'directory_info'):
            print("✓ directory_info column already exists, skipping")
        else:
            print("Adding directory_info column...")
            cursor.execute("""
                ALTER TABLE file_requests ADD COLUMN directory_info JSON
            """)
            print("✓ directory_info column added")
        
        # SQLite doesn't support ALTER COLUMN to change nullability
        # We need to recreate the table to make file_id nullable
        # First check current schema
        cursor.execute("PRAGMA table_info(file_requests)")
        columns_info = cursor.fetchall()
        
        # Find file_id column info
        file_id_info = None
        for col in columns_info:
            if col[1] == 'file_id':
                file_id_info = col
                break
        
        if file_id_info and file_id_info[3] == 1:  # notnull = 1 means NOT NULL
            print("Recreating table to make file_id nullable...")
            
            # Create new table with nullable file_id
            cursor.execute("""
                CREATE TABLE file_requests_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
                    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    request_type VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    proposed_changes JSON,
                    directory_info JSON,
                    message TEXT,
                    response_message TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Copy data from old table
            cursor.execute("""
                INSERT INTO file_requests_new 
                    (id, file_id, requester_id, owner_id, request_type, status, 
                     proposed_changes, directory_info, message, response_message, 
                     created_at, updated_at)
                SELECT 
                    id, file_id, requester_id, owner_id, request_type, status,
                    proposed_changes, directory_info, message, response_message,
                    created_at, updated_at
                FROM file_requests
            """)
            
            # Drop old table
            cursor.execute("DROP TABLE file_requests")
            
            # Rename new table
            cursor.execute("ALTER TABLE file_requests_new RENAME TO file_requests")
            
            # Recreate indexes
            cursor.execute("CREATE INDEX idx_requests_owner_status ON file_requests(owner_id, status)")
            cursor.execute("CREATE INDEX idx_requests_requester ON file_requests(requester_id)")
            
            print("✓ Table recreated with nullable file_id")
        else:
            print("✓ file_id is already nullable or table structure is correct")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
        # Verify
        print("\nVerifying migration...")
        cursor.execute("PRAGMA table_info(file_requests)")
        columns = cursor.fetchall()
        print("Current columns:")
        for col in columns:
            nullable = "NULL" if col[3] == 0 else "NOT NULL"
            print(f"  - {col[1]}: {col[2]} {nullable}")
        
        cursor.execute("SELECT COUNT(*) FROM file_requests")
        count = cursor.fetchone()[0]
        print(f"\nfile_requests table: {count} records")
        
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
