"""
Script to set a user as admin
Usage: python set_admin.py <email>
"""
import sys
from app import create_app, db
from auth.models import User

def set_admin(email):
    """Set a user as admin by email"""
    app = create_app()
    
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"❌ 用户不存在: {email}")
            return False
        
        user.is_admin = True
        db.session.commit()
        
        print(f"✅ 用户 {email} 已设置为管理员")
        return True

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("用法: python set_admin.py <email>")
        print("示例: python set_admin.py admin@zju.edu.cn")
        sys.exit(1)
    
    email = sys.argv[1]
    success = set_admin(email)
    sys.exit(0 if success else 1)
