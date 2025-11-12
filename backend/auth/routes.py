"""
Authentication routes for LockCloud
Implements user registration, login, token refresh, and user info endpoints
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from app import db, limiter
from auth.models import User
from auth.email_service import send_verification_code, validate_verification_code


# Create blueprint
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/send-code', methods=['POST'])
@limiter.limit("10 per minute")
def send_code():
    """
    Send verification code to email address
    
    POST /api/auth/send-code
    Body: { "email": "user@zju.edu.cn" }
    
    Returns:
        200: Verification code sent successfully
        400: Invalid email or rate limit exceeded
        500: Email sending failed
    """
    try:
        # Get request data
        data = request.get_json()
        
        if not data or 'email' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '请提供邮箱地址'
                }
            }), 400
        
        email = data['email'].strip().lower()
        
        # Validate ZJU email domain
        if not User.validate_zju_email(email):
            return jsonify({
                'error': {
                    'code': 'AUTH_002',
                    'message': '邮箱必须是浙江大学邮箱 (@zju.edu.cn)'
                }
            }), 400
        
        # Send verification code
        result = send_verification_code(email)
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'expires_in': result['expires_in']
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': str(e)
            }
        }), 400
    except Exception as e:
        current_app.logger.error(f'Error sending verification code: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '发送验证码失败，请稍后重试'
            }
        }), 500


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("10 per minute")
def register():
    """
    Register a new user with email verification
    
    POST /api/auth/register
    Body: {
        "email": "user@zju.edu.cn",
        "password": "password123",
        "name": "User Name",
        "code": "123456"
    }
    
    Returns:
        201: User registered successfully
        400: Invalid input or verification code
        409: User already exists
        500: Registration failed
    """
    try:
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'name', 'code']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        email = data['email'].strip().lower()
        
        # Check if email is blacklisted
        from admin.models import EmailBlacklist
        if EmailBlacklist.is_blacklisted(email):
            return jsonify({
                'error': {
                    'code': 'AUTH_007',
                    'message': '该邮箱已被禁止注册'
                }
            }), 403
        password = data['password']
        name = data['name'].strip()
        code = data['code'].strip()
        
        # Validate email domain
        if not User.validate_zju_email(email):
            return jsonify({
                'error': {
                    'code': 'AUTH_002',
                    'message': '邮箱必须是浙江大学邮箱 (@zju.edu.cn)'
                }
            }), 400
        
        # Validate password length
        if len(password) < 6:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '密码长度至少为6位'
                }
            }), 400
        
        # Validate name
        if len(name) < 2:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '花名长度至少为2位'
                }
            }), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                'error': {
                    'code': 'AUTH_005',
                    'message': '该邮箱已被注册'
                }
            }), 409
        
        # Validate verification code
        try:
            validate_verification_code(email, code)
        except ValueError as e:
            return jsonify({
                'error': {
                    'code': 'AUTH_003',
                    'message': str(e)
                }
            }), 400
        
        # Create new user
        user = User(
            email=email,
            name=name,
            created_at=datetime.utcnow()
        )
        user.set_password(password)
        
        # Save to database
        db.session.add(user)
        db.session.commit()
        
        current_app.logger.info(f'New user registered: {email}')
        
        return jsonify({
            'success': True,
            'message': '注册成功',
            'user': user.to_dict()
        }), 201
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': str(e)
            }
        }), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error during registration: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '注册失败，请稍后重试'
            }
        }), 500


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Login user and generate JWT token
    
    POST /api/auth/login
    Body: {
        "email": "user@zju.edu.cn",
        "password": "password123"
    }
    
    Returns:
        200: Login successful with JWT token
        400: Invalid input
        401: Invalid credentials
        500: Login failed
    """
    try:
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '请提供邮箱和密码'
                }
            }), 400
        
        email = data['email'].strip().lower()
        password = data['password']
        
        # Check if email is blacklisted
        from admin.models import EmailBlacklist
        if EmailBlacklist.is_blacklisted(email):
            return jsonify({
                'error': {
                    'code': 'AUTH_007',
                    'message': '该邮箱已被禁止登录'
                }
            }), 403
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        # Validate credentials
        if not user or not user.check_password(password):
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户名或密码错误'
                }
            }), 401
        
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
        
        # Generate JWT token (7-day expiration configured in config.py)
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'name': user.name
            }
        )
        
        current_app.logger.info(f'User logged in: {email}')
        
        return jsonify({
            'success': True,
            'message': '登录成功',
            'token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error during login: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '登录失败，请稍后重试'
            }
        }), 500



@auth_bp.route('/refresh', methods=['POST'])
@jwt_required()
def refresh():
    """
    Refresh JWT token with extended expiration
    
    POST /api/auth/refresh
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: New token generated successfully
        401: Invalid or expired token
        500: Token refresh failed
    """
    try:
        # Get current user identity from JWT
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
        
        # Check if user is active
        if not user.is_active:
            return jsonify({
                'error': {
                    'code': 'AUTH_006',
                    'message': '账号已被禁用，请联系管理员'
                }
            }), 401
        
        # Generate new JWT token with extended expiration
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
    """
    Get current user information from JWT token
    
    GET /api/auth/me
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: User information retrieved successfully
        401: Invalid or expired token
        404: User not found
        500: Request failed
    """
    try:
        # Get current user identity from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get user from database
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户不存在'
                }
            }), 404
        
        # Check if user is active
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
