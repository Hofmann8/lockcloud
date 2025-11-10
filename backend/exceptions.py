"""
Custom exception classes for LockCloud
Provides structured error handling with Chinese error messages
"""


class LockCloudException(Exception):
    """Base exception class for LockCloud"""
    
    def __init__(self, message, code=None, status_code=500, details=None):
        """
        Initialize exception
        
        Args:
            message: Human-readable error message in Chinese
            code: Error code (e.g., 'AUTH_001')
            status_code: HTTP status code
            details: Additional error details (optional)
        """
        super().__init__(message)
        self.message = message
        self.code = code or 'INTERNAL_ERROR'
        self.status_code = status_code
        self.details = details or {}
    
    def to_dict(self):
        """Convert exception to dictionary for JSON response"""
        return {
            'error': {
                'code': self.code,
                'message': self.message,
                'details': self.details
            }
        }


class AuthError(LockCloudException):
    """Authentication and authorization errors"""
    
    def __init__(self, message, code='AUTH_ERROR', status_code=401, details=None):
        super().__init__(message, code, status_code, details)


class InvalidCredentialsError(AuthError):
    """Invalid username or password"""
    
    def __init__(self, message='用户名或密码错误', details=None):
        super().__init__(message, code='AUTH_001', status_code=401, details=details)


class InvalidEmailDomainError(AuthError):
    """Email must be from ZJU domain"""
    
    def __init__(self, message='邮箱必须是浙江大学邮箱 (@zju.edu.cn)', details=None):
        super().__init__(message, code='AUTH_002', status_code=400, details=details)


class VerificationCodeExpiredError(AuthError):
    """Verification code has expired"""
    
    def __init__(self, message='验证码已过期', details=None):
        super().__init__(message, code='AUTH_003', status_code=400, details=details)


class TokenExpiredError(AuthError):
    """JWT token has expired"""
    
    def __init__(self, message='登录已过期，请重新登录', details=None):
        super().__init__(message, code='AUTH_004', status_code=401, details=details)


class UserAlreadyExistsError(AuthError):
    """User with this email already exists"""
    
    def __init__(self, message='该邮箱已被注册', details=None):
        super().__init__(message, code='AUTH_005', status_code=409, details=details)


class AccountDisabledError(AuthError):
    """User account has been disabled"""
    
    def __init__(self, message='账号已被禁用，请联系管理员', details=None):
        super().__init__(message, code='AUTH_006', status_code=401, details=details)


class FileError(LockCloudException):
    """File operation errors"""
    
    def __init__(self, message, code='FILE_ERROR', status_code=400, details=None):
        super().__init__(message, code, status_code, details)


class FileNotFoundError(FileError):
    """File does not exist"""
    
    def __init__(self, message='文件不存在', details=None):
        super().__init__(message, code='FILE_001', status_code=404, details=details)


class FileAccessDeniedError(FileError):
    """User does not have permission to access file"""
    
    def __init__(self, message='无权访问此文件', details=None):
        super().__init__(message, code='FILE_002', status_code=403, details=details)


class InvalidFileNameError(FileError):
    """File name does not follow naming convention"""
    
    def __init__(self, message='文件名格式不正确', details=None):
        super().__init__(message, code='FILE_003', status_code=400, details=details)


class FileUploadError(FileError):
    """File upload failed"""
    
    def __init__(self, message='上传失败', details=None):
        super().__init__(message, code='FILE_004', status_code=500, details=details)


class FileAlreadyExistsError(FileError):
    """File with this name already exists"""
    
    def __init__(self, message='文件已存在', details=None):
        super().__init__(message, code='FILE_005', status_code=400, details=details)


class S3Error(LockCloudException):
    """S3 storage service errors"""
    
    def __init__(self, message='存储服务错误', code='S3_001', status_code=500, details=None):
        super().__init__(message, code, status_code, details)


class S3ConnectionError(S3Error):
    """Failed to connect to S3 service"""
    
    def __init__(self, message='无法连接到存储服务', details=None):
        super().__init__(message, code='S3_002', status_code=503, details=details)


class S3UploadError(S3Error):
    """Failed to upload file to S3"""
    
    def __init__(self, message='文件上传到存储服务失败', details=None):
        super().__init__(message, code='S3_003', status_code=500, details=details)


class S3DeleteError(S3Error):
    """Failed to delete file from S3"""
    
    def __init__(self, message='文件删除失败', details=None):
        super().__init__(message, code='S3_004', status_code=500, details=details)


class ValidationError(LockCloudException):
    """Input validation errors"""
    
    def __init__(self, message='输入数据无效', code='VALIDATION_001', status_code=400, details=None):
        super().__init__(message, code, status_code, details)


class MissingFieldError(ValidationError):
    """Required field is missing"""
    
    def __init__(self, field_name, message=None, details=None):
        if message is None:
            message = f'缺少必填字段: {field_name}'
        super().__init__(message, code='VALIDATION_002', status_code=400, details=details)


class InvalidFieldError(ValidationError):
    """Field value is invalid"""
    
    def __init__(self, field_name, message=None, details=None):
        if message is None:
            message = f'字段值无效: {field_name}'
        super().__init__(message, code='VALIDATION_003', status_code=400, details=details)


class InvalidEmailFormatError(ValidationError):
    """Email format is invalid"""
    
    def __init__(self, message='邮箱格式无效', details=None):
        super().__init__(message, code='VALIDATION_004', status_code=400, details=details)


class InvalidDirectoryPathError(ValidationError):
    """Directory path is invalid"""
    
    def __init__(self, message='目录路径无效', details=None):
        super().__init__(message, code='VALIDATION_005', status_code=400, details=details)


class FileSizeLimitExceededError(ValidationError):
    """File size exceeds maximum limit"""
    
    def __init__(self, message='文件大小超过限制', details=None):
        super().__init__(message, code='VALIDATION_006', status_code=400, details=details)


class RateLimitExceededError(LockCloudException):
    """Rate limit exceeded"""
    
    def __init__(self, message='请求过于频繁，请稍后再试', code='RATE_LIMIT', status_code=429, details=None):
        super().__init__(message, code, status_code, details)
