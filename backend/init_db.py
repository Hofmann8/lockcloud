"""
Initialize database tables for LockCloud
Run this script to create all database tables
"""
from app import create_app, db

def init_database():
    """Create all database tables"""
    app = create_app()
    
    with app.app_context():
        # Import all models to ensure they're registered
        from auth.models import User, VerificationCode
        from files.models import File
        from logs.models import FileLog
        
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        print("✓ Database tables created successfully!")
        
        # Print table names
        print("\nCreated tables:")
        print("- users")
        print("- verification_codes")
        print("- files")
        print("- file_logs")
        
        print("\nDatabase initialization complete!")

if __name__ == '__main__':
    init_database()
