"""
Flask extensions initialization
Separate file to avoid circular imports
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)

@limiter.request_filter
def exempt_options_requests():
    """Exempt OPTIONS requests from rate limiting for CORS preflight"""
    from flask import request
    return request.method == 'OPTIONS'
