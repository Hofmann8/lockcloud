"""
Migration: Add activity_name field to files table
Run: python migrations/add_activity_name.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

import database

def migrate():
    with database.session() as db:
        # Check if column already exists
        from sqlalchemy import inspect
        inspector = inspect(db.get_bind())
        columns = [col['name'] for col in inspector.get_columns('files')]
        
        if 'activity_name' in columns:
            print('Column activity_name already exists, skipping...')
            return
        
        print('Adding activity_name column to files table...')
        
        # Add column
        db.execute(text('ALTER TABLE files ADD COLUMN activity_name VARCHAR(200)'))
        
        # Create index
        try:
            db.execute(text('CREATE INDEX idx_files_activity_name ON files(activity_name)'))
        except Exception as e:
            print(f'Index may already exist: {e}')
        
        db.commit()
        print('Migration completed successfully!')

if __name__ == '__main__':
    migrate()
