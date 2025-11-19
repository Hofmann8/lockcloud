import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)


def configure_security_headers(app):
    """Configure security headers - Task 9.3"""
    @app.after_request
    def set_security_headers(response):
        # HSTS - Force HTTPS for 1 year
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        
        # XSS Protection (legacy browsers)
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer Policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Content Security Policy
        response.headers['Content-Security-Policy'] = "default-src 'self'"
        
        return response


def create_app(config_name=None):
    """Application factory pattern"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions with app
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    
    # Configure CORS - Task 9.1
    CORS(app, 
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=app.config['CORS_SUPPORTS_CREDENTIALS'],
         allow_headers=app.config['CORS_ALLOW_HEADERS'],
         methods=app.config['CORS_METHODS'])
    
    # Configure security headers - Task 9.3
    configure_security_headers(app)
    
    # Configure JWT error handlers
    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        app.logger.warning(f'Invalid token: {error_string}')
        return jsonify({
            'error': {
                'code': 'AUTH_004',
                'message': '无效的登录令牌',
                'details': error_string if app.debug else {}
            }
        }), 401
    
    @jwt.unauthorized_loader
    def unauthorized_callback(error_string):
        app.logger.warning(f'Unauthorized: {error_string}')
        return jsonify({
            'error': {
                'code': 'AUTH_001',
                'message': '未提供登录令牌',
                'details': error_string if app.debug else {}
            }
        }), 401
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        app.logger.warning(f'Expired token for user: {jwt_payload.get("sub")}')
        return jsonify({
            'error': {
                'code': 'AUTH_004',
                'message': '登录已过期，请重新登录',
                'details': {}
            }
        }), 401
    
    # Import models to register them with SQLAlchemy
    with app.app_context():
        from auth.models import User, VerificationCode
        from files.models import File, TagPreset
        from logs.models import FileLog
        from ai.models import AIConversation, AIMessage
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register blueprints
    from auth.routes import auth_bp
    from files.routes import files_bp
    from logs.routes import logs_bp
    from tag_presets.routes import tag_presets_bp
    from admin.routes import admin_bp
    from ai.routes import ai_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(files_bp, url_prefix='/api/files')
    app.register_blueprint(logs_bp, url_prefix='/api/logs')
    app.register_blueprint(tag_presets_bp, url_prefix='/api/tag-presets')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    
    # Health check endpoint
    @app.route('/')
    def index():
        return jsonify({
            'status': 'ok',
            'message': 'LockCloud API 正在运行'
        })
    
    @app.route('/health')
    def health():
        return jsonify({
            'status': 'healthy',
            'service': 'lockcloud-backend'
        })
    
    return app


def register_error_handlers(app):
    """Register global error handlers with Chinese error messages"""
    from exceptions import LockCloudException
    from flask_jwt_extended.exceptions import JWTExtendedException
    from werkzeug.exceptions import HTTPException
    
    @app.errorhandler(LockCloudException)
    def handle_lockcloud_exception(error):
        """Handle custom LockCloud exceptions"""
        app.logger.error(f'LockCloud exception: {error.code} - {error.message}')
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(JWTExtendedException)
    def handle_jwt_exception(error):
        """Handle JWT-related exceptions"""
        app.logger.warning(f'JWT exception: {str(error)}')
        return jsonify({
            'error': {
                'code': 'AUTH_004',
                'message': '登录已过期，请重新登录',
                'details': str(error) if app.debug else {}
            }
        }), 401
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request errors"""
        # If the error already has a JSON response with 'error' key, don't override it
        if hasattr(error, 'response') and error.response:
            try:
                data = error.response.get_json()
                if data and 'error' in data:
                    return error.response
            except:
                pass
        
        app.logger.warning(f'Bad request: {str(error)}')
        return jsonify({
            'error': {
                'code': 'BAD_REQUEST',
                'message': '请求参数错误',
                'details': str(error) if app.debug else {}
            }
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        """Handle 401 Unauthorized errors"""
        app.logger.warning(f'Unauthorized access: {str(error)}')
        return jsonify({
            'error': {
                'code': 'UNAUTHORIZED',
                'message': '未授权访问，请先登录',
                'details': str(error) if app.debug else {}
            }
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 Forbidden errors"""
        app.logger.warning(f'Forbidden access: {str(error)}')
        return jsonify({
            'error': {
                'code': 'FORBIDDEN',
                'message': '无权访问此资源',
                'details': str(error) if app.debug else {}
            }
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found errors"""
        return jsonify({
            'error': {
                'code': 'NOT_FOUND',
                'message': '请求的资源不存在',
                'details': str(error) if app.debug else {}
            }
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Handle 405 Method Not Allowed errors"""
        return jsonify({
            'error': {
                'code': 'METHOD_NOT_ALLOWED',
                'message': '不支持的请求方法',
                'details': str(error) if app.debug else {}
            }
        }), 405
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """Handle 429 Too Many Requests errors"""
        app.logger.warning(f'Rate limit exceeded: {str(error)}')
        return jsonify({
            'error': {
                'code': 'RATE_LIMIT',
                'message': '请求过于频繁，请稍后再试',
                'details': str(error) if app.debug else {}
            }
        }), 429
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server Error"""
        app.logger.error(f'Internal server error: {str(error)}', exc_info=True)
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '服务器内部错误',
                'details': str(error) if app.debug else {}
            }
        }), 500
    
    @app.errorhandler(503)
    def service_unavailable(error):
        """Handle 503 Service Unavailable errors"""
        app.logger.error(f'Service unavailable: {str(error)}')
        return jsonify({
            'error': {
                'code': 'SERVICE_UNAVAILABLE',
                'message': '服务暂时不可用，请稍后重试',
                'details': str(error) if app.debug else {}
            }
        }), 503
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        """Handle all other HTTP exceptions"""
        app.logger.warning(f'HTTP exception: {error.code} - {str(error)}')
        return jsonify({
            'error': {
                'code': f'HTTP_{error.code}',
                'message': error.description or '请求处理失败',
                'details': str(error) if app.debug else {}
            }
        }), error.code
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        """Handle all uncaught exceptions"""
        app.logger.error(f'Unhandled exception: {type(error).__name__} - {str(error)}', exc_info=True)
        
        # Check if it's a database error
        if 'sqlalchemy' in str(type(error)).lower():
            return jsonify({
                'error': {
                    'code': 'DATABASE_ERROR',
                    'message': '数据库操作失败',
                    'details': str(error) if app.debug else {}
                }
            }), 500
        
        # Generic error response
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '服务器发生错误',
                'details': str(error) if app.debug else '请联系管理员'
            }
        }), 500


# Create app instance
app = create_app()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
