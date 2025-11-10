"""
Input validation decorators and middleware for LockCloud
Provides reusable validation decorators for request data
"""
import re
from functools import wraps
from flask import request, jsonify
from exceptions import (
    ValidationError,
    MissingFieldError,
    InvalidFieldError,
    InvalidEmailFormatError,
    InvalidEmailDomainError,
    InvalidDirectoryPathError,
    InvalidFileNameError,
    FileSizeLimitExceededError
)


def validate_json(*required_fields):
    """
    Decorator to validate JSON request body and required fields
    
    Args:
        *required_fields: List of required field names
        
    Usage:
        @validate_json('email', 'password')
        def login():
            data = request.get_json()
            # data is guaranteed to have 'email' and 'password' fields
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Check if request has JSON content type
            if not request.is_json:
                raise ValidationError('请求必须包含 JSON 数据')
            
            # Get JSON data
            data = request.get_json()
            
            if data is None:
                raise ValidationError('请求体不能为空')
            
            # Validate required fields
            for field in required_fields:
                if field not in data:
                    raise MissingFieldError(field)
                
                # Check if field value is not empty
                value = data[field]
                if value is None or (isinstance(value, str) and not value.strip()):
                    raise InvalidFieldError(field, f'字段不能为空: {field}')
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_email(field_name='email'):
    """
    Decorator to validate email format
    
    Args:
        field_name: Name of the email field in request data (default: 'email')
        
    Usage:
        @validate_email()
        def send_code():
            data = request.get_json()
            # data['email'] is guaranteed to be a valid email format
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            email = data[field_name].strip().lower()
            
            # Basic email format validation
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                raise InvalidEmailFormatError()
            
            # Update data with normalized email
            data[field_name] = email
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_zju_email(field_name='email'):
    """
    Decorator to validate ZJU email domain (@zju.edu.cn)
    
    Args:
        field_name: Name of the email field in request data (default: 'email')
        
    Usage:
        @validate_zju_email()
        def register():
            data = request.get_json()
            # data['email'] is guaranteed to be a @zju.edu.cn email
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            email = data[field_name].strip().lower()
            
            # Validate ZJU email domain
            if not email.endswith('@zju.edu.cn'):
                raise InvalidEmailDomainError()
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_file_name(field_name='filename'):
    """
    Decorator to validate file naming convention
    Format: YYYY-MM-activity_uploader_index.extension
    
    Args:
        field_name: Name of the filename field in request data (default: 'filename')
        
    Usage:
        @validate_file_name()
        def upload():
            data = request.get_json()
            # data['filename'] is guaranteed to follow naming convention
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            from files.validators import validate_file_naming_convention
            
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            filename = data[field_name].strip()
            
            # Validate naming convention
            result = validate_file_naming_convention(filename)
            if not result['valid']:
                raise InvalidFileNameError(result['message'])
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_directory(field_name='directory'):
    """
    Decorator to validate directory path
    
    Args:
        field_name: Name of the directory field in request data (default: 'directory')
        
    Usage:
        @validate_directory()
        def upload():
            data = request.get_json()
            # data['directory'] is guaranteed to be a valid directory path
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            from files.validators import validate_directory_path
            
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            directory = data[field_name].strip()
            
            # Validate directory path
            result = validate_directory_path(directory)
            if not result['valid']:
                raise InvalidDirectoryPathError(result['message'])
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_file_size(field_name='size', max_size_mb=500):
    """
    Decorator to validate file size
    
    Args:
        field_name: Name of the size field in request data (default: 'size')
        max_size_mb: Maximum file size in MB (default: 500)
        
    Usage:
        @validate_file_size(max_size_mb=100)
        def upload():
            data = request.get_json()
            # data['size'] is guaranteed to be within limit
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            size = data[field_name]
            
            # Validate size is a number
            if not isinstance(size, (int, float)):
                raise InvalidFieldError(field_name, '文件大小必须是数字')
            
            # Validate size is positive
            if size <= 0:
                raise InvalidFieldError(field_name, '文件大小必须大于 0')
            
            # Validate size limit
            max_size_bytes = max_size_mb * 1024 * 1024
            if size > max_size_bytes:
                raise FileSizeLimitExceededError(
                    f'文件大小超过限制 (最大 {max_size_mb}MB)',
                    details={'max_size_mb': max_size_mb, 'size_bytes': size}
                )
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_password(field_name='password', min_length=6, max_length=128):
    """
    Decorator to validate password strength
    
    Args:
        field_name: Name of the password field in request data (default: 'password')
        min_length: Minimum password length (default: 6)
        max_length: Maximum password length (default: 128)
        
    Usage:
        @validate_password(min_length=8)
        def register():
            data = request.get_json()
            # data['password'] is guaranteed to meet requirements
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            password = data[field_name]
            
            # Validate password is a string
            if not isinstance(password, str):
                raise InvalidFieldError(field_name, '密码必须是字符串')
            
            # Validate minimum length
            if len(password) < min_length:
                raise InvalidFieldError(
                    field_name,
                    f'密码长度至少为 {min_length} 位'
                )
            
            # Validate maximum length
            if len(password) > max_length:
                raise InvalidFieldError(
                    field_name,
                    f'密码长度不能超过 {max_length} 位'
                )
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_string_length(field_name, min_length=None, max_length=None):
    """
    Decorator to validate string field length
    
    Args:
        field_name: Name of the field to validate
        min_length: Minimum string length (optional)
        max_length: Maximum string length (optional)
        
    Usage:
        @validate_string_length('name', min_length=2, max_length=50)
        def register():
            data = request.get_json()
            # data['name'] is guaranteed to be within length limits
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name not in data:
                raise MissingFieldError(field_name)
            
            value = data[field_name]
            
            # Validate value is a string
            if not isinstance(value, str):
                raise InvalidFieldError(field_name, f'{field_name} 必须是字符串')
            
            # Strip whitespace for length check
            value_stripped = value.strip()
            
            # Validate minimum length
            if min_length is not None and len(value_stripped) < min_length:
                raise InvalidFieldError(
                    field_name,
                    f'{field_name} 长度至少为 {min_length} 位'
                )
            
            # Validate maximum length
            if max_length is not None and len(value_stripped) > max_length:
                raise InvalidFieldError(
                    field_name,
                    f'{field_name} 长度不能超过 {max_length} 位'
                )
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validate_query_params(*required_params):
    """
    Decorator to validate query parameters
    
    Args:
        *required_params: List of required query parameter names
        
    Usage:
        @validate_query_params('page', 'per_page')
        def list_items():
            # Query params 'page' and 'per_page' are guaranteed to exist
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            for param in required_params:
                if param not in request.args:
                    raise MissingFieldError(param, f'缺少查询参数: {param}')
            
            return f(*args, **kwargs)
        return wrapper
    return decorator


def sanitize_input(field_name):
    """
    Decorator to sanitize input by stripping whitespace and converting to lowercase
    
    Args:
        field_name: Name of the field to sanitize
        
    Usage:
        @sanitize_input('email')
        def login():
            data = request.get_json()
            # data['email'] is stripped and lowercased
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            
            if field_name in data and isinstance(data[field_name], str):
                data[field_name] = data[field_name].strip().lower()
            
            return f(*args, **kwargs)
        return wrapper
    return decorator
