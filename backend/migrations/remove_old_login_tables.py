"""
Migration script to remove old login-related tables and columns
Now using SSO authentication via Funk & Love Auth Service

Run with: python migrations/remove_old_login_tables.py

This migration removes:
- verification_codes table (email verification codes for registration)
- email_blacklist table (user blocking now handled by SSO)
- password_hash column from users table (passwords no longer used with SSO)
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db
from sqlalchemy import text


def migrate():
    """Remove old login-related tables and columns"""
    app = create_app()
    
    with app.app_context():
        print("=" * 50)
        print("Migration: Remove old login tables")
        print("=" * 50)
        
        # 1. Drop verification_codes table
        print("\n[1/3] Dropping verification_codes table...")
        try:
            db.session.execute(text("DROP TABLE IF EXISTS verification_codes"))
            db.session.commit()
            print("✓ verification_codes table dropped")
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error dropping verification_codes table: {e}")
        
        # 2. Drop email_blacklist table
        print("\n[2/3] Dropping email_blacklist table...")
        try:
            db.session.execute(text("DROP TABLE IF EXISTS email_blacklist"))
            db.session.commit()
            print("✓ email_blacklist table dropped")
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error dropping email_blacklist table: {e}")
        
        # 3. Remove password_hash column from users table
        print("\n[3/3] Removing password_hash column from users table...")
        try:
            # SQLite doesn't support DROP COLUMN directly (before 3.35.0)
            # Check if column exists using PRAGMA
            result = db.session.execute(text("PRAGMA table_info(users)"))
            columns = result.fetchall()
            column_exists = any(col[1] == 'password_hash' for col in columns)
            
            if column_exists:
                # SQLite 3.35.0+ supports DROP COLUMN
                db.session.execute(text("ALTER TABLE users DROP COLUMN password_hash"))
                db.session.commit()
                print("✓ password_hash column removed from users table")
            else:
                print("✓ password_hash column already removed")
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error removing password_hash column: {e}")
            print("  Note: If using SQLite < 3.35.0, you may need to recreate the table manually")
        
        print("\n" + "=" * 50)
        print("Migration completed!")
        print("=" * 50)


if __name__ == '__main__':
    migrate()
