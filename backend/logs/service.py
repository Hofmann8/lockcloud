"""
Logging service for LockCloud
Handles creation and querying of file operation logs
"""
from datetime import datetime
from flask import request
from extensions import db
from logs.models import FileLog, OperationType


def log_file_operation(user_id, operation, file_id=None, file_path=None):
    """
    Log a file operation to the database
    
    Args:
        user_id: ID of the user performing the operation
        operation: Type of operation ('upload', 'delete', 'access')
        file_id: ID of the file (optional)
        file_path: Path of the file
        
    Returns:
        FileLog: Created log entry
        
    Raises:
        ValueError: If operation type is invalid
    """
    # Validate operation type
    valid_operations = [op.value for op in OperationType]
    if operation not in valid_operations:
        raise ValueError(f"Invalid operation type: {operation}. Must be one of {valid_operations}")
    
    # Get request context information
    ip_address = None
    user_agent = None
    
    if request:
        # Get IP address (handle proxy headers)
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip_address and ',' in ip_address:
            # Take the first IP if there are multiple
            ip_address = ip_address.split(',')[0].strip()
        
        # Get user agent
        user_agent = request.headers.get('User-Agent')
    
    # Create log entry
    log = FileLog.create_log(
        user_id=user_id,
        operation=operation,
        file_id=file_id,
        file_path=file_path,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    # Save to database
    db.session.add(log)
    db.session.commit()
    
    return log


def get_logs(user_id=None, operation=None, start_date=None, end_date=None, 
             page=1, per_page=50):
    """
    Query file logs with filters and pagination
    
    Args:
        user_id: Filter by user ID (optional)
        operation: Filter by operation type (optional)
        start_date: Filter logs after this date (optional)
        end_date: Filter logs before this date (optional)
        page: Page number (default: 1)
        per_page: Results per page (default: 50)
        
    Returns:
        dict: Paginated log results with metadata
    """
    # Start with base query
    query = FileLog.query
    
    # Apply filters
    if user_id:
        query = query.filter(FileLog.user_id == user_id)
    
    if operation:
        # Convert string to enum
        if isinstance(operation, str):
            operation = OperationType(operation)
        query = query.filter(FileLog.operation == operation)
    
    if start_date:
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        query = query.filter(FileLog.timestamp >= start_date)
    
    if end_date:
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        query = query.filter(FileLog.timestamp <= end_date)
    
    # Order by timestamp descending (most recent first)
    query = query.order_by(FileLog.timestamp.desc())
    
    # Paginate results
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return {
        'logs': [log.to_dict(include_user=True, include_file=True) for log in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'per_page': pagination.per_page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev
    }


def get_usage_summary(start_date=None, end_date=None):
    """
    Generate usage statistics summary
    
    Args:
        start_date: Start date for statistics (optional, defaults to all time)
        end_date: End date for statistics (optional, defaults to now)
        
    Returns:
        dict: Usage statistics including storage, uploads, and active users
    """
    from files.models import File
    from auth.models import User
    from sqlalchemy import func, distinct
    
    # Build query for files
    file_query = File.query
    log_query = FileLog.query
    
    # Apply date filters
    if start_date:
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        file_query = file_query.filter(File.uploaded_at >= start_date)
        log_query = log_query.filter(FileLog.timestamp >= start_date)
    
    if end_date:
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        file_query = file_query.filter(File.uploaded_at <= end_date)
        log_query = log_query.filter(FileLog.timestamp <= end_date)
    
    # Calculate total storage (sum of all file sizes)
    total_storage = db.session.query(func.sum(File.size)).filter(
        File.id.in_([f.id for f in file_query.all()])
    ).scalar() or 0
    
    # Count total uploads
    upload_count = log_query.filter(
        FileLog.operation == OperationType.UPLOAD
    ).count()
    
    # Count active users (users who have performed any operation)
    active_users = db.session.query(func.count(distinct(FileLog.user_id))).filter(
        FileLog.id.in_([log.id for log in log_query.all()])
    ).scalar() or 0
    
    # Count total files
    total_files = file_query.count()
    
    # Get operation breakdown
    operation_stats = {}
    for op_type in OperationType:
        count = log_query.filter(FileLog.operation == op_type).count()
        operation_stats[op_type.value] = count
    
    # Format storage size
    def format_size(size_bytes):
        """Convert bytes to human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} PB"
    
    return {
        'total_storage': total_storage,
        'total_storage_formatted': format_size(total_storage),
        'total_files': total_files,
        'upload_count': upload_count,
        'active_users': active_users,
        'operation_stats': operation_stats,
        'period': {
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None
        }
    }


def get_quarterly_stats(year, quarter):
    """
    Get statistics for a specific quarter
    
    Args:
        year: Year (e.g., 2025)
        quarter: Quarter number (1-4)
        
    Returns:
        dict: Quarterly statistics
    """
    # Calculate quarter date range
    quarter_months = {
        1: (1, 3),
        2: (4, 6),
        3: (7, 9),
        4: (10, 12)
    }
    
    if quarter not in quarter_months:
        raise ValueError("Quarter must be between 1 and 4")
    
    start_month, end_month = quarter_months[quarter]
    start_date = datetime(year, start_month, 1)
    
    # Calculate end date (last day of end month)
    if end_month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, end_month + 1, 1)
    
    # Get summary for this period
    summary = get_usage_summary(start_date, end_date)
    summary['quarter'] = quarter
    summary['year'] = year
    
    return summary
