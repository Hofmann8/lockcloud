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
    Generate signed URL for file upload with automatic naming
    
    POST /api/files/upload-url
    Headers: Authorization: Bearer <token>
    Body: {
        "original_filename": "IMG_1234.jpg",
        "content_type": "image/jpeg",
        "size": 1024000,
        "activity_date": "2025-03-15",
        "activity_type": "regular_training",
        "instructor": "alex"
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
        required_fields = ['original_filename', 'content_type', 'size', 'activity_date', 'activity_type', 'instructor']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        original_filename = data['original_filename'].strip()
        content_type = data['content_type'].strip()
        size = data['size']
        activity_date_str = data['activity_date'].strip()
        activity_type = data['activity_type'].strip()
        instructor = data['instructor'].strip()
        custom_filename = data.get('custom_filename', '').strip() if data.get('custom_filename') else None
        
        # Validate activity date format
        try:
            from datetime import datetime
            activity_date = datetime.fromisoformat(activity_date_str).date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'FILE_007',
                    'message': '活动日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)'
                }
            }), 400
        
        # Validate tag presets
        from services.tag_preset_service import tag_preset_service
        
        # Validate activity_type
        activity_type_presets = tag_preset_service.get_active_presets('activity_type')
        valid_activity_types = [preset.value for preset in activity_type_presets]
        if activity_type not in valid_activity_types:
            return jsonify({
                'error': {
                    'code': 'FILE_008',
                    'message': f'活动类型无效。有效选项: {", ".join(valid_activity_types)}'
                }
            }), 400
        
        # Validate instructor
        instructor_presets = tag_preset_service.get_active_presets('instructor')
        valid_instructors = [preset.value for preset in instructor_presets]
        if instructor not in valid_instructors:
            return jsonify({
                'error': {
                    'code': 'FILE_009',
                    'message': f'带训老师标签无效。有效选项: {", ".join(valid_instructors)}'
                }
            }), 400
        
        # Extract and validate file extension
        from services.file_naming_service import file_naming_service
        import re
        
        try:
            file_extension = file_naming_service.extract_extension(original_filename)
        except ValueError as e:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': str(e)
                }
            }), 400
        
        extension_validation = validate_file_extension(original_filename)
        if not extension_validation['valid']:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': extension_validation['message']
                }
            }), 400
        
        # Validate custom filename if provided
        if custom_filename:
            # Check for invalid characters
            if re.search(r'[<>:"/\\|?*\x00-\x1f]', custom_filename):
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '自定义文件名包含非法字符'
                    }
                }), 400
            
            # Check length
            if len(custom_filename) > 200:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '自定义文件名过长（最多200字符）'
                    }
                }), 400
        
        # Validate file size (max 2GB)
        max_size = 2 * 1024 * 1024 * 1024  # 2GB in bytes
        if size > max_size:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': f'文件大小超过限制 (最大 2GB)'
                }
            }), 400
        
        # Generate filename: use custom name if provided, otherwise use original filename
        if custom_filename:
            generated_filename = f"{custom_filename}{file_extension}"
        else:
            # Use original filename (without path, just the name)
            generated_filename = original_filename.split('/')[-1].split('\\')[-1]
        
        # Construct directory path based on tags: /{activity_type}/{year}/{month}/
        year = activity_date.year
        month = f"{activity_date.month:02d}"  # Zero-padded month (01-12)
        directory_path = f"{activity_type}/{year}/{month}"
        
        # Construct S3 key (path in bucket)
        s3_key = f"{directory_path}/{generated_filename}"
        
        # Check if file already exists in the same directory (same activity_type, year, month, and filename)
        existing_file = File.query.filter_by(
            activity_type=activity_type
        ).filter(
            db.func.extract('year', File.activity_date) == year,
            db.func.extract('month', File.activity_date) == activity_date.month,
            File.filename == generated_filename
        ).first()
        
        if existing_file:
            return jsonify({
                'error': {
                    'code': 'FILE_005',
                    'message': f'该目录下已存在同名文件: {generated_filename}'
                }
            }), 400
        
        # Get uploader information
        from auth.models import User
        uploader = User.query.get(current_user_id)
        uploader_name = uploader.name if uploader else str(current_user_id)
        
        # Build S3 tags dictionary
        s3_tags = {
            'activity_date': activity_date_str,
            'activity_type': activity_type,
            'instructor': instructor,
            'uploader_name': uploader_name,
            'upload_timestamp': datetime.utcnow().isoformat() + 'Z',
            'original_filename': original_filename
        }
        
        # Generate signed upload URL without tags (simpler, more reliable)
        # Tags will be applied after upload confirmation
        try:
            upload_url = s3_service.generate_presigned_upload_url(
                key=s3_key,
                content_type=content_type,
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
            f'Generated upload URL for user {current_user_id}: {s3_key} (activity: {activity_date_str})'
        )
        
        return jsonify({
            'success': True,
            'upload_url': upload_url,
            's3_key': s3_key,
            'generated_filename': generated_filename,
            'expires_in': 3600,
            's3_tags': s3_tags,  # Return tags for confirmation step
            'uploader_name': uploader_name
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
        "s3_key": "regular_training/alex/2025/2025-03-15_001.jpg",
        "size": 1024000,
        "content_type": "image/jpeg",
        "original_filename": "IMG_1234.jpg",
        "activity_date": "2025-03-15",
        "activity_type": "regular_training",
        "instructor": "alex"
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
        required_fields = ['s3_key', 'size', 'content_type', 'original_filename', 
                          'activity_date', 'activity_type', 'instructor']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        s3_key = data['s3_key'].strip()
        size = data['size']
        content_type = data['content_type'].strip()
        original_filename = data['original_filename'].strip()
        activity_date_str = data['activity_date'].strip()
        activity_type = data['activity_type'].strip()
        instructor = data['instructor'].strip()
        
        # Parse activity date
        try:
            from datetime import datetime
            activity_date = datetime.fromisoformat(activity_date_str).date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'FILE_007',
                    'message': '活动日期格式无效'
                }
            }), 400
        
        # Extract generated filename from s3_key
        filename = s3_key.split('/')[-1]
        
        # Check if file already exists in database
        existing_file = File.query.filter_by(s3_key=s3_key).first()
        if existing_file:
            return jsonify({
                'error': {
                    'code': 'FILE_005',
                    'message': '文件已存在'
                }
            }), 400
        
        # Apply tags to the uploaded file
        from auth.models import User
        uploader = User.query.get(current_user_id)
        uploader_name = uploader.name if uploader else str(current_user_id)
        
        s3_tags = {
            'activity_date': activity_date_str,
            'activity_type': activity_type,
            'instructor': instructor,
            'uploader_name': uploader_name,
            'upload_timestamp': datetime.utcnow().isoformat() + 'Z',
            'original_filename': original_filename
        }
        
        try:
            s3_service.update_object_tags(s3_key, s3_tags)
        except Exception as e:
            current_app.logger.warning(f'Failed to apply tags to {s3_key}: {str(e)}')
            # Don't fail the upload if tagging fails
        
        # Generate public URL
        bucket = s3_service.get_bucket_name()
        endpoint = current_app.config.get('S3_ENDPOINT', 'https://s3.bitiful.net')
        public_url = f"{endpoint}/{bucket}/{s3_key}"
        
        # Extract directory from s3_key (everything except the filename)
        directory_from_key = '/'.join(s3_key.split('/')[:-1])
        
        # Create file record with new fields
        file = File(
            filename=filename,
            directory=directory_from_key,
            s3_key=s3_key,
            size=size,
            content_type=content_type,
            uploader_id=current_user_id,
            uploaded_at=datetime.utcnow(),
            public_url=public_url,
            original_filename=original_filename,
            activity_date=activity_date,
            activity_type=activity_type,
            instructor=instructor,
            is_legacy=False  # Mark as new system file
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
            f'File uploaded by user {current_user_id}: {s3_key} (activity: {activity_date_str}, type: {activity_type})'
        )
        
        # Get tag preset display names for response
        from services.tag_preset_service import tag_preset_service
        
        activity_type_preset = next(
            (p for p in tag_preset_service.get_active_presets('activity_type') if p.value == activity_type),
            None
        )
        activity_type_display = activity_type_preset.display_name if activity_type_preset else activity_type
        
        instructor_preset = next(
            (p for p in tag_preset_service.get_active_presets('instructor') if p.value == instructor),
            None
        )
        instructor_display = instructor_preset.display_name if instructor_preset else instructor
        
        # Build response with display names
        file_dict = file.to_dict(include_uploader=True)
        file_dict['activity_type_display'] = activity_type_display
        file_dict['instructor_display'] = instructor_display
        
        return jsonify({
            'success': True,
            'message': '文件上传成功',
            'file': file_dict
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
    
    GET /api/files?directory=/rehearsals/2025-03-session/&uploader_id=1&activity_type=regular_training&instructor=alex&date_from=2025-03-01&date_to=2025-03-31&search=training&page=1&per_page=50
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - directory: Filter by directory path (optional)
        - uploader_id: Filter by uploader user ID (optional)
        - activity_type: Filter by activity type (optional)
        - instructor: Filter by instructor (optional)
        - date_from: Filter by activity date from (ISO format, optional)
        - date_to: Filter by activity date to (ISO format, optional)
        - search: Search across filename, original_filename, and tags (optional)
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
        activity_type = request.args.get('activity_type', '').strip()
        instructor = request.args.get('instructor', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        search = request.args.get('search', '').strip()
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
            # Use prefix matching to include all subdirectories
            query = query.filter(File.directory.startswith(directory_normalized))
        
        if uploader_id:
            query = query.filter(File.uploader_id == uploader_id)
        
        # Filter by activity_type
        if activity_type:
            query = query.filter(File.activity_type == activity_type)
        
        # Filter by instructor
        if instructor:
            query = query.filter(File.instructor == instructor)
        
        # Search filter - searches across filename, original_filename, and tags
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    File.filename.ilike(search_pattern),
                    File.original_filename.ilike(search_pattern),
                    File.activity_type.ilike(search_pattern),
                    File.instructor.ilike(search_pattern)
                )
            )
        
        # Filter by activity date range (changed from uploaded_at to activity_date)
        if date_from:
            try:
                date_from_obj = datetime.fromisoformat(date_from).date()
                query = query.filter(File.activity_date >= date_from_obj)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '日期格式无效 (date_from)。请使用 ISO 格式 (YYYY-MM-DD)'
                    }
                }), 400
        
        if date_to:
            try:
                date_to_obj = datetime.fromisoformat(date_to).date()
                query = query.filter(File.activity_date <= date_to_obj)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '日期格式无效 (date_to)。请使用 ISO 格式 (YYYY-MM-DD)'
                    }
                }), 400
        
        # Order by activity date (newest first), fallback to upload date
        query = query.order_by(File.activity_date.desc().nullslast(), File.uploaded_at.desc())
        
        # Paginate results
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Convert files to dictionaries with tag display names
        from services.tag_preset_service import tag_preset_service
        
        # Get all active presets for display name mapping
        activity_type_presets = {p.value: p.display_name for p in tag_preset_service.get_active_presets('activity_type')}
        instructor_presets = {p.value: p.display_name for p in tag_preset_service.get_active_presets('instructor')}
        
        files = []
        for file in pagination.items:
            file_dict = file.to_dict(include_uploader=True)
            
            # Add display names for tags
            if file.activity_type:
                file_dict['activity_type_display'] = activity_type_presets.get(file.activity_type, file.activity_type)
            
            if file.instructor:
                file_dict['instructor_display'] = instructor_presets.get(file.instructor, file.instructor)
            
            files.append(file_dict)
        
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
        
        # Get file dictionary with uploader info
        file_dict = file.to_dict(include_uploader=True)
        
        # Add tag display names if tags exist
        from services.tag_preset_service import tag_preset_service
        
        if file.activity_type:
            activity_type_preset = next(
                (p for p in tag_preset_service.get_active_presets('activity_type') if p.value == file.activity_type),
                None
            )
            file_dict['activity_type_display'] = activity_type_preset.display_name if activity_type_preset else file.activity_type
        
        if file.instructor:
            instructor_preset = next(
                (p for p in tag_preset_service.get_active_presets('instructor') if p.value == file.instructor),
                None
            )
            file_dict['instructor_display'] = instructor_preset.display_name if instructor_preset else file.instructor
        
        current_app.logger.info(
            f'User {current_user_id} retrieved file {file_id}'
        )
        
        return jsonify({
            'success': True,
            'file': file_dict
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
    Get hierarchical directory structure with file counts based on tag presets
    Structure: {activity_type}/{year}/{month}
    
    GET /api/files/directories
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Directory structure retrieved successfully with display names from tag presets
        401: Unauthorized
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Get tag presets for display name mapping
        from services.tag_preset_service import tag_preset_service
        
        activity_type_presets = {p.value: p.display_name for p in tag_preset_service.get_active_presets('activity_type')}
        
        # Query files grouped by activity_type, year, and month
        from sqlalchemy import func, extract
        
        # Get file counts grouped by activity_type, year, and month
        file_stats = db.session.query(
            File.activity_type,
            extract('year', File.activity_date).label('year'),
            extract('month', File.activity_date).label('month'),
            func.count(File.id).label('file_count')
        ).filter(
            File.activity_type.isnot(None),
            File.activity_date.isnot(None)
        ).group_by(
            File.activity_type,
            extract('year', File.activity_date),
            extract('month', File.activity_date)
        ).all()
        
        # Build hierarchical structure
        directory_tree = {}
        
        for activity_type, year, month, count in file_stats:
            # Initialize activity type if not exists
            if activity_type not in directory_tree:
                directory_tree[activity_type] = {
                    'value': activity_type,
                    'display_name': activity_type_presets.get(activity_type, activity_type),
                    'count': 0,
                    'years': {}
                }
            
            directory_tree[activity_type]['count'] += count
            
            # Initialize year if not exists
            year_str = str(int(year)) if year else 'unknown'
            if year_str not in directory_tree[activity_type]['years']:
                directory_tree[activity_type]['years'][year_str] = {
                    'value': year_str,
                    'count': 0,
                    'months': {}
                }
            
            directory_tree[activity_type]['years'][year_str]['count'] += count
            
            # Add month data
            month_str = f"{int(month):02d}" if month else 'unknown'
            month_name = f"{int(month)}月" if month else 'unknown'
            if month_str not in directory_tree[activity_type]['years'][year_str]['months']:
                directory_tree[activity_type]['years'][year_str]['months'][month_str] = 0
            
            directory_tree[activity_type]['years'][year_str]['months'][month_str] += count
        
        # Convert to list format for frontend
        directories = []
        
        for activity_type, activity_data in directory_tree.items():
            activity_obj = {
                'value': activity_data['value'],
                'name': activity_data['display_name'],
                'path': f'{activity_type}',
                'file_count': activity_data['count'],
                'subdirectories': []
            }
            
            for year, year_data in activity_data['years'].items():
                year_obj = {
                    'value': year,
                    'name': f'{year}年',
                    'path': f'{activity_type}/{year}',
                    'file_count': year_data['count'],
                    'subdirectories': []
                }
                
                for month_str, month_count in year_data['months'].items():
                    month_int = int(month_str)
                    year_obj['subdirectories'].append({
                        'name': f'{month_int}月',
                        'path': f'{activity_type}/{year}/{month_str}',
                        'file_count': month_count
                    })
                
                # Sort months in descending order (newest first)
                year_obj['subdirectories'].sort(key=lambda x: int(x['name'].replace('月', '')), reverse=True)
                
                activity_obj['subdirectories'].append(year_obj)
            
            # Sort years in descending order (newest first)
            activity_obj['subdirectories'].sort(key=lambda x: x['value'], reverse=True)
            
            directories.append(activity_obj)
        
        # Sort activity types by display name
        directories.sort(key=lambda x: x['name'])
        
        current_app.logger.info(
            f'User {current_user_id} retrieved directory structure with {len(directories)} activity types'
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
