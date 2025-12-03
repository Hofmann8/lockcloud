"""
Migration: Add activity_name field to files table
Run: python migrations/add_activity_name.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db

def migrate():
    app = create_app()
    
    with app.app_context():
        # Check if column already exists
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('files')]
        
        if 'activity_name' in columns:
            print('Column activity_name already exists, skipping...')
            return
        
        print('Adding activity_name column to files table...')
        
        # Add column
        db.session.execute(db.text('ALTER TABLE files ADD COLUMN activity_name VARCHAR(200)'))
        
        # Create index
        try:
            db.session.execute(db.text('CREATE INDEX idx_files_activity_name ON files(activity_name)'))
        except Exception as e:
            print(f'Index may already exist: {e}')
        
        db.session.commit()
        print('Migration completed successfully!')

if __name__ == '__main__':
    migrate()
