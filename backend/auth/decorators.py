"""
Authentication decorators for LockCloud
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from auth.models import User


def admin_required():
    """
    Decorator to require admin privileges for a route
    Must be used after @jwt_required()
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Get current user ID from JWT
            current_user_id = int(get_jwt_identity())
            
            # Get user from database
            user = User.query.get(current_user_id)
            
            if not user:
                return jsonify({
                    'error': {
                        'code': 'AUTH_001',
                        'message': '用户不存在'
                    }
                }), 401
            
            # Check if user is admin
            if not user.is_admin:
                return jsonify({
                    'error': {
                        'code': 'FORBIDDEN',
                        'message': '需要管理员权限才能访问此资源'
                    }
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator
