"""
Authentication routes for LockCloud
Implements SSO login via Funk & Love Auth Service
"""
import requests
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

# Create blueprint
auth_bp = Blueprint('auth', __name__)


# ============================================================
# SSO Login Routes (New)
# ============================================================

@auth_bp.route('/sso/login', methods=['POST'])
def sso_login():
    """
    SSO Login - Verify token from Funk & Love Auth Service and create local session
    
    POST /api/auth/sso/login
    Body: { "token": "jwt_token_from_sso" }
    """
    from extensions import db
    from auth.models import User
    
    try:
        data = request.get_json()
        
        if not data or 'token' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '请提供 SSO token'
                }
            }), 400
        
        sso_token = data['token']
        
        # Verify token with SSO Auth API
        sso_api_url = current_app.config.get('SSO_AUTH_API_URL', 'https://auth-api.funk-and.love')
        
        try:
            verify_response = requests.post(
                f'{sso_api_url}/api/auth/verify-token',
                json={'token': sso_token},
                timeout=10
            )
        except requests.RequestException as e:
            current_app.logger.error(f'SSO verification request failed: {str(e)}')
            return jsonify({
                'error': {
                    'code': 'SSO_ERROR',
                    'message': 'SSO 服务暂时不可用，请稍后重试'
                }
            }), 503
        
        if verify_response.status_code != 200:
            return jsonify({
                'error': {
                    'code': 'AUTH_INVALID_TOKEN',
                    'message': 'SSO token 无效或已过期'
                }
            }), 401
        
        sso_data = verify_response.json()
        
        if not sso_data.get('valid'):
            return jsonify({
                'error': {
                    'code': 'AUTH_INVALID_TOKEN',
                    'message': 'SSO token 验证失败'
                }
            }), 401
        
        sso_user = sso_data.get('user', {})
        email = sso_user.get('email', '').lower()
        name = sso_user.get('name', '')
        sso_user_id = sso_user.get('id')
        
        if not email:
            return jsonify({
                'error': {
                    'code': 'SSO_ERROR',
                    'message': 'SSO 返回的用户信息不完整'
                }
            }), 400
        
        # Find or create local user
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Auto-create user from SSO data
            user = User(
                email=email,
                name=name or email.split('@')[0],
                created_at=datetime.utcnow(),
                is_active=True
            )
            db.session.add(user)
            current_app.logger.info(f'New user auto-created from SSO: {email}')
        else:
            # Update name if changed in SSO
            if name and user.name != name:
                user.name = name
        
        # Check if user is active
        if not user.is_active:
            return jsonify({
                'error': {
                    'code': 'AUTH_006',
                    'message': '账号已被禁用，请联系管理员'
                }
            }), 401
        
        # Update last login time
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate local JWT token
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'name': user.name,
                'sso_user_id': sso_user_id
            }
        )
        
        current_app.logger.info(f'User logged in via SSO: {email}')
        
        return jsonify({
            'success': True,
            'message': '登录成功',
            'token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error during SSO login: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '登录失败，请稍后重试'
            }
        }), 500


@auth_bp.route('/sso/config', methods=['GET'])
def get_sso_config():
    """Get SSO configuration for frontend"""
    sso_frontend_url = current_app.config.get('SSO_AUTH_FRONTEND_URL', 'https://auth.funk-and.love')
    
    return jsonify({
        'success': True,
        'sso_login_url': sso_frontend_url,
        'sso_frontend_url': sso_frontend_url
    }), 200


# ============================================================
# Development Login (临时开发用，生产环境请关闭)
# ============================================================

@auth_bp.route('/dev/login', methods=['POST'])
def dev_login():
    """
    开发环境临时登录接口
    
    关闭方法：
    1. 在 .env 中设置 DEV_LOGIN_ENABLED=false
    2. 或者删除这个路由
    
    POST /api/auth/dev/login
    Body: { "email": "test@example.com" }
    """
    import os
    from extensions import db
    from auth.models import User
    
    # 检查是否启用开发登录
    dev_login_enabled = os.environ.get('DEV_LOGIN_ENABLED', 'false').lower() == 'true'
    
    if not dev_login_enabled:
        return jsonify({
            'error': {
                'code': 'DEV_LOGIN_DISABLED',
                'message': '开发登录已禁用，请在 .env 中设置 DEV_LOGIN_ENABLED=true'
            }
        }), 403
    
    try:
        data = request.get_json()
        email = data.get('email', 'dev@localhost.com').lower()
        name = data.get('name', email.split('@')[0])
        
        # 查找或创建用户
        user = User.query.filter_by(email=email).first()
        
        if not user:
            user = User(
                email=email,
                name=name,
                created_at=datetime.utcnow(),
                is_active=True
            )
            db.session.add(user)
            current_app.logger.warning(f'[DEV] Created dev user: {email}')
        
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # 生成 token
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'name': user.name,
                'dev_login': True
            }
        )
        
        current_app.logger.warning(f'[DEV] Dev login used: {email}')
        
        return jsonify({
            'success': True,
            'message': '[开发模式] 登录成功',
            'token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'[DEV] Dev login error: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '登录失败'
            }
        }), 500


# ============================================================
# Preserved Routes (Still needed)
# ============================================================

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required()
def refresh():
    """Refresh JWT token with extended expiration"""
    from auth.models import User
    
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户不存在'
                }
            }), 401
        
        if not user.is_active:
            return jsonify({
                'error': {
                    'code': 'AUTH_006',
                    'message': '账号已被禁用，请联系管理员'
                }
            }), 401
        
        new_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'name': user.name
            }
        )
        
        current_app.logger.info(f'Token refreshed for user: {user.email}')
        
        return jsonify({
            'success': True,
            'message': '令牌刷新成功',
            'token': new_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error refreshing token: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '令牌刷新失败，请重新登录'
            }
        }), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information from JWT token"""
    from auth.models import User
    
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户不存在'
                }
            }), 404
        
        if not user.is_active:
            return jsonify({
                'error': {
                    'code': 'AUTH_006',
                    'message': '账号已被禁用，请联系管理员'
                }
            }), 401
        
        return jsonify({
            'success': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting current user: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取用户信息失败'
            }
        }), 500



