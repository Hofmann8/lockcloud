import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    DEBUG = False
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///lockcloud.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key'
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 604800))  # 7 days
    
    # Email
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.zju.edu.cn')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@lockcloud.com')
    
    # S3 - 主存储桶（文件系统）
    S3_ENDPOINT = os.environ.get('S3_ENDPOINT', 'https://s3.bitiful.net')
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    S3_BUCKET = os.environ.get('S3_BUCKET', 'funkandlove-cloud')
    AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
    
    # S3 - 公共资源桶（头像、备份等）
    S3_PUBLIC_BUCKET = os.environ.get('S3_PUBLIC_BUCKET', 'funkandlove-cloud-public')
    S3_PUBLIC_ENDPOINT = os.environ.get('S3_PUBLIC_ENDPOINT', 'https://funkandlove-cloud-public.s3.bitiful.net')
    
    # 缤纷云 CDN 高级防盗链配置
    S3_CDN_DOMAIN = os.environ.get('S3_CDN_DOMAIN')  # CDN 域名，如 https://cdn.example.com
    S3_TOKEN_KEY = os.environ.get('S3_TOKEN_KEY')  # 缤纷云后台设置的鉴权 Key
    S3_URL_EXPIRATION = int(os.environ.get('S3_URL_EXPIRATION', 3600))  # 签名 URL 有效期（秒）
    
    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    CORS_SUPPORTS_CREDENTIALS = True
    CORS_ALLOW_HEADERS = ['Content-Type', 'Authorization']
    CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    
    # SSO Configuration (Funk & Love Auth Service)
    SSO_AUTH_API_URL = os.environ.get('SSO_AUTH_API_URL', 'https://auth-api.funk-and.love')
    SSO_AUTH_FRONTEND_URL = os.environ.get('SSO_AUTH_FRONTEND_URL', 'https://auth.funk-and.love')
    
    # Rate Limiting
    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URL = os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
    RATELIMIT_DEFAULT = '100 per minute'
    RATELIMIT_HEADERS_ENABLED = True


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
