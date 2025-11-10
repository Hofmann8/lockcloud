"""
Script to list all users
"""
from app import create_app, db
from auth.models import User

def list_users():
    """List all users"""
    app = create_app()
    
    with app.app_context():
        users = User.query.all()
        
        if not users:
            print("❌ 没有找到任何用户")
            return
        
        print("\n📋 用户列表：")
        print("-" * 80)
        print(f"{'ID':<5} {'邮箱':<30} {'姓名':<15} {'管理员':<10} {'激活':<10}")
        print("-" * 80)
        
        for user in users:
            is_admin = "✅ 是" if user.is_admin else "❌ 否"
            is_active = "✅ 是" if user.is_active else "❌ 否"
            print(f"{user.id:<5} {user.email:<30} {user.name:<15} {is_admin:<10} {is_active:<10}")
        
        print("-" * 80)
        print(f"\n总共 {len(users)} 个用户\n")

if __name__ == '__main__':
    list_users()
