"""
Migration script to add is_admin column to users table
"""
from app import create_app, db
from sqlalchemy import text

def migrate():
    """Add is_admin column to users table"""
    app = create_app()
    
    with app.app_context():
        try:
            # Add is_admin column
            db.session.execute(text('ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE'))
            db.session.commit()
            print("✅ 成功添加 is_admin 字段到 users 表")
        except Exception as e:
            if 'duplicate column name' in str(e).lower() or 'already exists' in str(e).lower():
                print("ℹ️  is_admin 字段已存在，跳过")
            else:
                print(f"❌ 迁移失败: {e}")
                db.session.rollback()
                raise

if __name__ == '__main__':
    migrate()
