"""
File management routes for LockCloud
Implements file upload, listing, retrieval, and deletion endpoints
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from extensions import db
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
        required_fields = ['original_filename', 'content_type', 'size', 'activity_date', 'activity_type']
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
        activity_name = data.get('activity_name', '').strip() if data.get('activity_name') else None
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
        
        # Validate activity_name length if provided
        if activity_name and len(activity_name) > 200:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '活动名称过长（最多200字符）'
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
            current_app.logger.warning(f'File extension validation failed: {extension_validation["message"]}')
            response = jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': extension_validation['message']
                }
            })
            response.status_code = 400
            return response
        
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
            current_app.logger.warning(f'File already exists: {generated_filename}')
            response = jsonify({
                'error': {
                    'code': 'FILE_005',
                    'message': f'该目录下已存在同名文件: {generated_filename}'
                }
            })
            response.status_code = 400
            return response
        
        # Get uploader information
        from auth.models import User
        uploader = User.query.get(current_user_id)
        uploader_name = uploader.name if uploader else str(current_user_id)
        
        # Build S3 tags dictionary
        s3_tags = {
            'activity_date': activity_date_str,
            'activity_type': activity_type,
            'activity_name': activity_name or '',
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
                          'activity_date', 'activity_type']
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
        activity_name = data.get('activity_name', '').strip() if data.get('activity_name') else None
        
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
            'activity_name': activity_name or '',
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
            activity_name=activity_name,
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
        
        # Build response with display names
        file_dict = file.to_dict(include_uploader=True)
        file_dict['activity_type_display'] = activity_type_display
        
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
    
    GET /api/files?directory=/rehearsals/2025-03-session/&uploader_id=1&activity_type=regular_training&instructor=alex&date_from=2025-03-01&date_to=2025-03-31&search=training&media_type=image&tags=dance,practice&year=2025&month=3&page=1&per_page=50
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - directory: Filter by directory path (optional)
        - uploader_id: Filter by uploader user ID (optional)
        - activity_type: Filter by activity type (optional)
        - instructor: Filter by instructor (optional)
        - date_from: Filter by activity date from (ISO format, optional)
        - date_to: Filter by activity date to (ISO format, optional)
        - search: Search across filename, original_filename, and tags (optional)
        - media_type: Filter by media type ('all', 'image', 'video') (optional)
        - tags: Comma-separated list of free tag names (OR logic) (optional)
        - year: Filter by activity_date year (optional)
        - month: Filter by activity_date month (requires year) (optional)
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
        activity_name = request.args.get('activity_name', '').strip()
        activity_date_exact = request.args.get('activity_date', '').strip()  # Exact date filter
        instructor = request.args.get('instructor', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        search = request.args.get('search', '').strip()
        media_type = request.args.get('media_type', '').strip().lower()
        tags_param = request.args.get('tags', '').strip()
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
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
            # Exact directory match or subdirectory match (with trailing slash)
            # This ensures "测试目录" doesn't match "测试目录2"
            query = query.filter(
                or_(
                    File.directory == directory_normalized,  # Exact match
                    File.directory.startswith(directory_normalized + '/')  # Subdirectory match
                )
            )
        
        if uploader_id:
            query = query.filter(File.uploader_id == uploader_id)
        
        # Filter by activity_type
        if activity_type:
            query = query.filter(File.activity_type == activity_type)
        
        # Filter by activity_name
        if activity_name:
            query = query.filter(File.activity_name == activity_name)
        
        # Filter by exact activity_date
        if activity_date_exact:
            try:
                activity_date_obj = datetime.fromisoformat(activity_date_exact).date()
                query = query.filter(File.activity_date == activity_date_obj)
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '活动日期格式无效。请使用 ISO 格式 (YYYY-MM-DD)'
                    }
                }), 400
        
        # Filter by instructor
        if instructor:
            query = query.filter(File.instructor == instructor)
        
        # Filter by media_type (Requirements: 2.1, 2.2, 2.3)
        if media_type and media_type != 'all':
            if media_type == 'image':
                # Filter for image content types
                query = query.filter(
                    or_(
                        File.content_type.startswith('image/'),
                        File.content_type.like('image/%')
                    )
                )
            elif media_type == 'video':
                # Filter for video content types
                query = query.filter(
                    or_(
                        File.content_type.startswith('video/'),
                        File.content_type.like('video/%')
                    )
                )
        
        # Filter by free tags (OR logic) (Requirements: 4.1, 4.2)
        if tags_param:
            tag_names = [t.strip() for t in tags_param.split(',') if t.strip()]
            if tag_names:
                from files.models import Tag, FileTag
                # Get file IDs that have any of the specified tags
                tag_subquery = db.session.query(FileTag.file_id).join(
                    Tag, FileTag.tag_id == Tag.id
                ).filter(
                    Tag.name.in_(tag_names)
                ).distinct().subquery()
                
                query = query.filter(File.id.in_(tag_subquery))
        
        # Filter by year (Requirements: 1.2)
        if year:
            from sqlalchemy import extract
            query = query.filter(extract('year', File.activity_date) == year)
        
        # Filter by month (requires year) (Requirements: 1.3)
        if month and year:
            from sqlalchemy import extract
            query = query.filter(extract('month', File.activity_date) == month)
        
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
        
        # Build timeline summary (Requirements: 1.1, 1.4)
        # Query all files matching the current filters (without pagination) to build timeline
        from sqlalchemy import func, extract
        
        # Build a base query with the same filters for timeline calculation
        timeline_query = File.query
        
        # Apply the same filters as the main query
        if directory:
            directory_normalized = directory.strip('/')
            timeline_query = timeline_query.filter(
                or_(
                    File.directory == directory_normalized,
                    File.directory.startswith(directory_normalized + '/')
                )
            )
        if uploader_id:
            timeline_query = timeline_query.filter(File.uploader_id == uploader_id)
        if activity_type:
            timeline_query = timeline_query.filter(File.activity_type == activity_type)
        if instructor:
            timeline_query = timeline_query.filter(File.instructor == instructor)
        if media_type and media_type != 'all':
            if media_type == 'image':
                timeline_query = timeline_query.filter(File.content_type.like('image/%'))
            elif media_type == 'video':
                timeline_query = timeline_query.filter(File.content_type.like('video/%'))
        if tags_param:
            tag_names = [t.strip() for t in tags_param.split(',') if t.strip()]
            if tag_names:
                from files.models import Tag, FileTag
                tag_subquery = db.session.query(FileTag.file_id).join(
                    Tag, FileTag.tag_id == Tag.id
                ).filter(
                    Tag.name.in_(tag_names)
                ).distinct().subquery()
                timeline_query = timeline_query.filter(File.id.in_(tag_subquery))
        if search:
            search_pattern = f'%{search}%'
            timeline_query = timeline_query.filter(
                or_(
                    File.filename.ilike(search_pattern),
                    File.original_filename.ilike(search_pattern),
                    File.activity_type.ilike(search_pattern),
                    File.instructor.ilike(search_pattern)
                )
            )
        if date_from:
            try:
                date_from_obj = datetime.fromisoformat(date_from).date()
                timeline_query = timeline_query.filter(File.activity_date >= date_from_obj)
            except ValueError:
                pass
        if date_to:
            try:
                date_to_obj = datetime.fromisoformat(date_to).date()
                timeline_query = timeline_query.filter(File.activity_date <= date_to_obj)
            except ValueError:
                pass
        
        # Get timeline grouping with counts
        timeline_stats = db.session.query(
            extract('year', File.activity_date).label('year'),
            extract('month', File.activity_date).label('month'),
            func.count(File.id).label('count')
        ).filter(
            File.id.in_(timeline_query.with_entities(File.id))
        ).group_by(
            extract('year', File.activity_date),
            extract('month', File.activity_date)
        ).all()
        
        # Build timeline dictionary
        timeline = {}
        undated_count = 0
        
        for year_val, month_val, count in timeline_stats:
            if year_val is None:
                undated_count += count
            else:
                year_str = str(int(year_val))
                if year_str not in timeline:
                    timeline[year_str] = {}
                month_str = str(int(month_val)) if month_val else 'undated'
                timeline[year_str][month_str] = {'count': count}
        
        # Add undated files count if any
        if undated_count > 0:
            timeline['undated'] = {'count': undated_count}
        
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
            },
            'timeline': timeline
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
    Get hierarchical directory structure with file counts
    Structure: {year}/{month}/{date+activity_name+activity_type}
    
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
        
        from sqlalchemy import func, extract
        from services.tag_preset_service import tag_preset_service
        
        # Get activity type display names
        activity_type_presets = {p.value: p.display_name for p in tag_preset_service.get_active_presets('activity_type')}
        
        # Get file counts grouped by year, month, date, activity_name, activity_type
        file_stats = db.session.query(
            extract('year', File.activity_date).label('year'),
            extract('month', File.activity_date).label('month'),
            File.activity_date,
            File.activity_name,
            File.activity_type,
            func.count(File.id).label('file_count')
        ).filter(
            File.activity_date.isnot(None)
        ).group_by(
            extract('year', File.activity_date),
            extract('month', File.activity_date),
            File.activity_date,
            File.activity_name,
            File.activity_type
        ).all()
        
        # Build hierarchical structure: year -> month -> activity
        year_tree = {}
        
        for year, month, activity_date, activity_name, activity_type, count in file_stats:
            year_str = str(int(year)) if year else 'unknown'
            month_str = f"{int(month):02d}" if month else 'unknown'
            
            # Initialize year
            if year_str not in year_tree:
                year_tree[year_str] = {'count': 0, 'months': {}}
            year_tree[year_str]['count'] += count
            
            # Initialize month
            if month_str not in year_tree[year_str]['months']:
                year_tree[year_str]['months'][month_str] = {'count': 0, 'activities': {}}
            year_tree[year_str]['months'][month_str]['count'] += count
            
            # Build activity key: date + activity_name + activity_type
            date_str = activity_date.strftime('%m-%d') if activity_date else ''
            
            # Get activity type display name
            type_display = activity_type_presets.get(activity_type, activity_type) if activity_type else ''
            
            # Build display name for the activity folder
            if activity_name:
                activity_key = f"{date_str}_{activity_name}_{activity_type or 'unknown'}"
                activity_display = f"{date_str} {activity_name}" + (f" ({type_display})" if type_display else "")
            else:
                # Legacy files without activity_name go to "未分类"
                activity_key = f"{date_str}_未分类"
                activity_display = f"{date_str} 未分类"
            
            # Initialize activity
            if activity_key not in year_tree[year_str]['months'][month_str]['activities']:
                year_tree[year_str]['months'][month_str]['activities'][activity_key] = {
                    'display': activity_display,
                    'date': activity_date.isoformat() if activity_date else '',
                    'activity_name': activity_name or '',
                    'activity_type': activity_type or '',
                    'count': 0
                }
            year_tree[year_str]['months'][month_str]['activities'][activity_key]['count'] += count
        
        # Convert to list format for frontend
        directories = []
        
        for year, year_data in year_tree.items():
            year_obj = {
                'value': year,
                'name': f'{year}年',
                'path': year,
                'file_count': year_data['count'],
                'subdirectories': []
            }
            
            for month_str, month_data in year_data['months'].items():
                month_int = int(month_str)
                month_obj = {
                    'name': f'{month_int}月',
                    'path': f'{year}/{month_str}',
                    'file_count': month_data['count'],
                    'subdirectories': []
                }
                
                # Add activity subdirectories
                for activity_key, activity_data in month_data['activities'].items():
                    month_obj['subdirectories'].append({
                        'name': activity_data['display'],
                        'path': f"{year}/{month_str}/{activity_key}",
                        'file_count': activity_data['count'],
                        'activity_date': activity_data['date'],
                        'activity_name': activity_data['activity_name'],
                        'activity_type': activity_data['activity_type']
                    })
                
                # Sort activities by date (newest first)
                month_obj['subdirectories'].sort(
                    key=lambda x: x.get('activity_date', ''),
                    reverse=True
                )
                
                year_obj['subdirectories'].append(month_obj)
            
            # Sort months in descending order (newest first)
            year_obj['subdirectories'].sort(
                key=lambda x: int(x['name'].replace('月', '')), 
                reverse=True
            )
            
            directories.append(year_obj)
        
        # Sort years in descending order (newest first)
        directories.sort(key=lambda x: x['value'], reverse=True)
        
        current_app.logger.info(
            f'User {current_user_id} retrieved directory structure with {len(directories)} years'
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



@files_bp.route('/<int:file_id>', methods=['PATCH'])
@jwt_required()
def update_file(file_id):
    """
    Update file metadata (only by uploader)
    
    PATCH /api/files/{file_id}
    Headers: Authorization: Bearer <token>
    Body: {
        "activity_date": "2025-03-20",
        "activity_type": "performance",
        "instructor": "alex"
    }
    
    Returns:
        200: File updated successfully
        400: Invalid input or validation failed
        401: Unauthorized
        403: Not the uploader
        404: File not found
        500: Update failed
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
        
        # Verify user is the uploader or admin
        from auth.models import User
        current_user = User.query.get(current_user_id)
        is_admin = current_user and current_user.is_admin
        
        if file.uploader_id != current_user_id and not is_admin:
            return jsonify({
                'error': {
                    'code': 'FILE_002',
                    'message': '您无权编辑此文件'
                }
            }), 403
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '请求数据不能为空'
                }
            }), 400
        
        # Track if any changes were made
        changes_made = False
        old_directory = file.directory
        
        # Update activity_date if provided
        if 'activity_date' in data:
            activity_date_str = data['activity_date'].strip()
            try:
                new_activity_date = datetime.fromisoformat(activity_date_str).date()
                if file.activity_date != new_activity_date:
                    file.activity_date = new_activity_date
                    changes_made = True
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'FILE_007',
                        'message': '活动日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)'
                    }
                }), 400
        
        # Update activity_type if provided
        if 'activity_type' in data:
            activity_type = data['activity_type'].strip()
            
            # Validate activity_type
            from services.tag_preset_service import tag_preset_service
            activity_type_presets = tag_preset_service.get_active_presets('activity_type')
            valid_activity_types = [preset.value for preset in activity_type_presets]
            
            if activity_type not in valid_activity_types:
                return jsonify({
                    'error': {
                        'code': 'FILE_008',
                        'message': f'活动类型无效。有效选项: {", ".join(valid_activity_types)}'
                    }
                }), 400
            
            if file.activity_type != activity_type:
                file.activity_type = activity_type
                changes_made = True
        
        # Update instructor if provided
        if 'instructor' in data:
            instructor = data['instructor'].strip()
            
            # Validate instructor
            from services.tag_preset_service import tag_preset_service
            instructor_presets = tag_preset_service.get_active_presets('instructor')
            valid_instructors = [preset.value for preset in instructor_presets]
            
            if instructor not in valid_instructors:
                return jsonify({
                    'error': {
                        'code': 'FILE_009',
                        'message': f'带训老师标签无效。有效选项: {", ".join(valid_instructors)}'
                    }
                }), 400
            
            if file.instructor != instructor:
                file.instructor = instructor
                changes_made = True
        
        # Update activity_name if provided
        if 'activity_name' in data:
            activity_name = data['activity_name'].strip() if data['activity_name'] else None
            
            # Validate activity_name length
            if activity_name and len(activity_name) > 200:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '活动名称过长（最多200字符）'
                    }
                }), 400
            
            if file.activity_name != activity_name:
                file.activity_name = activity_name
                changes_made = True
        
        # Track if filename changed (for S3 rename)
        filename_changed = False
        old_filename = file.filename
        
        # Update filename if provided
        if 'filename' in data:
            new_filename = data['filename'].strip() if data['filename'] else None
            
            if not new_filename:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '文件名不能为空'
                    }
                }), 400
            
            # Validate filename length
            if len(new_filename) > 255:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': '文件名过长（最多255字符）'
                    }
                }), 400
            
            # Check for invalid characters
            invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
            if any(c in new_filename for c in invalid_chars):
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'文件名包含非法字符: {", ".join(invalid_chars)}'
                    }
                }), 400
            
            if file.filename != new_filename:
                file.filename = new_filename
                filename_changed = True
                changes_made = True
        
        # Update free_tags if provided
        tags_updated = False
        if 'free_tags' in data:
            from services.tag_service import tag_service
            
            new_tags = data['free_tags']
            if not isinstance(new_tags, list):
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': 'free_tags 必须是数组'
                    }
                }), 400
            
            # Get current tag names
            current_tag_names = set(t.name for t in file.tags)
            new_tag_names = set(t.strip() for t in new_tags if t and t.strip())
            
            # Remove tags that are no longer in the list
            for tag in list(file.tags):
                if tag.name not in new_tag_names:
                    tag_service.remove_tag_from_file(file.id, tag.id)
                    tags_updated = True
            
            # Add new tags
            for tag_name in new_tag_names:
                if tag_name not in current_tag_names:
                    tag_service.add_tag_to_file(file.id, tag_name, current_user_id)
                    tags_updated = True
            
            if tags_updated:
                changes_made = True
        
        if not changes_made:
            return jsonify({
                'success': True,
                'message': '没有需要更新的内容',
                'file': file.to_dict(include_uploader=True)
            }), 200
        
        # Update directory path and S3 key if activity_type, activity_date, or filename changed
        if file.activity_date and file.activity_type:
            year = file.activity_date.year
            month = f"{file.activity_date.month:02d}"
            new_directory = f"{file.activity_type}/{year}/{month}"
            
            directory_changed = new_directory != old_directory
            
            # Need to move/rename file in S3 if directory or filename changed
            if directory_changed or filename_changed:
                # Update directory if changed
                if directory_changed:
                    file.directory = new_directory
                
                # Build new S3 key
                old_s3_key = file.s3_key
                new_s3_key = f"{file.directory}/{file.filename}"
                
                # Check if new location already has a file with same name
                existing_file = File.query.filter(
                    File.s3_key == new_s3_key,
                    File.id != file_id
                ).first()
                
                if existing_file:
                    return jsonify({
                        'error': {
                            'code': 'FILE_005',
                            'message': f'目标位置已存在同名文件: {file.filename}'
                        }
                    }), 400
                
                # Move/rename file in S3
                try:
                    s3_service.copy_file(old_s3_key, new_s3_key)
                    s3_service.delete_file(old_s3_key)
                    file.s3_key = new_s3_key
                    
                    # Update public URL
                    bucket = s3_service.get_bucket_name()
                    endpoint = current_app.config.get('S3_ENDPOINT', 'https://s3.bitiful.net')
                    file.public_url = f"{endpoint}/{bucket}/{new_s3_key}"
                    
                except Exception as e:
                    current_app.logger.error(f'Failed to move/rename file in S3: {str(e)}')
                    return jsonify({
                        'error': {
                            'code': 'S3_001',
                            'message': '移动/重命名文件失败'
                        }
                    }), 500
        
        # Update S3 tags
        from auth.models import User
        uploader = User.query.get(current_user_id)
        uploader_name = uploader.name if uploader else str(current_user_id)
        
        s3_tags = {
            'activity_date': file.activity_date.isoformat() if file.activity_date else '',
            'activity_type': file.activity_type or '',
            'instructor': file.instructor or '',
            'uploader_name': uploader_name,
            'upload_timestamp': file.uploaded_at.isoformat() + 'Z' if file.uploaded_at else '',
            'original_filename': file.original_filename or file.filename
        }
        
        try:
            s3_service.update_object_tags(file.s3_key, s3_tags)
        except Exception as e:
            current_app.logger.warning(f'Failed to update tags for {file.s3_key}: {str(e)}')
            # Don't fail the update if tagging fails
        
        # Create log entry
        log = FileLog.create_log(
            user_id=current_user_id,
            operation=OperationType.UPDATE,
            file_id=file.id,
            file_path=file.s3_key,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        db.session.add(log)
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} updated file {file_id}: {file.s3_key}'
        )
        
        # Get tag preset display names for response
        from services.tag_preset_service import tag_preset_service
        
        activity_type_preset = next(
            (p for p in tag_preset_service.get_active_presets('activity_type') if p.value == file.activity_type),
            None
        )
        activity_type_display = activity_type_preset.display_name if activity_type_preset else file.activity_type
        
        instructor_preset = next(
            (p for p in tag_preset_service.get_active_presets('instructor') if p.value == file.instructor),
            None
        )
        instructor_display = instructor_preset.display_name if instructor_preset else file.instructor
        
        # Build response with display names
        file_dict = file.to_dict(include_uploader=True)
        file_dict['activity_type_display'] = activity_type_display
        file_dict['instructor_display'] = instructor_display
        
        return jsonify({
            'success': True,
            'message': '文件信息更新成功',
            'file': file_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '更新文件信息失败，请稍后重试'
            }
        }), 500


@files_bp.route('/check-filenames', methods=['POST'])
@jwt_required()
def check_filenames():
    """
    Check if filenames already exist in the database for a specific directory
    
    POST /api/files/check-filenames
    Headers: Authorization: Bearer <token>
    Body: {
        "filenames": ["file1.mp4", "file2.jpg"],
        "activity_date": "2025-03-15",
        "activity_type": "regular_training"
    }
    
    Returns:
        200: Check completed successfully
        {
            "success": true,
            "existing_files": ["file1.mp4"],  // Files that already exist
            "available_files": ["file2.jpg"]   // Files that don't exist
        }
        400: Invalid input
        401: Unauthorized
        500: Check failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': {
                    'code': 'INVALID_INPUT',
                    'message': '请求数据不能为空'
                }
            }), 400
        
        filenames = data.get('filenames', [])
        activity_date_str = data.get('activity_date')
        activity_type = data.get('activity_type')
        
        # Validate input
        if not filenames or not isinstance(filenames, list):
            return jsonify({
                'error': {
                    'code': 'INVALID_INPUT',
                    'message': '文件名列表不能为空'
                }
            }), 400
        
        if not activity_date_str or not activity_type:
            return jsonify({
                'error': {
                    'code': 'INVALID_INPUT',
                    'message': '活动日期和活动类型不能为空'
                }
            }), 400
        
        # Parse activity date
        try:
            activity_date = datetime.strptime(activity_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'INVALID_DATE',
                    'message': '活动日期格式无效，应为YYYY-MM-DD'
                }
            }), 400
        
        year = activity_date.year
        month = activity_date.month
        
        # Query existing files in the same directory (activity_type/year/month)
        existing_files_query = File.query.filter(
            File.activity_type == activity_type,
            db.func.extract('year', File.activity_date) == year,
            db.func.extract('month', File.activity_date) == month,
            File.filename.in_(filenames)
        ).all()
        
        # Get list of existing filenames
        existing_filenames = [f.filename for f in existing_files_query]
        available_filenames = [f for f in filenames if f not in existing_filenames]
        
        current_app.logger.info(
            f'User {current_user_id} checked {len(filenames)} filenames, '
            f'{len(existing_filenames)} exist, {len(available_filenames)} available'
        )
        
        return jsonify({
            'success': True,
            'existing_files': existing_filenames,
            'available_files': available_filenames
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error checking filenames: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '检查文件名失败，请稍后重试'
            }
        }), 500



@files_bp.route('/<int:file_id>/adjacent', methods=['GET'])
@jwt_required()
def get_adjacent_files(file_id):
    """
    Get previous and next files in the same directory hierarchy
    
    GET /api/files/<file_id>/adjacent
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Adjacent files retrieved successfully
        {
            "previous": { file object } or null,
            "next": { file object } or null
        }
        404: File not found
        401: Unauthorized
        500: Retrieval failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get the current file
        current_file = File.query.get(file_id)
        if not current_file:
            return jsonify({
                'error': {
                    'code': 'FILE_NOT_FOUND',
                    'message': '文件不存在'
                }
            }), 404
        
        # Get all files in the same directory, ordered by activity_date DESC, then filename ASC
        # This ensures files are sorted by date (newest first), then alphabetically
        same_directory_files = File.query.filter(
            File.directory == current_file.directory
        ).order_by(
            File.activity_date.desc(),
            File.filename.asc()
        ).all()
        
        # Find current file index
        current_index = None
        for i, f in enumerate(same_directory_files):
            if f.id == file_id:
                current_index = i
                break
        
        if current_index is None:
            return jsonify({
                'error': {
                    'code': 'FILE_NOT_FOUND',
                    'message': '文件不存在'
                }
            }), 404
        
        # Get previous and next files (simple navigation within directory)
        previous_file = None
        next_file = None
        
        if current_index > 0:
            previous_file = same_directory_files[current_index - 1]
        
        if current_index < len(same_directory_files) - 1:
            next_file = same_directory_files[current_index + 1]
        
        # If at directory boundaries, try to find files in adjacent directories
        if previous_file is None or next_file is None:
            # Parse directory path
            dir_parts = current_file.directory.split('/')
            
            if len(dir_parts) >= 3:  # e.g., "regular_training/2025/11"
                activity_type = dir_parts[0]
                
                # Get all directories for this activity type, sorted
                all_dirs = db.session.query(File.directory).filter(
                    File.directory.like(f"{activity_type}/%")
                ).distinct().order_by(File.directory.desc()).all()  # DESC for newest first
                
                all_dirs = [d[0] for d in all_dirs]
                
                # Find current directory index
                try:
                    current_dir_index = all_dirs.index(current_file.directory)
                except ValueError:
                    current_dir_index = -1
                
                # Get previous directory's last file if needed
                if previous_file is None and current_dir_index > 0:
                    prev_dir = all_dirs[current_dir_index - 1]
                    previous_file = File.query.filter(
                        File.directory == prev_dir
                    ).order_by(
                        File.activity_date.desc(),
                        File.filename.desc()
                    ).first()
                
                # Get next directory's first file if needed
                if next_file is None and current_dir_index < len(all_dirs) - 1:
                    next_dir = all_dirs[current_dir_index + 1]
                    next_file = File.query.filter(
                        File.directory == next_dir
                    ).order_by(
                        File.activity_date.desc(),
                        File.filename.asc()
                    ).first()
                
                # If still no adjacent files, wrap around
                if previous_file is None and len(all_dirs) > 1:
                    # Wrap to last directory's last file
                    last_dir = all_dirs[-1]
                    previous_file = File.query.filter(
                        File.directory == last_dir
                    ).order_by(
                        File.activity_date.desc(),
                        File.filename.desc()
                    ).first()
                
                if next_file is None and len(all_dirs) > 1:
                    # Wrap to first directory's first file
                    first_dir = all_dirs[0]
                    next_file = File.query.filter(
                        File.directory == first_dir
                    ).order_by(
                        File.activity_date.desc(),
                        File.filename.asc()
                    ).first()
        
        # Convert to dict
        result = {
            'previous': previous_file.to_dict() if previous_file else None,
            'next': next_file.to_dict() if next_file else None
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting adjacent files: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取相邻文件失败，请稍后重试'
            }
        }), 500



# ============================================================================
# File-Tag Association Endpoints
# ============================================================================

@files_bp.route('/<int:file_id>/tags', methods=['GET'])
@jwt_required()
def get_file_tags(file_id):
    """
    Get all tags associated with a file
    
    GET /api/files/{file_id}/tags
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Tags retrieved successfully
        401: Unauthorized
        404: File not found
        500: Query failed
    
    Requirements: 3.4
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        from services.tag_service import tag_service
        
        try:
            tags = tag_service.get_file_tags(file_id)
        except LookupError:
            return jsonify({
                'error': {
                    'code': 'FILE_010',
                    'message': '文件不存在'
                }
            }), 404
        
        current_app.logger.info(
            f'User {current_user_id} retrieved {len(tags)} tags for file {file_id}'
        )
        
        return jsonify({
            'success': True,
            'tags': [{'id': t.id, 'name': t.name} for t in tags]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting tags for file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取文件标签失败，请稍后重试'
            }
        }), 500


@files_bp.route('/<int:file_id>/tags', methods=['POST'])
@jwt_required()
def add_file_tag(file_id):
    """
    Add a tag to a file
    
    POST /api/files/{file_id}/tags
    Headers: Authorization: Bearer <token>
    Body: {
        "tag_name": "favorite"
    }
    
    Returns:
        201: Tag added successfully
        400: Invalid input or tag already exists on file
        401: Unauthorized
        404: File not found
        500: Operation failed
    
    Requirements: 3.1
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json()
        
        if not data or 'tag_name' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少必填字段: tag_name'
                }
            }), 400
        
        tag_name = data['tag_name']
        
        if not tag_name or not tag_name.strip():
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': '标签名称不能为空'
                }
            }), 400
        
        # Validate tag name length
        if len(tag_name.strip()) > 100:
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': '标签名称过长（最多100字符）'
                }
            }), 400
        
        from services.tag_service import tag_service
        
        try:
            file_tag = tag_service.add_tag_to_file(file_id, tag_name, current_user_id)
        except LookupError:
            return jsonify({
                'error': {
                    'code': 'FILE_010',
                    'message': '文件不存在'
                }
            }), 404
        except ValueError as e:
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': str(e)
                }
            }), 400
        
        # Get the tag details
        from files.models import Tag
        tag = Tag.query.get(file_tag.tag_id)
        
        current_app.logger.info(
            f'User {current_user_id} added tag "{tag.name}" to file {file_id}'
        )
        
        return jsonify({
            'success': True,
            'message': '标签添加成功',
            'tag': {'id': tag.id, 'name': tag.name}
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Error adding tag to file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '添加标签失败，请稍后重试'
            }
        }), 500


@files_bp.route('/<int:file_id>/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def remove_file_tag(file_id, tag_id):
    """
    Remove a tag from a file
    
    DELETE /api/files/{file_id}/tags/{tag_id}
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Tag removed successfully
        401: Unauthorized
        404: File or tag association not found
        500: Operation failed
    
    Requirements: 3.3
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Verify file exists
        file = File.query.get(file_id)
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_010',
                    'message': '文件不存在'
                }
            }), 404
        
        from services.tag_service import tag_service
        
        removed = tag_service.remove_tag_from_file(file_id, tag_id)
        
        if not removed:
            return jsonify({
                'error': {
                    'code': 'TAG_001',
                    'message': '该文件没有此标签'
                }
            }), 404
        
        current_app.logger.info(
            f'User {current_user_id} removed tag {tag_id} from file {file_id}'
        )
        
        return jsonify({
            'success': True,
            'message': '标签移除成功'
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': str(e)
            }
        }), 400
    except Exception as e:
        current_app.logger.error(f'Error removing tag {tag_id} from file {file_id}: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '移除标签失败，请稍后重试'
            }
        }), 500


# ============================================================================
# Batch Operations Endpoints
# ============================================================================

@files_bp.route('/batch/delete', methods=['POST'])
@jwt_required()
def batch_delete_files():
    """
    Batch delete multiple files
    
    POST /api/files/batch/delete
    Headers: Authorization: Bearer <token>
    Body: {
        "file_ids": [1, 2, 3, ...]
    }
    
    Returns:
        200: All files deleted successfully
        207: Partial success (some files failed)
        400: Invalid input
        401: Unauthorized
        500: Operation failed
    
    Requirements: 5.4
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json()
        
        if not data or 'file_ids' not in data:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '缺少必填字段: file_ids'
                }
            }), 400
        
        file_ids = data['file_ids']
        
        if not file_ids or not isinstance(file_ids, list):
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '文件ID列表不能为空'
                }
            }), 400
        
        # Validate batch size limit (max 100)
        if len(file_ids) > 100:
            return jsonify({
                'error': {
                    'code': 'BATCH_002',
                    'message': '批量操作限制最多100个文件'
                }
            }), 400
        
        succeeded = []
        failed = []
        
        for file_id in file_ids:
            try:
                # Find file by ID
                file = File.query.get(file_id)
                
                if not file:
                    failed.append({
                        'file_id': file_id,
                        'error': '文件不存在'
                    })
                    continue
                
                # Verify user is the uploader
                if file.uploader_id != current_user_id:
                    failed.append({
                        'file_id': file_id,
                        'error': '无权删除此文件'
                    })
                    continue
                
                # Delete file from S3
                try:
                    s3_service.delete_file(file.s3_key)
                except Exception as e:
                    current_app.logger.error(f'Failed to delete file {file_id} from S3: {str(e)}')
                    failed.append({
                        'file_id': file_id,
                        'error': 'S3删除失败'
                    })
                    continue
                
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
                succeeded.append(file_id)
                
            except Exception as e:
                current_app.logger.error(f'Error deleting file {file_id}: {str(e)}')
                failed.append({
                    'file_id': file_id,
                    'error': '删除失败'
                })
        
        # Commit all successful deletions
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} batch deleted {len(succeeded)} files, {len(failed)} failed'
        )
        
        # Return appropriate status code
        if len(failed) == 0:
            return jsonify({
                'success': True,
                'message': f'成功删除 {len(succeeded)} 个文件',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 200
        elif len(succeeded) == 0:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': '所有文件删除失败',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 400
        else:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 207
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error in batch delete: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '批量删除失败，请稍后重试'
            }
        }), 500


@files_bp.route('/batch/tags', methods=['POST'])
@jwt_required()
def batch_add_tag():
    """
    Batch add a tag to multiple files
    
    POST /api/files/batch/tags
    Headers: Authorization: Bearer <token>
    Body: {
        "file_ids": [1, 2, 3, ...],
        "tag_name": "favorite"
    }
    
    Returns:
        200: Tag added to all files successfully
        207: Partial success (some files failed)
        400: Invalid input
        401: Unauthorized
        500: Operation failed
    
    Requirements: 5.5
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '请求数据不能为空'
                }
            }), 400
        
        file_ids = data.get('file_ids')
        tag_name = data.get('tag_name')
        
        if not file_ids or not isinstance(file_ids, list):
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '文件ID列表不能为空'
                }
            }), 400
        
        if not tag_name or not tag_name.strip():
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': '标签名称不能为空'
                }
            }), 400
        
        # Validate tag name length
        if len(tag_name.strip()) > 100:
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': '标签名称过长（最多100字符）'
                }
            }), 400
        
        # Validate batch size limit (max 100)
        if len(file_ids) > 100:
            return jsonify({
                'error': {
                    'code': 'BATCH_002',
                    'message': '批量操作限制最多100个文件'
                }
            }), 400
        
        from services.tag_service import tag_service
        
        # Get or create the tag first
        try:
            tag = tag_service.get_or_create_tag(tag_name, current_user_id)
        except ValueError as e:
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': str(e)
                }
            }), 400
        
        succeeded = []
        failed = []
        
        for file_id in file_ids:
            try:
                # Verify file exists
                file = File.query.get(file_id)
                if not file:
                    failed.append({
                        'file_id': file_id,
                        'error': '文件不存在'
                    })
                    continue
                
                # Check if association already exists
                from files.models import FileTag
                existing = FileTag.query.filter_by(
                    file_id=file_id,
                    tag_id=tag.id
                ).first()
                
                if existing:
                    # Already has the tag, count as success
                    succeeded.append(file_id)
                    continue
                
                # Create new association
                file_tag = FileTag(file_id=file_id, tag_id=tag.id)
                db.session.add(file_tag)
                succeeded.append(file_id)
                
            except Exception as e:
                current_app.logger.error(f'Error adding tag to file {file_id}: {str(e)}')
                failed.append({
                    'file_id': file_id,
                    'error': '添加标签失败'
                })
        
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} batch added tag "{tag.name}" to {len(succeeded)} files, {len(failed)} failed'
        )
        
        # Return appropriate status code
        if len(failed) == 0:
            return jsonify({
                'success': True,
                'message': f'成功为 {len(succeeded)} 个文件添加标签',
                'tag': {'id': tag.id, 'name': tag.name},
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 200
        elif len(succeeded) == 0:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': '所有文件添加标签失败',
                'tag': {'id': tag.id, 'name': tag.name},
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 400
        else:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}',
                'tag': {'id': tag.id, 'name': tag.name},
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 207
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error in batch add tag: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '批量添加标签失败，请稍后重试'
            }
        }), 500


@files_bp.route('/batch/tags', methods=['DELETE'])
@jwt_required()
def batch_remove_tag():
    """
    Batch remove a tag from multiple files
    
    DELETE /api/files/batch/tags
    Headers: Authorization: Bearer <token>
    Body: {
        "file_ids": [1, 2, 3, ...],
        "tag_id": 5
    }
    
    Returns:
        200: Tag removed from all files successfully
        207: Partial success (some files failed)
        400: Invalid input
        401: Unauthorized
        404: Tag not found
        500: Operation failed
    
    Requirements: 5.6
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '请求数据不能为空'
                }
            }), 400
        
        file_ids = data.get('file_ids')
        tag_id = data.get('tag_id')
        
        if not file_ids or not isinstance(file_ids, list):
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '文件ID列表不能为空'
                }
            }), 400
        
        if not tag_id:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少必填字段: tag_id'
                }
            }), 400
        
        # Validate batch size limit (max 100)
        if len(file_ids) > 100:
            return jsonify({
                'error': {
                    'code': 'BATCH_002',
                    'message': '批量操作限制最多100个文件'
                }
            }), 400
        
        # Verify tag exists
        from files.models import Tag, FileTag
        tag = Tag.query.get(tag_id)
        if not tag:
            return jsonify({
                'error': {
                    'code': 'TAG_001',
                    'message': '标签不存在'
                }
            }), 404
        
        succeeded = []
        failed = []
        
        for file_id in file_ids:
            try:
                # Verify file exists
                file = File.query.get(file_id)
                if not file:
                    failed.append({
                        'file_id': file_id,
                        'error': '文件不存在'
                    })
                    continue
                
                # Find and delete the association
                file_tag = FileTag.query.filter_by(
                    file_id=file_id,
                    tag_id=tag_id
                ).first()
                
                if file_tag:
                    db.session.delete(file_tag)
                    succeeded.append(file_id)
                else:
                    # File doesn't have this tag, count as success (idempotent)
                    succeeded.append(file_id)
                
            except Exception as e:
                current_app.logger.error(f'Error removing tag from file {file_id}: {str(e)}')
                failed.append({
                    'file_id': file_id,
                    'error': '移除标签失败'
                })
        
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} batch removed tag {tag_id} from {len(succeeded)} files, {len(failed)} failed'
        )
        
        # Return appropriate status code
        if len(failed) == 0:
            return jsonify({
                'success': True,
                'message': f'成功从 {len(succeeded)} 个文件移除标签',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 200
        elif len(succeeded) == 0:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': '所有文件移除标签失败',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 400
        else:
            return jsonify({
                'success': False,
                'code': 'TAG_004',
                'message': f'部分操作失败: 成功 {len(succeeded)}, 失败 {len(failed)}',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 207
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error in batch remove tag: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '批量移除标签失败，请稍后重试'
            }
        }), 500


@files_bp.route('/batch/update', methods=['POST'])
@jwt_required()
def batch_update_files():
    """
    Batch update multiple files (owner or admin only)
    
    POST /api/files/batch/update
    Headers: Authorization: Bearer <token>
    Body: {
        "file_ids": [1, 2, 3],
        "updates": {
            "activity_date": "2025-03-20",
            "activity_type": "performance",
            "activity_name": "新活动名称",
            "free_tags": ["tag1", "tag2"],
            "tag_mode": "add" | "replace"
        }
    }
    
    Returns:
        200: All files updated successfully
        207: Partial success (some files failed)
        400: Invalid input
        401: Unauthorized
        500: Update failed
    """
    try:
        from auth.models import User
        from services.tag_service import tag_service
        from services.tag_preset_service import tag_preset_service
        
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        is_admin = current_user and current_user.is_admin
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '请求数据不能为空'
                }
            }), 400
        
        file_ids = data.get('file_ids', [])
        updates = data.get('updates', {})
        
        if not file_ids:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '文件ID列表不能为空'
                }
            }), 400
        
        if not updates:
            return jsonify({
                'error': {
                    'code': 'BATCH_001',
                    'message': '更新内容不能为空'
                }
            }), 400
        
        # Validate batch size limit (max 100)
        if len(file_ids) > 100:
            return jsonify({
                'error': {
                    'code': 'BATCH_002',
                    'message': '批量操作限制最多100个文件'
                }
            }), 400
        
        # Validate activity_type if provided
        if 'activity_type' in updates and updates['activity_type']:
            activity_type_presets = tag_preset_service.get_active_presets('activity_type')
            valid_activity_types = [preset.value for preset in activity_type_presets]
            if updates['activity_type'] not in valid_activity_types:
                return jsonify({
                    'error': {
                        'code': 'FILE_008',
                        'message': f'活动类型无效。有效选项: {", ".join(valid_activity_types)}'
                    }
                }), 400
        
        # Validate activity_date if provided
        new_activity_date = None
        if 'activity_date' in updates and updates['activity_date']:
            try:
                new_activity_date = datetime.fromisoformat(updates['activity_date']).date()
            except ValueError:
                return jsonify({
                    'error': {
                        'code': 'FILE_007',
                        'message': '活动日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)'
                    }
                }), 400
        
        # Get tag mode
        tag_mode = updates.get('tag_mode', 'add')  # 'add' or 'replace'
        new_tags = updates.get('free_tags', [])
        
        succeeded = []
        failed = []
        
        # Get all files
        files = File.query.filter(File.id.in_(file_ids)).all()
        file_map = {f.id: f for f in files}
        
        for file_id in file_ids:
            file = file_map.get(file_id)
            
            if not file:
                failed.append({
                    'file_id': file_id,
                    'error': '文件不存在'
                })
                continue
            
            # Check permission
            if file.uploader_id != current_user_id and not is_admin:
                failed.append({
                    'file_id': file_id,
                    'error': '无权编辑此文件'
                })
                continue
            
            try:
                # Apply updates
                if new_activity_date:
                    file.activity_date = new_activity_date
                
                if 'activity_type' in updates and updates['activity_type']:
                    file.activity_type = updates['activity_type']
                
                if 'activity_name' in updates:
                    file.activity_name = updates['activity_name'] if updates['activity_name'] else None
                
                # Handle tags
                if new_tags:
                    if tag_mode == 'replace':
                        # Remove all existing tags
                        for tag in list(file.tags):
                            tag_service.remove_tag_from_file(file.id, tag.id)
                    
                    # Add new tags
                    current_tag_names = set(t.name for t in file.tags)
                    for tag_name in new_tags:
                        tag_name = tag_name.strip()
                        if tag_name and tag_name not in current_tag_names:
                            tag_service.add_tag_to_file(file.id, tag_name, current_user_id)
                
                # Update directory path if needed
                if file.activity_date and file.activity_type:
                    year = file.activity_date.year
                    month = f"{file.activity_date.month:02d}"
                    new_directory = f"{file.activity_type}/{year}/{month}"
                    
                    if new_directory != file.directory:
                        old_s3_key = file.s3_key
                        file.directory = new_directory
                        new_s3_key = f"{new_directory}/{file.filename}"
                        
                        # Check for duplicate
                        existing = File.query.filter(
                            File.s3_key == new_s3_key,
                            File.id != file.id
                        ).first()
                        
                        if existing:
                            failed.append({
                                'file_id': file_id,
                                'error': f'目标位置已存在同名文件: {file.filename}'
                            })
                            db.session.rollback()
                            continue
                        
                        # Move file in S3
                        try:
                            s3_service.copy_file(old_s3_key, new_s3_key)
                            s3_service.delete_file(old_s3_key)
                            file.s3_key = new_s3_key
                            
                            bucket = s3_service.get_bucket_name()
                            endpoint = current_app.config.get('S3_ENDPOINT', 'https://s3.bitiful.net')
                            file.public_url = f"{endpoint}/{bucket}/{new_s3_key}"
                        except Exception as e:
                            current_app.logger.error(f'Failed to move file {file_id} in S3: {str(e)}')
                            failed.append({
                                'file_id': file_id,
                                'error': '移动文件失败'
                            })
                            db.session.rollback()
                            continue
                
                succeeded.append(file_id)
                
            except Exception as e:
                current_app.logger.error(f'Error updating file {file_id}: {str(e)}')
                failed.append({
                    'file_id': file_id,
                    'error': str(e)
                })
        
        # Commit all successful updates
        if succeeded:
            db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} batch updated {len(succeeded)} files, {len(failed)} failed'
        )
        
        # Return appropriate response
        if len(failed) == 0:
            return jsonify({
                'success': True,
                'message': f'成功更新 {len(succeeded)} 个文件',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 200
        elif len(succeeded) == 0:
            return jsonify({
                'success': False,
                'message': '所有文件更新失败',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 400
        else:
            return jsonify({
                'success': False,
                'code': 'PARTIAL_SUCCESS',
                'message': f'部分成功: {len(succeeded)} 成功, {len(failed)} 失败',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 207
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error in batch update: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '批量更新失败，请稍后重试'
            }
        }), 500


# ============================================================================
# Activity Names Endpoints
# ============================================================================

@files_bp.route('/activity-names', methods=['GET'])
@jwt_required()
def get_activity_names_by_date():
    """
    Get unique activity names for a specific date
    
    GET /api/files/activity-names?date=2025-03-15
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - date: Activity date in ISO format (YYYY-MM-DD, required)
    
    Returns:
        200: Activity names retrieved successfully
        400: Invalid or missing date parameter
        401: Unauthorized
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Get date parameter
        date_str = request.args.get('date', '').strip()
        
        if not date_str:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少必填参数: date'
                }
            }), 400
        
        # Parse date
        try:
            activity_date = datetime.fromisoformat(date_str).date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)'
                }
            }), 400
        
        # Query unique activity names for the date with their activity types
        from sqlalchemy import func
        
        results = db.session.query(
            File.activity_name,
            File.activity_type,
            func.count(File.id).label('file_count')
        ).filter(
            File.activity_date == activity_date,
            File.activity_name.isnot(None),
            File.activity_name != ''
        ).group_by(
            File.activity_name,
            File.activity_type
        ).order_by(
            File.activity_name
        ).all()
        
        # Get activity type display names
        from services.tag_preset_service import tag_preset_service
        activity_type_presets = {
            p.value: p.display_name 
            for p in tag_preset_service.get_active_presets('activity_type')
        }
        
        # Build response
        activity_names = []
        for activity_name, activity_type, file_count in results:
            activity_names.append({
                'name': activity_name,
                'activity_type': activity_type,
                'activity_type_display': activity_type_presets.get(activity_type, activity_type),
                'file_count': file_count
            })
        
        current_app.logger.info(
            f'User {current_user_id} retrieved {len(activity_names)} activity names for date {date_str}'
        )
        
        return jsonify({
            'success': True,
            'date': date_str,
            'activity_names': activity_names
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting activity names: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取活动名称失败，请稍后重试'
            }
        }), 500


# ============================================================================
# Activity Directory Management Endpoints
# ============================================================================

@files_bp.route('/activity-directory', methods=['GET'])
@jwt_required()
def get_activity_directory_info():
    """
    Get activity directory information including owner
    
    GET /api/files/activity-directory?activity_date=2025-03-15&activity_name=周末团建&activity_type=team_building
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - activity_date: Activity date in ISO format (YYYY-MM-DD, required)
        - activity_name: Activity name (required)
        - activity_type: Activity type (required)
    
    Returns:
        200: Directory info retrieved successfully
        400: Invalid or missing parameters
        401: Unauthorized
        404: Directory not found
        500: Query failed
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        activity_date_str = request.args.get('activity_date', '').strip()
        activity_name = request.args.get('activity_name', '').strip()
        activity_type = request.args.get('activity_type', '').strip()
        
        if not activity_date_str or not activity_name or not activity_type:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少必填参数: activity_date, activity_name, activity_type'
                }
            }), 400
        
        # Parse date
        try:
            activity_date = datetime.fromisoformat(activity_date_str).date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '日期格式无效，请使用 ISO 格式 (YYYY-MM-DD)'
                }
            }), 400
        
        # Find the first file in this directory (owner is the first uploader)
        first_file = File.query.filter(
            File.activity_date == activity_date,
            File.activity_name == activity_name,
            File.activity_type == activity_type
        ).order_by(File.uploaded_at.asc()).first()
        
        if not first_file:
            return jsonify({
                'error': {
                    'code': 'DIR_001',
                    'message': '目录不存在'
                }
            }), 404
        
        # Get file count
        file_count = File.query.filter(
            File.activity_date == activity_date,
            File.activity_name == activity_name,
            File.activity_type == activity_type
        ).count()
        
        # Get owner info and current user info
        from auth.models import User
        owner = User.query.get(first_file.uploader_id)
        current_user = User.query.get(current_user_id)
        
        # Check if current user is owner or admin
        is_owner_or_admin = current_user_id == first_file.uploader_id or (current_user and current_user.is_admin)
        
        # Get activity type display name
        from services.tag_preset_service import tag_preset_service
        activity_type_presets = {
            p.value: p.display_name 
            for p in tag_preset_service.get_active_presets('activity_type')
        }
        
        return jsonify({
            'success': True,
            'directory': {
                'activity_date': activity_date_str,
                'activity_name': activity_name,
                'activity_type': activity_type,
                'activity_type_display': activity_type_presets.get(activity_type, activity_type),
                'file_count': file_count,
                'owner_id': first_file.uploader_id,
                'owner_name': owner.name if owner else str(first_file.uploader_id),
                'created_at': first_file.uploaded_at.isoformat() if first_file.uploaded_at else None,
                'is_owner': is_owner_or_admin
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting activity directory info: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取目录信息失败，请稍后重试'
            }
        }), 500


@files_bp.route('/activity-directory', methods=['PATCH'])
@jwt_required()
def update_activity_directory():
    """
    Update activity directory (rename activity_name or change activity_type)
    Only the directory owner can update directly, others need to submit a request
    
    PATCH /api/files/activity-directory
    Headers: Authorization: Bearer <token>
    Body: {
        "activity_date": "2025-03-15",
        "activity_name": "周末团建",
        "activity_type": "team_building",
        "new_activity_name": "新活动名称",
        "new_activity_type": "special_event"
    }
    
    Returns:
        200: Directory updated successfully
        400: Invalid input
        401: Unauthorized
        403: Not the owner, need to submit request
        404: Directory not found
        500: Update failed
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['activity_date', 'activity_name', 'activity_type']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        activity_date_str = data['activity_date'].strip()
        activity_name = data['activity_name'].strip()
        activity_type = data['activity_type'].strip()
        new_activity_name = data.get('new_activity_name', '').strip() if data.get('new_activity_name') else None
        new_activity_type = data.get('new_activity_type', '').strip() if data.get('new_activity_type') else None
        
        if not new_activity_name and not new_activity_type:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '请提供要修改的内容 (new_activity_name 或 new_activity_type)'
                }
            }), 400
        
        # Parse date
        try:
            activity_date = datetime.fromisoformat(activity_date_str).date()
        except ValueError:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '日期格式无效'
                }
            }), 400
        
        # Validate new_activity_type if provided
        if new_activity_type:
            from services.tag_preset_service import tag_preset_service
            activity_type_presets = tag_preset_service.get_active_presets('activity_type')
            valid_types = [p.value for p in activity_type_presets]
            if new_activity_type not in valid_types:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'无效的活动类型。有效选项: {", ".join(valid_types)}'
                    }
                }), 400
        
        # Find the first file to determine owner
        first_file = File.query.filter(
            File.activity_date == activity_date,
            File.activity_name == activity_name,
            File.activity_type == activity_type
        ).order_by(File.uploaded_at.asc()).first()
        
        if not first_file:
            return jsonify({
                'error': {
                    'code': 'DIR_001',
                    'message': '目录不存在'
                }
            }), 404
        
        # Check if current user is the owner or admin
        from auth.models import User
        current_user = User.query.get(current_user_id)
        is_owner_or_admin = current_user_id == first_file.uploader_id or (current_user and current_user.is_admin)
        
        if not is_owner_or_admin:
            # Not the owner or admin - need to submit a request
            return jsonify({
                'error': {
                    'code': 'DIR_002',
                    'message': '您不是该目录的所有者，需要提交修改申请',
                    'owner_id': first_file.uploader_id,
                    'need_request': True
                }
            }), 403
        
        # Owner can update directly
        files_to_update = File.query.filter(
            File.activity_date == activity_date,
            File.activity_name == activity_name,
            File.activity_type == activity_type
        ).all()
        
        updated_count = 0
        for file in files_to_update:
            if new_activity_name:
                file.activity_name = new_activity_name
            if new_activity_type:
                # Only update the activity_type field, not directory or s3_key
                # S3 files remain in their original location
                file.activity_type = new_activity_type
            updated_count += 1
        
        db.session.commit()
        
        # Create log entry
        log = FileLog.create_log(
            user_id=current_user_id,
            operation=OperationType.UPDATE,
            file_id=first_file.id,
            file_path=f"目录更新: {activity_name} -> {new_activity_name or activity_name}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        db.session.add(log)
        db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} updated activity directory: {activity_name} ({updated_count} files)'
        )
        
        return jsonify({
            'success': True,
            'message': f'已更新 {updated_count} 个文件',
            'updated_count': updated_count,
            'new_activity_name': new_activity_name or activity_name,
            'new_activity_type': new_activity_type or activity_type
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating activity directory: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '更新目录失败，请稍后重试'
            }
        }), 500
