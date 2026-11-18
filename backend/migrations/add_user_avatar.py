#!/usr/bin/env python3
"""
Migration: Add avatar_key to users table
Date: 2026-01-07
Description: Add avatar_key field for user profile pictures stored in public S3 bucket

Usage:
    python migrations/add_user_avatar.py
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text

import database
from config import settings


def run_migration():
    """Run the migration"""
    with database.session() as db:
        # Check if column already exists
        from sqlalchemy import inspect
        inspector = inspect(db.get_bind())
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'avatar_key' in columns:
            print("[SKIP] Column 'avatar_key' already exists in users table")
            return
        
        # Add the column
        print("[...] Adding 'avatar_key' column to users table")
        
        # Use raw SQL for compatibility with different databases
        db_url = settings.database_url
        
        if db_url.startswith('sqlite'):
            db.execute(text(
                "ALTER TABLE users ADD COLUMN avatar_key VARCHAR(255) DEFAULT NULL"
            ))
        else:
            # PostgreSQL / MySQL
            db.execute(text(
                "ALTER TABLE users ADD COLUMN avatar_key VARCHAR(255) DEFAULT NULL"
            ))
        
        db.commit()
        print("[OK] Migration completed successfully")


if __name__ == '__main__':
    run_migration()
