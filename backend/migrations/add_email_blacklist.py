"""
Migration script to add email_blacklist table
Run with: python migrations/add_email_blacklist.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from admin.models import EmailBlacklist

def migrate():
    """Create email_blacklist table"""
    app = create_app()
    
    with app.app_context():
        print("Creating email_blacklist table...")
        db.create_all()
        print("✓ email_blacklist table created successfully")

if __name__ == '__main__':
    migrate()
