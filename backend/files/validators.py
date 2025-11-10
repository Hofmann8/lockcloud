"""
File validators for LockCloud
Validates file naming conventions and directory paths
"""
import re
from datetime import datetime
from exceptions import InvalidFileNameError, InvalidDirectoryPathError, ValidationError


def validate_file_naming_convention(filename):
    """
    Validate file naming convention: YYYY-MM-activity_uploader_index.extension
    
    Args:
        filename: Filename to validate
        
    Returns:
        dict: Validation result with 'valid' (bool) and 'message' (str)
        
    Examples:
        Valid: 2025-03-session_alex_01.jpg
        Valid: 2025-04-showcase_hofmann_02.mp4
        Invalid: session_alex.jpg (missing date)
        Invalid: 2025-3-session_alex_01.jpg (month not zero-padded)
    """
    # Pattern: YYYY-MM-activity_uploader_index.extension
    pattern = r'^(\d{4})-(\d{2})-([a-zA-Z0-9\-]+)_([a-zA-Z0-9]+)_(\d{2})\.[a-zA-Z0-9]+$'
    
    match = re.match(pattern, filename)
    
    if not match:
        return {
            'valid': False,
            'message': '文件名格式不正确。正确格式: YYYY-MM-activity_uploader_index.ext (例如: 2025-03-session_alex_01.jpg)'
        }
    
    year, month, activity, uploader, index = match.groups()
    
    # Validate year (reasonable range)
    year_int = int(year)
    current_year = datetime.now().year
    if year_int < 2020 or year_int > current_year + 5:
        return {
            'valid': False,
            'message': f'年份无效: {year}。年份应在 2020 到 {current_year + 5} 之间'
        }
    
    # Validate month
    month_int = int(month)
    if month_int < 1 or month_int > 12:
        return {
            'valid': False,
            'message': f'月份无效: {month}。月份应在 01 到 12 之间'
        }
    
    # Validate activity name (alphanumeric and hyphens only)
    if not re.match(r'^[a-zA-Z0-9\-]+$', activity):
        return {
            'valid': False,
            'message': '活动名称只能包含字母、数字和连字符'
        }
    
    # Validate uploader name (alphanumeric only)
    if not re.match(r'^[a-zA-Z0-9]+$', uploader):
        return {
            'valid': False,
            'message': '上传者名称只能包含字母和数字'
        }
    
    # Validate index (01-99)
    index_int = int(index)
    if index_int < 1 or index_int > 99:
        return {
            'valid': False,
            'message': f'索引无效: {index}。索引应在 01 到 99 之间'
        }
    
    return {
        'valid': True,
        'message': '文件名格式正确'
    }


def validate_directory_path(directory):
    """
    Validate directory path against allowed structure
    
    Allowed directories:
    - /rehearsals/YYYY-MM-session/
    - /events/YYYY-MM-event/
    - /members/<member_name>/
    - /resources/
    - /admin/
    
    Args:
        directory: Directory path to validate
        
    Returns:
        dict: Validation result with 'valid' (bool) and 'message' (str)
    """
    # Normalize directory path
    directory = directory.strip('/')
    
    # Define allowed patterns
    patterns = [
        r'^rehearsals/\d{4}-\d{2}-[a-zA-Z0-9\-]+/?$',  # /rehearsals/YYYY-MM-session/
        r'^events/\d{4}-\d{2}-[a-zA-Z0-9\-]+/?$',      # /events/YYYY-MM-event/
        r'^members/[a-zA-Z0-9_\-]+/?$',                 # /members/<member_name>/
        r'^resources/?$',                               # /resources/
        r'^admin/?$'                                    # /admin/
    ]
    
    # Check if directory matches any allowed pattern
    for pattern in patterns:
        if re.match(pattern, directory):
            return {
                'valid': True,
                'message': '目录路径有效'
            }
    
    return {
        'valid': False,
        'message': '目录路径无效。允许的目录: /rehearsals/YYYY-MM-session/, /events/YYYY-MM-event/, /members/<name>/, /resources/, /admin/'
    }


def get_allowed_file_extensions():
    """
    Get list of allowed file extensions
    
    Returns:
        list: Allowed file extensions
    """
    return [
        # Images
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
        # Videos
        'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv',
        # Audio
        'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg',
        # Documents
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
        # Archives
        'zip', 'rar', '7z', 'tar', 'gz'
    ]


def validate_file_extension(filename):
    """
    Validate file extension
    
    Args:
        filename: Filename to validate
        
    Returns:
        dict: Validation result with 'valid' (bool) and 'message' (str)
    """
    if '.' not in filename:
        return {
            'valid': False,
            'message': '文件名必须包含扩展名'
        }
    
    extension = filename.rsplit('.', 1)[1].lower()
    allowed_extensions = get_allowed_file_extensions()
    
    if extension not in allowed_extensions:
        return {
            'valid': False,
            'message': f'不支持的文件类型: .{extension}。允许的类型: {", ".join(allowed_extensions)}'
        }
    
    return {
        'valid': True,
        'message': '文件类型有效'
    }
