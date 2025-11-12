"""
Admin routes for LockCloud
Handles user management and blacklist operations
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from auth.models import User
from admin.models import EmailBlacklist
from functools import wraps


# Create blueprint
admin_bp = Blueprint('admin', __name__)


def admin_required(fn):
    """Decorator to require admin role"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or not user.is_admin:
            return jsonify({
                'error': {
                    'code': 'ADMIN_001',
                    'message': '需要管理员权限'
                }
            }), 403
        
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    """
    List all users with pagination
    
    GET /api/admin/users?page=1&per_page=50
    Headers: Authorization: Bearer <admin_token>
    
    Returns:
        200: User list retrieved successfully
        403: Not admin
        500: Query failed
    """
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Validate pagination
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 50
        
        # Query users with pagination
        pagination = User.query.order_by(User.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Convert to dict
        users = [user.to_dict() for user in pagination.items]
        
        return jsonify({
            'success': True,
            'users': users,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error listing users: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取用户列表失败'
            }
        }), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """
    Delete a user (admin only, cannot delete self)
    
    DELETE /api/admin/users/{user_id}
    Headers: Authorization: Bearer <admin_token>
    
    Returns:
        200: User deleted successfully
        400: Cannot delete self
        403: Not admin
        404: User not found
        500: Deletion failed
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Cannot delete self
        if user_id == current_user_id:
            return jsonify({
                'error': {
                    'code': 'ADMIN_002',
                    'message': '不能删除自己的账号'
                }
            }), 400
        
        # Find user
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': {
                    'code': 'USER_001',
                    'message': '用户不存在'
                }
            }), 404
        
        # Delete associated records first
        from logs.models import FileLog
        from files.models import File
        
        # Delete user's file logs
        FileLog.query.filter_by(user_id=user_id).delete()
        
        # Delete user's files
        File.query.filter_by(uploader_id=user_id).delete()
        
        # Delete user
        db.session.delete(user)
        db.session.commit()
        
        current_app.logger.info(f'Admin {current_user_id} deleted user {user_id} ({user.email})')
        
        return jsonify({
            'success': True,
            'message': '用户删除成功'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting user {user_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '删除用户失败'
            }
        }), 500


@admin_bp.route('/blacklist', methods=['GET'])
@admin_required
def list_blacklist():
    """
    List all blacklisted emails
    
    GET /api/admin/blacklist
    Headers: Authorization: Bearer <admin_token>
    
    Returns:
        200: Blacklist retrieved successfully
        403: Not admin
        500: Query failed
    """
    try:
        blacklist = EmailBlacklist.query.order_by(EmailBlacklist.blocked_at.desc()).all()
        
        return jsonify({
            'success': True,
            'blacklist': [item.to_dict() for item in blacklist]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error listing blacklist: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取黑名单失败'
            }
        }), 500


@admin_bp.route('/blacklist', methods=['POST'])
@admin_required
def add_to_blacklist():
    """
    Add email to blacklist
    
    POST /api/admin/blacklist
    Headers: Authorization: Bearer <admin_token>
    Body: {
        "email": "user@example.com",
        "reason": "违规行为"
    }
    
    Returns:
        201: Email added to blacklist
        400: Invalid input or already blacklisted
        403: Not admin
        500: Operation failed
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Validate input
        if not data or 'email' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少邮箱地址'
                }
            }), 400
        
        email = data['email'].strip().lower()
        reason = data.get('reason', '').strip()
        
        # Check if already blacklisted
        if EmailBlacklist.is_blacklisted(email):
            return jsonify({
                'error': {
                    'code': 'ADMIN_003',
                    'message': '该邮箱已在黑名单中'
                }
            }), 400
        
        # Add to blacklist
        blacklist_entry = EmailBlacklist(
            email=email,
            reason=reason,
            blocked_by=current_user_id
        )
        db.session.add(blacklist_entry)
        
        # Deactivate user if exists
        user = User.query.filter_by(email=email).first()
        if user:
            user.is_active = False
        
        db.session.commit()
        
        current_app.logger.info(f'Admin {current_user_id} blacklisted email: {email}')
        
        return jsonify({
            'success': True,
            'message': '邮箱已加入黑名单',
            'blacklist_entry': blacklist_entry.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error adding to blacklist: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '添加黑名单失败'
            }
        }), 500


@admin_bp.route('/blacklist/<int:blacklist_id>', methods=['DELETE'])
@admin_required
def remove_from_blacklist(blacklist_id):
    """
    Remove email from blacklist
    
    DELETE /api/admin/blacklist/{blacklist_id}
    Headers: Authorization: Bearer <admin_token>
    
    Returns:
        200: Email removed from blacklist
        403: Not admin
        404: Entry not found
        500: Operation failed
    """
    try:
        # Find blacklist entry
        entry = EmailBlacklist.query.get(blacklist_id)
        if not entry:
            return jsonify({
                'error': {
                    'code': 'ADMIN_004',
                    'message': '黑名单记录不存在'
                }
            }), 404
        
        email = entry.email
        
        # Remove from blacklist
        db.session.delete(entry)
        db.session.commit()
        
        current_app.logger.info(f'Removed {email} from blacklist')
        
        return jsonify({
            'success': True,
            'message': '已从黑名单移除'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error removing from blacklist: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '移除黑名单失败'
            }
        }), 500
