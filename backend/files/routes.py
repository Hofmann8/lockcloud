"""
File management routes for LockCloud
Implements file upload, listing, retrieval, and deletion endpoints
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from app import db
from files.models import File
from files.validators import (
    validate_file_naming_convention,
    validate_directory_path,
    validate_file_extension
)
from services.s3_service import s3_service
from logs.models import FileLog, OperationType


# Create blueprint
files_bp = Blueprint('files', __name__)


@files_bp.route('/upload-url', methods=['POST'])
@jwt_required()
def get_upload_url():
    """
    Generate signed URL for file upload
    
    POST /api/files/upload-url
    Headers: Authorization: Bearer <token>
    Body: {
        "filename": "2025-03-session_alex_01.jpg",
        "directory": "/rehearsals/2025-03-session/",
        "content_type": "image/jpeg",
        "size": 1024000
    }
    
    Returns:
        200: Signed upload URL generated successfully
        400: Invalid input or validation failed
        401: Unauthorized
        500: URL generation failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['filename', 'directory', 'content_type', 'size']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        filename = data['filename'].strip()
        directory = data['directory'].strip()
        content_type = data['content_type'].strip()
        size = data['size']
        
        # Validate file naming convention
        naming_validation = validate_file_naming_convention(filename)
        if not naming_validation['valid']:
            return jsonify({
                'error': {
                    'code': 'FILE_003',
                    'message': naming_validation['message']
                }
            }), 400
        
        # Validate directory path
        directory_validation = validate_directory_path(directory)
        if not directory_validation['valid']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': directory_validation['message']
                }
            }), 400
        
        # Validate file extension
        extension_validation = validate_file_extension(filename)
        if not extension_validation['valid']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': extension_validation['message']
                }
            }), 400
        
        # Validate file size (max 500MB)
        max_size = 500 * 1024 * 1024  # 500MB in bytes
        if size > max_size:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': f'文件大小超过限制 (最大 500MB)'
                }
            }), 400
        
        # Construct S3 key (path in bucket)
        # Format: directory/filename
        directory_normalized = directory.strip('/')
        s3_key = f"{directory_normalized}/{filename}"
        
        # Check if file already exists
        existing_file = File.query.filter_by(s3_key=s3_key).first()
        if existing_file:
            return jsonify({
                'error': {
                    'code': 'FILE_005',
                    'message': '文件已存在，请使用不同的文件名'
                }
            }), 400
        
        # Generate signed upload URL (1-hour expiration)
        try:
            upload_url = s3_service.generate_presigned_upload_url(
                key=s3_key,
                content_type=content_type,
                metadata={
                    'uploader_id': str(current_user_id),
                    'original_filename': filename
                },
                expiration=3600  # 1 hour
            )
        except Exception as e:
            current_app.logger.error(f'Failed to generate upload URL: {str(e)}')
            return jsonify({
                'error': {
                    'code': 'S3_001',
                    'message': '生成上传链接失败'
                }
            }), 500
        
        current_app.logger.info(
            f'Generated upload URL for user {current_user_id}: {s3_key}'
        )
        
        return jsonify({
            'success': True,
            'upload_url': upload_url,
            's3_key': s3_key,
            'expires_in': 3600
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error generating upload URL: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '生成上传链接失败，请稍后重试'
            }
        }), 500


@files_bp.route('/confirm', methods=['POST'])
@jwt_required()
def confirm_upload():
    """
    Confirm file upload and save metadata to database
    
    POST /api/files/confirm
    Headers: Authorization: Bearer <token>
    Body: {
        "filename": "2025-03-session_alex_01.jpg",
        "directory": "/rehearsals/2025-03-session/",
        "s3_key": "rehearsals/2025-03-session/2025-03-session_alex_01.jpg",
        "size": 1024000,
        "content_type": "image/jpeg"
    }
    
    Returns:
        201: File metadata saved successfully
        400: Invalid input
        401: Unauthorized
        500: Save failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['filename', 'directory', 's3_key', 'size', 'content_type']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        filename = data['filename'].strip()
        directory = data['directory'].strip()
        s3_key = data['s3_key'].strip()
        size = data['size']
        content_type = data['content_type'].strip()
        
        # Check if file already exists in database
        existing_file = File.query.filter_by(s3_key=s3_key).first()
        if existing_file:
            return jsonify({
                'error': {
                    'code': 'FILE_005',
                    'message': '文件已存在'
                }
            }), 400
        
        # Generate public URL
        bucket = s3_service.get_bucket_name()
        endpoint = current_app.config.get('S3_ENDPOINT', 'https://s3.bitiful.net')
        public_url = f"{endpoint}/{bucket}/{s3_key}"
        
        # Create file record
        file = File(
            filename=filename,
            directory=directory.strip('/'),
            s3_key=s3_key,
            size=size,
            content_type=content_type,
            uploader_id=current_user_id,
            uploaded_at=datetime.utcnow(),
            public_url=public_url
        )
        
        db.session.add(file)
        db.session.flush()  # Get file ID before commit
        
        # Create log entry
        log = FileLog.create_log(
            user_id=current_user_id,
            operation=OperationType.UPLOAD,
            file_id=file.id,
            file_path=s3_key,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        db.session.add(log)
        db.session.commit()
        
        current_app.logger.info(
            f'File uploaded by user {current_user_id}: {s3_key}'
        )
        
        return jsonify({
            'success': True,
            'message': '文件上传成功',
            'file': file.to_dict(include_uploader=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error confirming upload: {str(e)}')
        return jsonify({
            'error': {
                'code': 'FILE_004',
                'message': '保存文件信息失败，请稍后重试'
            }
        }), 500



@files_bp.route('', methods=['GET'])
@jwt_required()
def list_files():
    """
    List files with optional filters and pagination
    
    GET /api/files?directory=/rehearsals/2025-03-session/&uploader_id=1&page=1&per_page=50
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - directory: Filter by directory path (optional)
        - uploader_id: Filter by uploader user ID (optional)
        - date_from: Filter by upload date from (ISO format, optional)
        - date_to: Filter by upload date to (ISO format, optional)
        - page: Page number (default: 1)
        - per_page: Items per page (default: 50, max: 100)
    
    Returns:
        200: File list retrieved successfully
        400: Invalid query parameters
        401: Unauthorized
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Get query parameters
        directory = request.args.get('directory', '').strip()
        uploader_id = request.args.get('uploader_id', type=int)
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 50
        
        # Build query
        query = File.query
        
        # Apply filters
        if directory:
            # Normalize directory path
            directory_normalized = directory.strip('/')
            query = query.filter(File.directory == directory_normalized)
        
        if uploader_id:
            query = query.filter(File.uploader_id == uploader_id)
        
        if date_from:
            try:
                date_from_dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                query = query.filter(File.uploaded_at >= date_from_dt)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '日期格式无效 (date_from)。请使用 ISO 格式'
                    }
                }), 400
        
        if date_to:
            try:
                date_to_dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                query = query.filter(File.uploaded_at <= date_to_dt)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '日期格式无效 (date_to)。请使用 ISO 格式'
                    }
                }), 400
        
        # Order by upload date (newest first)
        query = query.order_by(File.uploaded_at.desc())
        
        # Paginate results
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Convert files to dictionaries
        files = [file.to_dict(include_uploader=True) for file in pagination.items]
        
        current_app.logger.info(
            f'User {current_user_id} listed {len(files)} files (page {page})'
        )
        
        return jsonify({
            'success': True,
            'files': files,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error listing files: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取文件列表失败，请稍后重试'
            }
        }), 500


@files_bp.route('/<int:file_id>', methods=['GET'])
@jwt_required()
def get_file(file_id):
    """
    Get detailed file metadata by ID
    
    GET /api/files/{file_id}
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: File metadata retrieved successfully
        401: Unauthorized
        404: File not found
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Find file by ID
        file = File.query.get(file_id)
        
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_001',
                    'message': '文件不存在'
                }
            }), 404
        
        current_app.logger.info(
            f'User {current_user_id} retrieved file {file_id}'
        )
        
        return jsonify({
            'success': True,
            'file': file.to_dict(include_uploader=True)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取文件信息失败，请稍后重试'
            }
        }), 500


@files_bp.route('/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    """
    Delete a file (only by uploader)
    
    DELETE /api/files/{file_id}
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: File deleted successfully
        401: Unauthorized
        403: Not the uploader
        404: File not found
        500: Deletion failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Find file by ID
        file = File.query.get(file_id)
        
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_001',
                    'message': '文件不存在'
                }
            }), 404
        
        # Verify user is the uploader
        if file.uploader_id != current_user_id:
            return jsonify({
                'error': {
                    'code': 'FILE_002',
                    'message': '您无权删除此文件'
                }
            }), 403
        
        # Delete file from S3
        try:
            s3_service.delete_file(file.s3_key)
        except Exception as e:
            current_app.logger.error(f'Failed to delete file from S3: {str(e)}')
            return jsonify({
                'error': {
                    'code': 'S3_001',
                    'message': '删除文件失败'
                }
            }), 500
        
        # Create log entry before deleting file record
        log = FileLog.create_log(
            user_id=current_user_id,
            operation=OperationType.DELETE,
            file_id=file.id,
            file_path=file.s3_key,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        db.session.add(log)
        
        # Delete file record from database
        db.session.delete(file)
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} deleted file {file_id}: {file.s3_key}'
        )
        
        return jsonify({
            'success': True,
            'message': '文件删除成功'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '删除文件失败，请稍后重试'
            }
        }), 500


@files_bp.route('/directories', methods=['GET'])
@jwt_required()
def get_directories():
    """
    Get hierarchical directory structure with file counts
    
    GET /api/files/directories
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Directory structure retrieved successfully
        401: Unauthorized
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Query all unique directories with file counts
        from sqlalchemy import func
        
        directory_counts = db.session.query(
            File.directory,
            func.count(File.id).label('file_count')
        ).group_by(File.directory).all()
        
        # Build hierarchical structure
        directory_tree = {
            'rehearsals': {'count': 0, 'subdirs': {}},
            'events': {'count': 0, 'subdirs': {}},
            'members': {'count': 0, 'subdirs': {}},
            'resources': {'count': 0, 'subdirs': {}},
            'admin': {'count': 0, 'subdirs': {}}
        }
        
        for directory, count in directory_counts:
            parts = directory.split('/')
            
            if len(parts) == 0:
                continue
            
            root = parts[0]
            
            if root not in directory_tree:
                continue
            
            if len(parts) == 1:
                # Root level directory
                directory_tree[root]['count'] += count
            else:
                # Subdirectory
                subdir = '/'.join(parts[1:])
                if subdir not in directory_tree[root]['subdirs']:
                    directory_tree[root]['subdirs'][subdir] = 0
                directory_tree[root]['subdirs'][subdir] += count
                directory_tree[root]['count'] += count
        
        # Convert to list format for easier frontend consumption
        directories = []
        for root, data in directory_tree.items():
            dir_obj = {
                'name': root,
                'path': f'/{root}/',
                'file_count': data['count'],
                'subdirectories': []
            }
            
            for subdir, subcount in data['subdirs'].items():
                dir_obj['subdirectories'].append({
                    'name': subdir,
                    'path': f'/{root}/{subdir}/',
                    'file_count': subcount
                })
            
            # Sort subdirectories by name
            dir_obj['subdirectories'].sort(key=lambda x: x['name'])
            
            directories.append(dir_obj)
        
        # Sort root directories by name
        directories.sort(key=lambda x: x['name'])
        
        current_app.logger.info(
            f'User {current_user_id} retrieved directory structure'
        )
        
        return jsonify({
            'success': True,
            'directories': directories
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting directories: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取目录结构失败，请稍后重试'
            }
        }), 500
