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
        
        # Build user dict with avatar URL
        user_data = user.to_dict()
        if user.avatar_key:
            try:
                from services.s3_public_service import s3_public_service
                user_data['avatar_url'] = s3_public_service.generate_signed_url(user.avatar_key, expiration=86400)
            except Exception as e:
                current_app.logger.warning(f'Failed to generate avatar URL: {str(e)}')
                user_data['avatar_url'] = None
        else:
            user_data['avatar_url'] = None
        
        return jsonify({
            'success': True,
            'message': '登录成功',
            'token': access_token,
            'user': user_data
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
        
        # Build user dict with avatar URL
        user_data = user.to_dict()
        if user.avatar_key:
            try:
                from services.s3_public_service import s3_public_service
                user_data['avatar_url'] = s3_public_service.generate_signed_url(user.avatar_key, expiration=86400)
            except Exception:
                user_data['avatar_url'] = None
        else:
            user_data['avatar_url'] = None
        
        return jsonify({
            'success': True,
            'message': '[开发模式] 登录成功',
            'token': access_token,
            'user': user_data
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
        
        # Build user dict with avatar URL
        user_data = user.to_dict()
        if user.avatar_key:
            try:
                from services.s3_public_service import s3_public_service
                user_data['avatar_url'] = s3_public_service.generate_signed_url(user.avatar_key, expiration=86400)
            except Exception:
                user_data['avatar_url'] = None
        else:
            user_data['avatar_url'] = None
        
        return jsonify({
            'success': True,
            'message': '令牌刷新成功',
            'token': new_token,
            'user': user_data
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
        
        # Build user dict with avatar URL
        user_data = user.to_dict()
        
        # Generate signed avatar URL if avatar exists
        if user.avatar_key:
            try:
                from services.s3_public_service import s3_public_service
                user_data['avatar_url'] = s3_public_service.generate_signed_url(user.avatar_key, expiration=86400)
            except Exception as e:
                current_app.logger.warning(f'Failed to generate avatar URL: {str(e)}')
                user_data['avatar_url'] = None
        else:
            user_data['avatar_url'] = None
        
        return jsonify({
            'success': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting current user: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取用户信息失败'
            }
        }), 500


# ============================================================
# Avatar Routes
# ============================================================

@auth_bp.route('/avatar/upload-url', methods=['POST'])
@jwt_required()
def get_avatar_upload_url():
    """
    Get presigned URL for avatar upload
    
    POST /api/auth/avatar/upload-url
    Body: { "content_type": "image/jpeg" }
    """
    from services.s3_public_service import s3_public_service
    
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        
        content_type = data.get('content_type', 'image/jpeg')
        
        result = s3_public_service.generate_avatar_upload_url(
            user_id=current_user_id,
            content_type=content_type
        )
        
        return jsonify({
            'success': True,
            'upload_url': result['upload_url'],
            'avatar_key': result['avatar_key']
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': str(e)
            }
        }), 400
    except Exception as e:
        current_app.logger.error(f'Error generating avatar upload URL: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '生成上传链接失败'
            }
        }), 500


@auth_bp.route('/avatar/confirm', methods=['POST'])
@jwt_required()
def confirm_avatar_upload():
    """
    Confirm avatar upload and update user profile
    
    POST /api/auth/avatar/confirm
    Body: { "avatar_key": "avatars/123/xxx.jpg" }
    """
    from extensions import db
    from auth.models import User
    from services.s3_public_service import s3_public_service
    
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        
        avatar_key = data.get('avatar_key')
        if not avatar_key:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': '请提供 avatar_key'
                }
            }), 400
        
        # Validate key belongs to this user
        expected_prefix = f"avatars/{current_user_id}/"
        if not avatar_key.startswith(expected_prefix):
            return jsonify({
                'error': {
                    'code': 'FORBIDDEN',
                    'message': '无权操作此头像'
                }
            }), 403
        
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户不存在'
                }
            }), 404
        
        # Delete old avatar if exists
        if user.avatar_key and user.avatar_key != avatar_key:
            try:
                s3_public_service.delete_avatar(user.avatar_key)
            except Exception as e:
                current_app.logger.warning(f'Failed to delete old avatar: {str(e)}')
        
        # Update user avatar
        user.avatar_key = avatar_key
        db.session.commit()
        
        # Generate new signed URL
        avatar_url = s3_public_service.generate_signed_url(avatar_key, expiration=86400)
        
        current_app.logger.info(f'User {current_user_id} updated avatar to {avatar_key}')
        
        return jsonify({
            'success': True,
            'message': '头像更新成功',
            'avatar_key': avatar_key,
            'avatar_url': avatar_url
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error confirming avatar upload: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '更新头像失败'
            }
        }), 500


@auth_bp.route('/avatar', methods=['DELETE'])
@jwt_required()
def delete_avatar():
    """
    Delete current user's avatar
    
    DELETE /api/auth/avatar
    """
    from extensions import db
    from auth.models import User
    from services.s3_public_service import s3_public_service
    
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
        
        if not user.avatar_key:
            return jsonify({
                'success': True,
                'message': '没有头像需要删除'
            }), 200
        
        # Delete from S3
        try:
            s3_public_service.delete_avatar(user.avatar_key)
        except Exception as e:
            current_app.logger.warning(f'Failed to delete avatar from S3: {str(e)}')
        
        # Clear avatar key
        user.avatar_key = None
        db.session.commit()
        
        current_app.logger.info(f'User {current_user_id} deleted avatar')
        
        return jsonify({
            'success': True,
            'message': '头像已删除'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting avatar: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '删除头像失败'
            }
        }), 500


# ============================================================
# SSO Internal API (供 SSO 服务调用)
# ============================================================

def verify_sso_internal_key():
    """验证 SSO 内部调用，复用 JWT_SECRET_KEY"""
    api_key = request.headers.get('X-SSO-Internal-Key')
    expected_key = current_app.config.get('JWT_SECRET_KEY')
    
    if not expected_key or not api_key:
        return False
    
    return api_key == expected_key


@auth_bp.route('/sso-internal/avatar/<int:user_id>', methods=['GET'])
def sso_get_user_avatar(user_id):
    """
    SSO 内部接口：获取用户头像签名 URL
    
    GET /api/auth/sso-internal/avatar/{user_id}?style=avatarmd
    Headers: X-SSO-Internal-Key: <configured_key>
    
    供 SSO 服务调用，其他业务统一从 SSO 获取用户头像
    """
    from auth.models import User
    from services.s3_public_service import s3_public_service
    
    if not verify_sso_internal_key():
        return jsonify({
            'error': {'code': 'UNAUTHORIZED', 'message': '无效的内部调用凭证'}
        }), 401
    
    style = request.args.get('style', 'avatarmd')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({
            'success': True,
            'avatar_url': None,
            'has_avatar': False
        }), 200
    
    if not user.avatar_key:
        return jsonify({
            'success': True,
            'avatar_url': None,
            'has_avatar': False
        }), 200
    
    try:
        signed_url = s3_public_service.generate_signed_url(
            user.avatar_key, 
            expiration=86400,
            style=style
        )
        
        return jsonify({
            'success': True,
            'avatar_url': signed_url,
            'avatar_key': user.avatar_key,
            'has_avatar': True,
            'expires_in': 86400
        }), 200
    except Exception as e:
        current_app.logger.error(f'SSO internal: Failed to get avatar for user {user_id}: {str(e)}')
        return jsonify({
            'error': {'code': 'INTERNAL_ERROR', 'message': '获取头像失败'}
        }), 500


@auth_bp.route('/sso-internal/avatars', methods=['POST'])
def sso_get_user_avatars_batch():
    """
    SSO 内部接口：批量获取用户头像
    
    POST /api/auth/sso-internal/avatars
    Headers: X-SSO-Internal-Key: <configured_key>
    Body: { "user_ids": [1, 2, 3], "style": "avatarmd" }
    
    供 SSO 服务调用
    """
    from auth.models import User
    from services.s3_public_service import s3_public_service
    
    if not verify_sso_internal_key():
        return jsonify({
            'error': {'code': 'UNAUTHORIZED', 'message': '无效的内部调用凭证'}
        }), 401
    
    data = request.get_json() or {}
    user_ids = data.get('user_ids', [])
    style = data.get('style', 'avatarmd')
    
    if not user_ids:
        return jsonify({'success': True, 'avatars': {}}), 200
    
    if len(user_ids) > 100:
        return jsonify({
            'error': {'code': 'VALIDATION_ERROR', 'message': '单次最多查询 100 个用户'}
        }), 400
    
    users = User.query.filter(User.id.in_(user_ids)).all()
    
    result = {}
    for user in users:
        if user.avatar_key:
            try:
                result[user.id] = {
                    'avatar_url': s3_public_service.generate_signed_url(
                        user.avatar_key, expiration=86400, style=style
                    ),
                    'avatar_key': user.avatar_key,
                    'has_avatar': True
                }
            except Exception as e:
                current_app.logger.warning(f'Failed to get avatar for user {user.id}: {str(e)}')
                result[user.id] = {'avatar_url': None, 'has_avatar': False}
        else:
            result[user.id] = {'avatar_url': None, 'has_avatar': False}
    
    # 对于不存在的用户也返回空
    for uid in user_ids:
        if uid not in result:
            result[uid] = {'avatar_url': None, 'has_avatar': False}
    
    return jsonify({
        'success': True,
        'avatars': result,
        'expires_in': 86400
    }), 200


@auth_bp.route('/sso-internal/avatar/by-email', methods=['GET'])
def sso_get_avatar_by_email():
    """
    SSO 内部接口：通过 email 获取头像
    
    GET /api/auth/sso-internal/avatar/by-email?email=xxx@example.com&style=avatarmd
    Headers: X-SSO-Internal-Key: <configured_key>
    """
    from auth.models import User
    from services.s3_public_service import s3_public_service
    
    if not verify_sso_internal_key():
        return jsonify({
            'error': {'code': 'UNAUTHORIZED', 'message': '无效的内部调用凭证'}
        }), 401
    
    email = request.args.get('email', '').lower().strip()
    style = request.args.get('style', 'avatarmd')
    
    if not email:
        return jsonify({
            'error': {'code': 'VALIDATION_ERROR', 'message': '缺少 email 参数'}
        }), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({
            'success': True,
            'avatar_url': None,
            'has_avatar': False,
            'user_exists': False
        }), 200
    
    if not user.avatar_key:
        return jsonify({
            'success': True,
            'avatar_url': None,
            'has_avatar': False,
            'user_exists': True,
            'user_id': user.id,
            'user_name': user.name
        }), 200
    
    try:
        signed_url = s3_public_service.generate_signed_url(
            user.avatar_key, expiration=86400, style=style
        )
        
        return jsonify({
            'success': True,
            'avatar_url': signed_url,
            'avatar_key': user.avatar_key,
            'has_avatar': True,
            'user_exists': True,
            'user_id': user.id,
            'user_name': user.name,
            'expires_in': 86400
        }), 200
    except Exception as e:
        current_app.logger.error(f'SSO internal: Failed to get avatar by email {email}: {str(e)}')
        return jsonify({
            'error': {'code': 'INTERNAL_ERROR', 'message': '获取头像失败'}
        }), 500


@auth_bp.route('/avatar/signed-url', methods=['GET'])
@jwt_required()
def get_avatar_signed_url():
    """
    Get signed URL for avatar with style
    
    GET /api/auth/avatar/signed-url?avatar_key=xxx&style=avatarmd
    """
    from services.s3_public_service import s3_public_service
    
    try:
        avatar_key = request.args.get('avatar_key')
        style = request.args.get('style', 'avatarmd')
        
        if not avatar_key:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': '请提供 avatar_key'
                }
            }), 400
        
        # Validate it's an avatar key
        if not avatar_key.startswith('avatars/'):
            return jsonify({
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': '无效的 avatar_key'
                }
            }), 400
        
        signed_url = s3_public_service.generate_signed_url(avatar_key, expiration=86400, style=style)
        
        return jsonify({
            'success': True,
            'signed_url': signed_url,
            'expires_in': 86400
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error generating avatar signed URL: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '生成签名URL失败'
            }
        }), 500



