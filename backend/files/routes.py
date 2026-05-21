"""
File management routes for LockCloud
Implements file upload, listing, retrieval, and deletion endpoints
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, make_response, redirect
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
from services.s3_public_service import S3PublicService
from logs.models import FileLog, OperationType
import threading


def _trigger_video_transcode_preheat(s3_key: str):
    """
    异步触发视频 HLS 转码预热
    全量预热 1080p 的所有 .ts 分片
    """
    def do_preheat():
        import requests
        
        try:
            # 1. 先请求主播放列表
            hls_key = f"{s3_key}!style:medium/auto_medium.m3u8"
            signed_url = s3_service.generate_signed_url(key=hls_key, expiration=300)
            
            current_app.logger.info(f'[Preheat] Triggering transcode for: {s3_key}')
            resp = requests.get(signed_url, timeout=30)
            
            if resp.status_code != 200:
                current_app.logger.warning(f'[Preheat] Master playlist returned {resp.status_code} for: {s3_key}')
                return
            
            current_app.logger.info(f'[Preheat] Master playlist ready for: {s3_key}')
            
            # 2. 请求 1080p 播放列表，获取分片列表
            try:
                quality_key = f"{s3_key}!style:medium/1080p_medium.m3u8"
                quality_url = s3_service.generate_signed_url(key=quality_key, expiration=600)
                quality_resp = requests.get(quality_url, timeout=120)
                
                if quality_resp.status_code != 200:
                    current_app.logger.warning(f'[Preheat] 1080p playlist failed: {quality_resp.status_code}')
                    return
                
                # 3. 解析 m3u8 获取所有 .ts 分片
                m3u8_content = quality_resp.text
                segments = []
                for line in m3u8_content.split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        if line.endswith('.ts') or '.ts' in line:
                            segments.append(line)
                
                current_app.logger.info(f'[Preheat] Found {len(segments)} segments for: {s3_key}')
                
                # 4. 逐个预热所有 .ts 分片
                segments_ok = 0
                for segment in segments:
                    try:
                        segment_key = f"{s3_key}!style:medium/{segment}"
                        segment_url = s3_service.generate_signed_url(key=segment_key, expiration=600)
                        
                        # 使用 Range 请求只获取前 1 字节，减少带宽
                        seg_resp = requests.get(
                            segment_url, 
                            timeout=180,
                            headers={'Range': 'bytes=0-0'}
                        )
                        
                        if seg_resp.status_code in (200, 206):
                            segments_ok += 1
                    except Exception as e:
                        current_app.logger.warning(f'[Preheat] Segment failed: {segment} - {str(e)}')
                
                current_app.logger.info(f'[Preheat] Preheated {segments_ok}/{len(segments)} segments for: {s3_key}')
                
            except Exception as e:
                current_app.logger.warning(f'[Preheat] Failed to preheat 1080p: {str(e)}')
                
        except Exception as e:
            current_app.logger.error(f'[Preheat] Failed to trigger transcode for {s3_key}: {str(e)}')
    
    # 在后台线程执行，不阻塞上传响应
    from flask import current_app
    app = current_app._get_current_object()
    
    def run_with_context():
        with app.app_context():
            do_preheat()
    
    thread = threading.Thread(target=run_with_context)
    thread.daemon = True
    thread.start()


# Create blueprint
files_bp = Blueprint('files', __name__)


# Exempt OPTIONS requests from rate limiting (for CORS preflight)
@files_bp.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return '', 200


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
        "activity_type": "regular_training"
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
        
        # Validate activity_type
        from constants.activity_types import ACTIVITY_TYPE_VALUES
        if activity_type not in ACTIVITY_TYPE_VALUES:
            return jsonify({
                'error': {
                    'code': 'FILE_008',
                    'message': f'活动类型无效。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}'
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
        "activity_type": "regular_training"
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
        
        # Fetch thumbhash for image/video files (using Bitiful's thumbhash service)
        thumbhash = None
        if content_type.startswith('image/') or content_type.startswith('video/'):
            try:
                import requests
                # For video, use frame extraction; for image, direct thumbhash
                thumbhash_url = f"https://{bucket}.s3.bitiful.net/{s3_key}?fmt=thumbhash"
                if content_type.startswith('video/'):
                    thumbhash_url = f"https://{bucket}.s3.bitiful.net/{s3_key}?frame=100&fmt=thumbhash"
                
                resp = requests.get(thumbhash_url, timeout=5)
                if resp.status_code == 200:
                    thumbhash = resp.text.strip()
                    current_app.logger.info(f'Got thumbhash for {s3_key}: {thumbhash[:20]}...')
            except Exception as e:
                current_app.logger.warning(f'Failed to get thumbhash for {s3_key}: {str(e)}')
        
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
            is_legacy=False,  # Mark as new system file
            thumbhash=thumbhash
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
        
        # 如果是视频文件，触发 HLS 转码预热
        if content_type.startswith('video/'):
            try:
                _trigger_video_transcode_preheat(s3_key)
            except Exception as e:
                current_app.logger.warning(f'Failed to trigger transcode preheat for {s3_key}: {str(e)}')
        
        # Build response with display names
        from constants.activity_types import display_name_for
        file_dict = file.to_dict(include_uploader=True)
        file_dict['activity_type_display'] = display_name_for(activity_type)
        
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
    
    GET /api/files?directory=/rehearsals/2025-03-session/&uploader_id=1&activity_type=regular_training&date_from=2025-03-01&date_to=2025-03-31&search=training&media_type=image&tags=dance,practice&year=2025&month=3&page=1&per_page=50
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - directory: Filter by directory path (optional)
        - uploader_id: Filter by uploader user ID (optional)
        - activity_type: Filter by activity type (optional)
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
        from constants.activity_types import ACTIVITY_TYPE_DISPLAY

        files = []
        for file in pagination.items:
            file_dict = file.to_dict(include_uploader=True)
            if file.activity_type:
                file_dict['activity_type_display'] = ACTIVITY_TYPE_DISPLAY.get(
                    file.activity_type, file.activity_type
                )
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
        
        # Add activity_type display name
        if file.activity_type:
            from constants.activity_types import ACTIVITY_TYPE_DISPLAY
            file_dict['activity_type_display'] = ACTIVITY_TYPE_DISPLAY.get(
                file.activity_type, file.activity_type
            )


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
        
        # Verify user is the uploader or admin
        from auth.models import User
        current_user = User.query.get(current_user_id)
        is_admin = current_user and current_user.is_admin
        
        if file.uploader_id != current_user_id and not is_admin:
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
        from constants.activity_types import ACTIVITY_TYPE_DISPLAY as activity_type_presets
        
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
        "activity_type": "regular_training"
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
        
        # Update activity_type if provided (None 表示未分类)
        if 'activity_type' in data:
            from constants.activity_types import ACTIVITY_TYPE_VALUES
            raw = data['activity_type']
            if raw is None or (isinstance(raw, str) and not raw.strip()):
                activity_type = None
            elif isinstance(raw, str):
                activity_type = raw.strip()
                if activity_type not in ACTIVITY_TYPE_VALUES:
                    return jsonify({
                        'error': {
                            'code': 'FILE_008',
                            'message': f'活动类型无效。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}'
                        }
                    }), 400
            else:
                return jsonify({
                    'error': {
                        'code': 'FILE_008',
                        'message': '活动类型必须是字符串或 null'
                    }
                }), 400

            if file.activity_type != activity_type:
                file.activity_type = activity_type
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
        
        # Build response with display names
        from constants.activity_types import display_name_for
        file_dict = file.to_dict(include_uploader=True)
        file_dict['activity_type_display'] = display_name_for(file.activity_type)
        
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
    
    GET /api/files/<file_id>/adjacent?limit=5
    Headers: Authorization: Bearer <token>
    
    Query Parameters:
        limit: Number of files to return on each side (default: 3, max: 20)
    
    Returns:
        200: Adjacent files retrieved successfully
        {
            "previous": { file object } or null,
            "next": { file object } or null,
            "previous_files": [ array of file objects ],
            "next_files": [ array of file objects ]
        }
        404: File not found
        401: Unauthorized
        500: Retrieval failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get limit parameter (default 3, max 20)
        limit = request.args.get('limit', 3, type=int)
        limit = max(1, min(limit, 20))
        
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
        
        # Get previous and next files based on limit
        previous_files = []
        next_files = []
        
        # Get up to `limit` previous files
        for i in range(1, limit + 1):
            if current_index - i >= 0:
                previous_files.insert(0, same_directory_files[current_index - i])
        
        # Get up to `limit` next files
        for i in range(1, limit + 1):
            if current_index + i < len(same_directory_files):
                next_files.append(same_directory_files[current_index + i])
        
        # For simple previous/next navigation (keyboard shortcuts)
        previous_file = same_directory_files[current_index - 1] if current_index > 0 else None
        next_file = same_directory_files[current_index + 1] if current_index < len(same_directory_files) - 1 else None
        
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
        
        # Convert to dict - include previous_files and next_files arrays
        result = {
            'previous': previous_file.to_dict() if previous_file else None,
            'next': next_file.to_dict() if next_file else None,
            'previous_files': [f.to_dict() for f in previous_files],
            'next_files': [f.to_dict() for f in next_files]
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
        
        # Get current user info for admin check
        from auth.models import User
        current_user = User.query.get(current_user_id)
        is_admin = current_user and current_user.is_admin
        
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
                
                # Verify user is the uploader or admin
                if file.uploader_id != current_user_id and not is_admin:
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
        from constants.activity_types import ACTIVITY_TYPE_VALUES

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
            if updates['activity_type'] not in ACTIVITY_TYPE_VALUES:
                return jsonify({
                    'error': {
                        'code': 'FILE_008',
                        'message': f'活动类型无效。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}'
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
        from constants.activity_types import ACTIVITY_TYPE_DISPLAY as activity_type_presets

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
        from constants.activity_types import ACTIVITY_TYPE_DISPLAY as activity_type_presets
        
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
            from constants.activity_types import ACTIVITY_TYPE_VALUES
            if new_activity_type not in ACTIVITY_TYPE_VALUES:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'无效的活动类型。有效选项: {", ".join(sorted(ACTIVITY_TYPE_VALUES))}'
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


@files_bp.route('/signed-url/<int:file_id>', methods=['GET'])
@jwt_required()
def get_signed_url(file_id):
    """
    获取文件的签名访问 URL
    
    GET /api/files/signed-url/<file_id>?style=w=400
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - style: 图片处理样式参数（可选），如 w=400&h=300&q=80
        - expiration: URL 有效期秒数（可选），默认 3600
    
    Returns:
        200: 签名 URL 生成成功
        404: 文件不存在
        401: 未授权
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # 获取文件
        file = File.query.get(file_id)
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_001',
                    'message': '文件不存在'
                }
            }), 404
        
        # 获取参数
        style = request.args.get('style', '').strip()
        expiration = request.args.get('expiration', type=int) or current_app.config.get('S3_URL_EXPIRATION', 3600)
        
        # 生成签名 URL
        signed_url = s3_service.generate_signed_url(
            key=file.s3_key,
            expiration=expiration,
            style=style if style else None
        )
        
        return jsonify({
            'success': True,
            'signed_url': signed_url,
            'expires_in': expiration
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error generating signed URL: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '生成签名 URL 失败'
            }
        }), 500


@files_bp.route('/signed-urls', methods=['POST'])
@jwt_required()
def get_signed_urls_batch():
    """
    批量获取文件的签名访问 URL
    
    POST /api/files/signed-urls
    Headers: Authorization: Bearer <token>
    Body: {
        "file_ids": [1, 2, 3],
        "style": "thumb_desktop",  // 可选，图片样式
        "video_style": "video_thumb_desktop",  // 可选，视频样式（如不提供则自动推断）
        "expiration": 3600  // 可选
    }
    
    Returns:
        200: 签名 URL 列表
        400: 参数错误
        401: 未授权
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'file_ids' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少 file_ids 参数'
                }
            }), 400
        
        file_ids = data['file_ids']
        if not isinstance(file_ids, list) or len(file_ids) == 0:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': 'file_ids 必须是非空数组'
                }
            }), 400
        
        # 限制批量请求数量
        if len(file_ids) > 100:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '单次最多请求 100 个文件'
                }
            }), 400
        
        style = data.get('style', '').strip()
        video_style = data.get('video_style', '').strip()
        expiration = data.get('expiration') or current_app.config.get('S3_URL_EXPIRATION', 3600)
        
        # 自动推断视频样式：如果提供了图片样式但没有视频样式，尝试映射
        if style and not video_style:
            style_to_video_style = {
                'thumbmobile': 'videothumbmobile',
                'thumbdesktop': 'videothumbdesktop',
                'thumbnav': 'videothumbnav',
                'thumbnavdesktop': 'videothumbnavdesktop',
                'previewmobile': 'videopreload',
                'previewtablet': 'videopreload',
                'previewdesktop': 'videopreload',
            }
            video_style = style_to_video_style.get(style, style)
        
        # 查询文件
        files = File.query.filter(File.id.in_(file_ids)).all()
        
        # 生成签名 URL，根据文件类型选择样式
        result = {}
        for file in files:
            # 根据文件类型选择样式
            if file.content_type and file.content_type.startswith('video/'):
                file_style = video_style if video_style else style
            else:
                file_style = style
            
            result[file.id] = {
                'signed_url': s3_service.generate_signed_url(
                    key=file.s3_key,
                    expiration=expiration,
                    style=file_style if file_style else None
                ),
                's3_key': file.s3_key,
                'content_type': file.content_type
            }
        
        return jsonify({
            'success': True,
            'urls': result,
            'expires_in': expiration
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error generating batch signed URLs: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '批量生成签名 URL 失败'
            }
        }), 500


@files_bp.route('/hls-qualities/<int:file_id>', methods=['GET'])
@jwt_required()
def get_hls_qualities(file_id):
    """
    获取视频的 HLS 可用清晰度列表
    
    GET /api/files/hls-qualities/<file_id>
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: 清晰度列表
        {
            "success": true,
            "qualities": [
                {"height": 1080, "label": "1080p", "playlist": "1080p_medium.m3u8"},
                {"height": 720, "label": "720p", "playlist": "720p_medium.m3u8"},
                {"height": 480, "label": "480p", "playlist": "480p_medium.m3u8"},
                {"height": 360, "label": "360p", "playlist": "360p_medium.m3u8"}
            ],
            "default_quality": 1080
        }
        404: 文件不存在
        401: 未授权
    """
    import requests
    import re
    
    try:
        # 获取文件
        file = File.query.get(file_id)
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_001',
                    'message': '文件不存在'
                }
            }), 404
        
        # 检查是否是视频文件
        if not file.content_type or not file.content_type.startswith('video/'):
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '不是视频文件'
                }
            }), 400
        
        expiration = current_app.config.get('S3_URL_EXPIRATION', 3600)
        
        # 获取主播放列表
        master_key = f"{file.s3_key}!style:medium/auto_medium.m3u8"
        master_url = s3_service.generate_signed_url(key=master_key, expiration=expiration)
        
        resp = requests.get(master_url, timeout=10)
        if resp.status_code != 200:
            # 主播放列表不存在，返回默认清晰度列表
            return jsonify({
                'success': True,
                'qualities': [
                    {'height': 1080, 'label': '1080p', 'playlist': '1080p_medium.m3u8'},
                    {'height': 720, 'label': '720p', 'playlist': '720p_medium.m3u8'},
                    {'height': 480, 'label': '480p', 'playlist': '480p_medium.m3u8'},
                    {'height': 360, 'label': '360p', 'playlist': '360p_medium.m3u8'},
                ],
                'default_quality': 1080,
                'from_manifest': False
            }), 200
        
        # 解析主播放列表，提取清晰度信息
        m3u8_content = resp.text
        qualities = []
        
        # 解析 #EXT-X-STREAM-INF 标签
        # 格式: #EXT-X-STREAM-INF:BANDWIDTH=xxx,RESOLUTION=1920x1080,...
        lines = m3u8_content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('#EXT-X-STREAM-INF:'):
                # 提取分辨率
                resolution_match = re.search(r'RESOLUTION=(\d+)x(\d+)', line)
                bandwidth_match = re.search(r'BANDWIDTH=(\d+)', line)
                
                if resolution_match:
                    width = int(resolution_match.group(1))
                    height = int(resolution_match.group(2))
                    bandwidth = int(bandwidth_match.group(1)) if bandwidth_match else 0
                    
                    # 获取下一行的播放列表文件名
                    playlist = ''
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if next_line and not next_line.startswith('#'):
                            playlist = next_line
                    
                    # 生成标签
                    if height >= 2160:
                        label = '4K'
                    elif height >= 1440:
                        label = '2K'
                    elif height >= 1080:
                        label = '1080p'
                    elif height >= 720:
                        label = '720p'
                    elif height >= 480:
                        label = '480p'
                    else:
                        label = f'{height}p'
                    
                    qualities.append({
                        'height': height,
                        'width': width,
                        'label': label,
                        'playlist': playlist,
                        'bandwidth': bandwidth
                    })
        
        # 按高度降序排序
        qualities.sort(key=lambda x: x['height'], reverse=True)
        
        return jsonify({
            'success': True,
            'qualities': qualities,
            'default_quality': 1080,
            'from_manifest': True
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting HLS qualities: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取清晰度列表失败'
            }
        }), 500


@files_bp.route('/hls-segment-url', methods=['POST'])
@jwt_required()
def get_hls_segment_signed_url():
    """
    为 HLS 分片生成签名 URL
    
    POST /api/files/hls-segment-url
    Headers: Authorization: Bearer <token>
    Body: {
        "segment_url": "https://xxx.s3.bitiful.net/path/video.mp4!style:medium/1080p_medium.mp4"
    }
    
    Returns:
        200: 签名 URL 生成成功
        400: 参数错误
        401: 未授权
    """
    try:
        data = request.get_json()
        
        if not data or 'segment_url' not in data:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少 segment_url 参数'
                }
            }), 400
        
        segment_url = data['segment_url'].strip()
        expiration = data.get('expiration') or current_app.config.get('S3_URL_EXPIRATION', 3600)
        
        # 验证 URL 是否是缤纷云的 URL
        if 'bitiful.net' not in segment_url and 's3.bitiful' not in segment_url:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '无效的分片 URL'
                }
            }), 400
        
        # 从 URL 中提取 key
        # URL 格式: https://bucket.s3.bitiful.net/path/to/file.mp4!style:medium/segment.mp4
        from urllib.parse import urlparse, unquote
        
        parsed = urlparse(segment_url)
        # 移除开头的 /
        key = unquote(parsed.path.lstrip('/'))
        
        # 生成签名 URL
        signed_url = s3_service.generate_signed_url(
            key=key,
            expiration=expiration
        )
        
        return jsonify({
            'success': True,
            'signed_url': signed_url,
            'expires_in': expiration
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error generating HLS segment signed URL: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '生成分片签名 URL 失败'
            }
        }), 500


@files_bp.route('/hls-proxy/<int:file_id>/<path:hls_path>', methods=['GET'])
@jwt_required()
def proxy_hls_content(file_id, hls_path):
    """
    代理 HLS 内容，自动签名 m3u8 中的分片 URL
    
    GET /api/files/hls-proxy/<file_id>/medium/auto_medium.m3u8
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: HLS 内容（m3u8 带签名的分片 URL）
        404: 文件不存在
        401: 未授权
    """
    import requests
    from urllib.parse import urlparse, unquote
    
    try:
        # 获取文件
        file = File.query.get(file_id)
        if not file:
            return jsonify({
                'error': {
                    'code': 'FILE_001',
                    'message': '文件不存在'
                }
            }), 404
        
        expiration = current_app.config.get('S3_URL_EXPIRATION', 3600)
        bucket = s3_service.get_bucket_name()
        
        # 构建完整的 HLS key: video.mp4!style:medium/auto_medium.m3u8
        hls_key = f"{file.s3_key}!style:{hls_path}"
        
        # 如果是 .m3u8 文件，获取内容并替换分片 URL 为签名 URL
        if hls_path.endswith('.m3u8'):
            # 生成 m3u8 文件的签名 URL
            m3u8_signed_url = s3_service.generate_signed_url(
                key=hls_key,
                expiration=expiration
            )
            
            # 获取 m3u8 内容
            # Upstream HLS playlists can be slow on cold cache, especially after Bitiful evicts transcodes.
            resp = requests.get(m3u8_signed_url, timeout=30)
            if resp.status_code != 200:
                return jsonify({
                    'error': {
                        'code': 'HLS_001',
                        'message': f'获取 m3u8 失败: {resp.status_code}'
                    }
                }), 502
            
            m3u8_content = resp.text
            
            # 解析并替换分片 URL 为签名 URL
            lines = m3u8_content.split('\n')
            new_lines = []
            
            # 获取 hls_path 的目录部分
            hls_dir = '/'.join(hls_path.split('/')[:-1])
            if hls_dir:
                hls_dir += '/'
            
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    # 注释行或空行，保持不变
                    new_lines.append(line)
                elif (line.endswith('.mp4') or line.endswith('.ts') or 
                      line.endswith('.m3u8') or '.ts' in line or '.mp4' in line):
                    # 这是一个媒体文件引用
                    if line.startswith('http'):
                        # 绝对 URL，提取路径部分
                        parsed = urlparse(line)
                        path = unquote(parsed.path)
                        style_idx = path.find('!style:')
                        if style_idx != -1:
                            segment_path = path[style_idx + 7:]
                        else:
                            segment_path = line
                    else:
                        # 相对路径
                        segment_path = hls_dir + line
                    
                    # 如果是 .m3u8 子播放列表，使用代理 URL（这样分片也能被签名）
                    if segment_path.endswith('.m3u8'):
                        # Use a root-relative proxy URL so reverse-proxy/CDN host rewriting
                        # does not break nested playlist fetching.
                        proxy_url = f"/api/files/hls-proxy/{file_id}/{segment_path}"
                        new_lines.append(proxy_url)
                    else:
                        # 分片文件直接用签名 URL
                        segment_key = f"{file.s3_key}!style:{segment_path}"
                        signed_segment_url = s3_service.generate_signed_url(
                            key=segment_key,
                            expiration=expiration
                        )
                        new_lines.append(signed_segment_url)
                else:
                    new_lines.append(line)
            
            modified_m3u8 = '\n'.join(new_lines)
            
            response = make_response(modified_m3u8)
            response.headers['Content-Type'] = 'application/vnd.apple.mpegurl'
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Cache-Control'] = 'no-cache'
            return response
        
        # 其他文件类型（不应该走到这里，但以防万一）
        signed_url = s3_service.generate_signed_url(
            key=hls_key,
            expiration=expiration
        )
        return redirect(signed_url)
        
    except Exception as e:
        current_app.logger.error(f'Error proxying HLS content: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '代理 HLS 内容失败'
            }
        }), 500


# ============================================================
# AI 语义搜索:文本 query → embedding → vec0 近邻 → 排序文件
# ============================================================

@files_bp.route('/ai-search', methods=['POST'])
@jwt_required()
def ai_search():
    """POST /api/files/ai-search { q, limit? } → 按语义距离排序的文件。
    走 sqlite-vec MATCH(KNN);距离值越小越相似。
    """
    import time as _time
    from sqlalchemy import text as _sql
    import sqlite_vec
    from services.embedding_service import EmbeddingClient

    data = request.get_json(silent=True) or {}
    q = (data.get('q') or '').strip()
    limit = int(data.get('limit') or 30)
    limit = max(1, min(limit, 200))

    if not q:
        return jsonify({'error': {'code': 'BAD_REQUEST', 'message': '查询内容不能为空'}}), 400

    # 端到端计时:覆盖 embedding API + vec0 KNN,反映用户实际感知延迟
    # (此前只盖 vec0 那段,实际 embedding 那一跳 200-500ms 没算进来)
    t0 = _time.monotonic()

    # 1) text → vector
    try:
        client = EmbeddingClient.from_env()
        emb = client.embed_text(q)
    except Exception as e:
        current_app.logger.error(f'ai-search embed text failed: {e}')
        return jsonify({'error': {'code': 'EMBED_FAILED', 'message': f'文本向量化失败: {e}'}}), 500

    # 2) vec0 KNN
    serialized = sqlite_vec.serialize_float32(emb.vector)
    try:
        rows = db.session.execute(
            _sql(
                "SELECT file_id, distance FROM image_embeddings "
                "WHERE embedding MATCH :vec AND k = :k "
                "ORDER BY distance"
            ),
            {"vec": serialized, "k": limit},
        ).all()
    except Exception as e:
        current_app.logger.error(f'ai-search vec0 query failed: {e}')
        return jsonify({'error': {'code': 'VEC_QUERY_FAILED', 'message': f'向量检索失败: {e}'}}), 500
    ms_search = int((_time.monotonic() - t0) * 1000)

    if not rows:
        return jsonify({
            'results': [], 'query': q,
            'query_tokens': emb.input_tokens, 'ms': ms_search,
        })

    # 3) JOIN files,保持 vec0 排序
    file_ids = [int(r[0]) for r in rows]
    files = File.query.filter(File.id.in_(file_ids)).all()
    by_id = {f.id: f for f in files}

    results = []
    for rank, (fid, dist) in enumerate(rows, start=1):
        f = by_id.get(int(fid))
        if f is None:
            continue  # 孤儿向量(文件已删,vec 残留),跳过
        results.append({
            'rank': rank,
            'distance': float(dist),
            'file': f.to_dict(include_uploader=True),
        })

    return jsonify({
        'results': results,
        'query': q,
        'query_tokens': emb.input_tokens,
        'ms': ms_search,
    })


# ============================================================
# 人脸 / Person 相关端点
#
# 表关系:files 1-N faces N-1 persons
# faces.person_id = 0  → 未聚类(哨兵值,vec0 regular 列不能 NULL)
# persons.cover_face_id → 选中的代表脸,从中可拿 file_id + bbox 拼公开桶 thumb URL
# 完整背景见 [[decision_public_mirror_bucket]] + [[decision_embedding_arch]]
# ============================================================


RECT_EXIF_FILE_IDS = {1527, 2551}


def _raw_bbox_to_exif_bbox(x, y, w, h, raw_w, raw_h, orientation):
    """raw bbox -> EXIF-applied bbox for confirmed Bitiful rect outliers."""
    if not raw_w or not raw_h:
        return (x, y, w, h)
    o = int(orientation or 1)
    raw_w, raw_h = int(raw_w), int(raw_h)
    if o == 1:
        return (x, y, w, h)
    if o == 2:
        return (raw_w - x - w, y, w, h)
    if o == 3:
        return (raw_w - x - w, raw_h - y - h, w, h)
    if o == 4:
        return (x, raw_h - y - h, w, h)
    if o == 5:
        return (y, x, h, w)
    if o == 6:
        return (raw_h - y - h, x, h, w)
    if o == 7:
        return (raw_h - y - h, raw_w - x - w, h, w)
    if o == 8:
        return (y, raw_w - x - w, h, w)
    return (x, y, w, h)


def _person_thumb_url(file_row, bbox, width=200):
    """从 (file row tuple, bbox tuple) 拼公开桶 ?rect=...&w=... thumb URL。
    file 必须已 mirror(public_mirror_at 非空),否则返回 None。
    默认 bbox 是 raw 坐标系,?rect= 直接喂。

    少数已确认的公开桶对象(file_id in RECT_EXIF_FILE_IDS)在 Bitiful
    动态裁剪里表现为 EXIF-applied 坐标系,只对这些文件做 raw→EXIF。
    """
    if len(file_row) >= 6:
        file_id, s3_key, public_mirror_at, raw_w, raw_h, orientation = file_row[:6]
    else:
        file_id = None
        s3_key, public_mirror_at = file_row[0], file_row[1]
        raw_w = file_row[2] if len(file_row) > 2 else None
        raw_h = file_row[3] if len(file_row) > 3 else None
        orientation = file_row[4] if len(file_row) > 4 else 1
    if not public_mirror_at:
        return None
    endpoint = current_app.config.get('S3_PUBLIC_ENDPOINT', '')
    x, y, w, h = (int(v) for v in bbox)
    if file_id is not None and int(file_id) in RECT_EXIF_FILE_IDS:
        x, y, w, h = _raw_bbox_to_exif_bbox(x, y, w, h, raw_w, raw_h, orientation)
    cover_key = S3PublicService.cover_key(s3_key)
    return f"{endpoint}/{cover_key}?rect={x},{y},{w},{h}&w={width}"


@files_bp.route('/<int:file_id>/faces', methods=['GET'])
@jwt_required()
def list_faces_in_file(file_id):
    """GET /api/files/<id>/faces → 该文件检测到的脸列表,带 bbox 和 person_id

    主要给将来"在图上画 bbox 框"留口子,目前 UI 用的是 /persons 那个端点。
    """
    from sqlalchemy import text as _sql

    rows = db.session.execute(
        _sql(
            "SELECT face_id, person_id, bbox_x, bbox_y, bbox_w, bbox_h, confidence_bp "
            "FROM faces WHERE file_id = :fid ORDER BY face_id"
        ),
        {"fid": file_id},
    ).all()

    faces = [{
        'face_id': int(r[0]),
        'person_id': int(r[1]) if r[1] else None,  # 0 = 未聚类,前端按 null 处理
        'bbox': {'x': int(r[2]), 'y': int(r[3]), 'w': int(r[4]), 'h': int(r[5])},
        'confidence': float(r[6]) / 10000.0,
    } for r in rows]

    return jsonify({'file_id': file_id, 'faces': faces})


@files_bp.route('/<int:file_id>/people', methods=['GET'])
@jwt_required()
def list_people_in_file(file_id):
    """GET /api/files/<id>/people → 该文件里出现的 distinct person 列表 + 各自代表头像

    UI 用:文件详情页旁边显示"这张图里有谁",每个 person 给个圆头像缩略图,
    点击 → /files?person=<id>。

    实现:
      faces (this file) → persons → cover_face → cover face's file & bbox → public thumb URL
      未聚类的脸(person_id=0)单独归一组,只显示一条"未识别人脸"提示
    """
    from sqlalchemy import text as _sql

    # 拿 file 的 raw 尺寸 + EXIF orientation,前端用来在已加载大图上做 CSS 裁切
    # 见 [[gotcha_bitiful_rect_raw_coord]]:bbox 存的是 raw 系,要反变换到 EXIF 系
    file_dims_row = db.session.execute(
        _sql("SELECT raw_w, raw_h, orientation FROM files WHERE id = :id"),
        {"id": file_id},
    ).first()
    file_dims = None
    if file_dims_row and file_dims_row[0] and file_dims_row[1]:
        file_dims = {
            'raw_w': int(file_dims_row[0]),
            'raw_h': int(file_dims_row[1]),
            'orientation': int(file_dims_row[2] or 1),
        }

    # 取该文件里所有脸(bbox + 质量),后面在 Python 侧按 person_id 挑最佳
    face_rows = db.session.execute(
        _sql(
            "SELECT face_id, person_id, bbox_x, bbox_y, bbox_w, bbox_h, confidence_bp "
            "FROM faces WHERE file_id = :fid"
        ),
        {"fid": file_id},
    ).all()
    if not face_rows:
        return jsonify({
            'file_id': file_id, 'people': [], 'unidentified_count': 0,
            'file_dims': file_dims,
        })

    # 按 person_id 分组,挑 area * confidence_bp 最大那张做 best_face
    best_by_pid = {}            # pid -> (face_id, bbox_x, bbox_y, bbox_w, bbox_h, conf_bp)
    unidentified = 0
    for r in face_rows:
        face_id, pid, x, y, w, h, conf = (
            int(r[0]), int(r[1] or 0), int(r[2]), int(r[3]),
            int(r[4]), int(r[5]), int(r[6]),
        )
        if pid <= 0:
            unidentified += 1
            continue
        score = w * h * conf
        cur = best_by_pid.get(pid)
        if cur is None or score > cur[6]:
            best_by_pid[pid] = (face_id, x, y, w, h, conf, score)

    if not best_by_pid:
        return jsonify({
            'file_id': file_id, 'people': [], 'unidentified_count': unidentified,
            'file_dims': file_dims,
        })

    # JOIN persons + real_people 拿 name + 全库 face_count
    from sqlalchemy import bindparam
    stmt = _sql(
        "SELECT p.id, rp.name, p.face_count, "
        "       fi.id, fi.s3_key, fi.public_mirror_at, "
        "       fi.raw_w, fi.raw_h, fi.orientation, "
        "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h "
        "FROM persons p "
        "LEFT JOIN real_people rp ON p.real_person_id = rp.id "
        "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
        "LEFT JOIN files fi ON f.file_id = fi.id "
        "WHERE p.id IN :pids "
        "ORDER BY p.face_count DESC"
    ).bindparams(bindparam("pids", expanding=True))
    person_rows = db.session.execute(
        stmt, {"pids": list(best_by_pid.keys())}
    ).all()

    people = []
    for pr in person_rows:
        pid = int(pr[0])
        best = best_by_pid[pid]
        face_id, bx, by, bw, bh = best[0], best[1], best[2], best[3], best[4]
        # cover 的 thumb_url(走公开桶 ?rect=)留下,前端如果拿不到 file_dims 走 fallback
        cover_bbox = (pr[9], pr[10], pr[11], pr[12]) if pr[9] is not None else None
        thumb_url = (
            _person_thumb_url((pr[3], pr[4], pr[5], pr[6], pr[7], pr[8]), cover_bbox)
            if cover_bbox else None
        )
        people.append({
            'id': pid,
            'name': pr[1],
            'face_count': int(pr[2]),
            'thumb_url': thumb_url,           # fallback,新前端有 file_dims 时优先 CSS 裁切
            'best_face_in_file': {
                'face_id': face_id,
                # raw 坐标系 bbox。前端 + file_dims 自己做 raw→exif 变换
                'bbox': {'x': bx, 'y': by, 'w': bw, 'h': bh},
            },
        })

    return jsonify({
        'file_id': file_id,
        'people': people,
        'unidentified_count': unidentified,
        'file_dims': file_dims,                # null = 旧文件没补,前端走 thumb_url fallback
    })


@files_bp.route('/persons', methods=['GET'])
@jwt_required()
def list_persons():
    """GET /api/files/persons?limit= → 所有 cluster + cover thumb URL + (link 的)真人 name/pin

    现在 persons 表只存 cluster 状态;name / cover_pinned 来自 real_people。
    LEFT JOIN real_people: 没 link 的 cluster name=NULL pinned=0(前端按未命名展示)。

    多个 cluster 可能 link 同一个 real_people(DBSCAN 把同一人拆了),响应保持 1 row per cluster。
    """
    from sqlalchemy import text as _sql

    limit = int(request.args.get('limit', 500))
    limit = max(1, min(limit, 1000))

    rows = db.session.execute(
        _sql(
            "SELECT p.id, rp.name, p.face_count, p.cover_face_id, "
            "       COALESCE(rp.cover_pinned, 0) AS pinned, "
            "       fi.id, fi.s3_key, fi.public_mirror_at, "
            "       fi.raw_w, fi.raw_h, fi.orientation, "
            "       f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, "
            "       p.real_person_id "
            "FROM persons p "
            "LEFT JOIN real_people rp ON p.real_person_id = rp.id "
            "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
            "LEFT JOIN files fi ON f.file_id = fi.id "
            "WHERE p.face_count >= 1 "
            "ORDER BY p.face_count DESC "
            "LIMIT :lim"
        ),
        {"lim": limit},
    ).all()

    persons = []
    for r in rows:
        bbox = (r[11], r[12], r[13], r[14]) if r[11] is not None else None
        thumb_url = (
            _person_thumb_url((r[5], r[6], r[7], r[8], r[9], r[10]), bbox)
            if bbox else None
        )
        persons.append({
            'id': int(r[0]),
            'name': r[1],
            'face_count': int(r[2]),
            'cover_face_id': int(r[3]) if r[3] else None,
            'cover_pinned': bool(r[4]),
            'thumb_url': thumb_url,
            'real_person_id': int(r[15]) if r[15] else None,
        })

    return jsonify({'persons': persons, 'total': len(persons)})


@files_bp.route('/persons/<int:person_id>', methods=['GET'])
@jwt_required()
def get_person_files(person_id):
    """GET /api/files/persons/<id> → 该 person 出现在的所有文件

    分页同 /files 主接口;face_count 在 persons 表里已存,这里只返文件。
    """
    from sqlalchemy import text as _sql

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 24))
    per_page = max(1, min(per_page, 200))

    # 取 cluster 元信息(name 来自 real_people)
    p_row = db.session.execute(
        _sql(
            "SELECT p.id, rp.name, p.face_count "
            "FROM persons p LEFT JOIN real_people rp ON p.real_person_id = rp.id "
            "WHERE p.id = :pid"
        ),
        {"pid": person_id},
    ).first()
    if not p_row:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'person 不存在'}}), 404

    # 该 person 出现在哪些 file(distinct file_id,按上传时间倒序)
    # faces 是 vec0 虚表,JOIN files 走 file_id 列(regular column 可索引)
    file_ids_rows = db.session.execute(
        _sql(
            "SELECT DISTINCT f.file_id FROM faces f WHERE f.person_id = :pid"
        ),
        {"pid": person_id},
    ).all()
    file_ids = [int(r[0]) for r in file_ids_rows]
    if not file_ids:
        return jsonify({
            'person': {'id': int(p_row[0]), 'name': p_row[1], 'face_count': int(p_row[2])},
            'files': [], 'pagination': {'total': 0, 'page': page, 'per_page': per_page,
                                         'pages': 0, 'has_next': False, 'has_prev': False},
        })

    total = len(file_ids)
    q = File.query.filter(File.id.in_(file_ids)).order_by(File.uploaded_at.desc())
    paged = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'person': {'id': int(p_row[0]), 'name': p_row[1], 'face_count': int(p_row[2])},
        'files': [f.to_dict(include_uploader=True) for f in paged.items],
        'pagination': {
            'total': total, 'page': page, 'per_page': per_page,
            'pages': paged.pages,
            'has_next': paged.has_next, 'has_prev': paged.has_prev,
        },
    })


@files_bp.route('/persons/<int:person_id>', methods=['PATCH'])
@jwt_required()
def rename_person(person_id):
    """PATCH /api/files/persons/<id> { name } → 给 cluster 起名字(实际写 real_people)

    身份现在跟 cluster 解耦:
      - cluster 已 link 了 real_people → 直接 UPDATE real_people.name
      - cluster 没 link → 拿它 cover face 的 (file_id, bbox) 当 anchor 新建一行
        real_people, 然后 UPDATE persons.real_person_id 指过去
      - 撞同名 real_people → 409 NAME_CONFLICT,带 existing real_people 信息,
        前端弹合并对话框(走 /persons/<id>/merge)
    """
    from sqlalchemy import text as _sql

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        name = None

    # 取该 cluster 当前 link 的 real_person_id + cover face 的 anchor 信息
    info = db.session.execute(
        _sql(
            "SELECT p.real_person_id, "
            "       f.file_id, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h "
            "FROM persons p "
            "LEFT JOIN faces f ON p.cover_face_id = f.face_id "
            "WHERE p.id = :pid"
        ),
        {"pid": person_id},
    ).first()
    if not info:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'person 不存在'}}), 404
    cur_real_pid = int(info[0]) if info[0] else None
    cover_file_id = int(info[1]) if info[1] else None
    cover_bbox = (info[2], info[3], info[4], info[5]) if info[1] else None

    # 同名冲突(找 real_people 表)
    if name:
        conflict = db.session.execute(
            _sql(
                "SELECT rp.id, rp.name, "
                "       COALESCE((SELECT SUM(p.face_count) FROM persons p "
                "                 WHERE p.real_person_id = rp.id), 0) AS face_count, "
                "       rp.anchor_file_id, rp.anchor_bbox_x, rp.anchor_bbox_y, "
                "       rp.anchor_bbox_w, rp.anchor_bbox_h "
                "FROM real_people rp WHERE rp.name = :n AND rp.id != :exclude LIMIT 1"
            ),
            {"n": name, "exclude": cur_real_pid or 0},
        ).first()
        if conflict:
            # 拼一个 thumb url 给前端展示已存在那位
            existing_file = db.session.execute(
                _sql(
                    "SELECT id, s3_key, public_mirror_at, raw_w, raw_h, orientation "
                    "FROM files WHERE id = :id"
                ),
                {"id": int(conflict[3])},
            ).first() if conflict[3] else None
            ex_bbox = (conflict[4], conflict[5], conflict[6], conflict[7]) if conflict[4] else None
            thumb_url = _person_thumb_url(
                (existing_file[0], existing_file[1], existing_file[2],
                 existing_file[3], existing_file[4], existing_file[5]), ex_bbox
            ) if existing_file and ex_bbox else None
            return jsonify({
                'error': {
                    'code': 'NAME_CONFLICT',
                    'message': f'已存在同名人物「{name}」',
                    'existing': {
                        'id': int(conflict[0]),
                        'name': conflict[1],
                        'face_count': int(conflict[2] or 0),
                        'thumb_url': thumb_url,
                    },
                },
            }), 409

    now = datetime.utcnow().isoformat()
    if cur_real_pid:
        # cluster 已经 link 了 → 直接改 name
        db.session.execute(
            _sql("UPDATE real_people SET name = :n, updated_at = :ts WHERE id = :rid"),
            {"n": name, "ts": now, "rid": cur_real_pid},
        )
    else:
        if not cover_bbox:
            return jsonify({'error': {
                'code': 'NO_ANCHOR',
                'message': 'cluster 没 cover face,起不了 anchor,无法命名',
            }}), 400
        # 新建 real_people + link
        res = db.session.execute(
            _sql(
                "INSERT INTO real_people "
                "  (name, cover_pinned, anchor_file_id, "
                "   anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h, "
                "   created_at, updated_at) "
                "VALUES (:n, 0, :fid, :bx, :by, :bw, :bh, :ts, :ts)"
            ),
            {"n": name, "fid": cover_file_id,
             "bx": cover_bbox[0], "by": cover_bbox[1],
             "bw": cover_bbox[2], "bh": cover_bbox[3], "ts": now},
        )
        new_real_id = int(res.lastrowid)
        db.session.execute(
            _sql("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
            {"rid": new_real_id, "pid": person_id},
        )
    db.session.commit()
    return jsonify({'id': person_id, 'name': name})


@files_bp.route('/persons/<int:person_id>/merge', methods=['POST'])
@jwt_required()
def merge_person(person_id):
    """POST /api/files/persons/<cluster_id>/merge { target_id } → 把 cluster 改链到目标真人

    新架构下 merge 只在身份层做,不动 faces 表:
      - target_id 是 real_people.id(rename_person 返回 NAME_CONFLICT.existing.id 时给的)
      - 把 cluster.real_person_id 改成 target_id
      - cluster 原来 link 的 real_people 若变成孤儿(没人再指它)→ DELETE
      - faces / persons 行本身保留,因为不同 cluster 可以 link 到同一个 real_people
        (DBSCAN 把一个人拆成多堆这种事很常见)

    边界:
      - cluster 不存在 → 404
      - target real_people 不存在 → 404
      - cluster 已经 link 到 target → 200 idempotent
    """
    from sqlalchemy import text as _sql

    data = request.get_json(silent=True) or {}
    target_id = data.get('target_id')
    if not target_id:
        return jsonify({'error': {'code': 'BAD_REQUEST', 'message': 'target_id 必填'}}), 400
    target_id = int(target_id)

    src = db.session.execute(
        _sql("SELECT id, real_person_id FROM persons WHERE id = :id"),
        {"id": person_id},
    ).first()
    if not src:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'cluster 不存在'}}), 404

    target = db.session.execute(
        _sql("SELECT id, name FROM real_people WHERE id = :id"),
        {"id": target_id},
    ).first()
    if not target:
        return jsonify({'error': {
            'code': 'NOT_FOUND', 'message': 'target real_person 不存在',
        }}), 404

    old_real_id = int(src[1]) if src[1] else None
    if old_real_id == target_id:
        return jsonify({
            'merged_into_real_id': target_id,
            'source_cluster_id': person_id,
            'orphan_real_id_deleted': None,
            'noop': True,
        })

    # 改 cluster → target real_people
    db.session.execute(
        _sql("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
        {"rid": target_id, "pid": person_id},
    )

    # 旧 real_people 没人指了就删,身份就清干净了
    orphan_deleted = None
    if old_real_id:
        still_used = db.session.execute(
            _sql("SELECT 1 FROM persons WHERE real_person_id = :rid LIMIT 1"),
            {"rid": old_real_id},
        ).first()
        if not still_used:
            db.session.execute(
                _sql("DELETE FROM real_people WHERE id = :rid"),
                {"rid": old_real_id},
            )
            orphan_deleted = old_real_id

    db.session.commit()

    return jsonify({
        'merged_into_real_id': target_id,
        'source_cluster_id': person_id,
        'orphan_real_id_deleted': orphan_deleted,
    })


@files_bp.route('/persons/<int:person_id>/cover', methods=['PUT'])
@jwt_required()
def set_person_cover(person_id):
    """PUT /api/files/persons/<id>/cover { file_id } → 指定该图为 person 代表头像

    pin 现在写在 real_people 上(身份层),而不是 persons(cluster 层):
      - 选 file_id 里 person_id=:pid 的最佳脸做 anchor (bbox)
      - cluster 已 link real_people → UPDATE real_people 的 cover_pinned + anchor
      - 没 link → 新建一行匿名 real_people (name=NULL, cover_pinned=1, anchor=新脸),
        再 UPDATE persons.real_person_id 指过去 —— reset/recluster 后靠 anchor IoU 反查
      - 同时 UPDATE persons.cover_face_id = 新 face_id,这样列表缩略图立即跟上
        (cluster 重跑后 cover_face_id 失效会被 reconcile 用 anchor 找回新值)

    同步副作用(端点返回时全部完成,前端 onSuccess 即可信赖最新状态):
      1) 新 cover file 没 mirror → 先 server-side copy 到 covers/<key>(若失败 → 500)
      2) UPDATE real_people + persons + 视情况 files.public_mirror_at,单 commit
      3) 旧 cover file 不再被引用 → unmirror + 清 public_mirror_at(失败仅记日志,
         cron mirror_cover_files.py prune 会兜底)
    """
    from sqlalchemy import text as _sql

    data = request.get_json(silent=True) or {}
    file_id = data.get('file_id')
    if not file_id:
        return jsonify({'error': {'code': 'BAD_REQUEST', 'message': 'file_id 必填'}}), 400
    file_id = int(file_id)

    # ---- 选脸 + 拿 bbox ----
    best = db.session.execute(
        _sql(
            "SELECT face_id, bbox_x, bbox_y, bbox_w, bbox_h FROM faces "
            "WHERE file_id = :fid AND person_id = :pid "
            "ORDER BY (bbox_w * bbox_h * confidence_bp) DESC LIMIT 1"
        ),
        {"fid": file_id, "pid": person_id},
    ).first()
    if not best:
        return jsonify({'error': {
            'code': 'NO_MATCHING_FACE',
            'message': '该文件里没有这个 person 的脸',
        }}), 400
    new_face_id = int(best[0])
    new_bbox = (int(best[1]), int(best[2]), int(best[3]), int(best[4]))

    # ---- 取 cluster 当前 real_person_id + 旧 cover file_id ----
    old_row = db.session.execute(
        _sql(
            "SELECT p.real_person_id, p.cover_face_id, f.file_id "
            "FROM persons p LEFT JOIN faces f ON p.cover_face_id = f.face_id "
            "WHERE p.id = :pid"
        ),
        {"pid": person_id},
    ).first()
    if not old_row:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'person 不存在'}}), 404
    cur_real_pid = int(old_row[0]) if old_row[0] else None
    old_file_id = int(old_row[2]) if old_row[2] else None

    # ---- 新 cover file 的当前 mirror 状态 ----
    new_file_row = db.session.execute(
        _sql("SELECT s3_key, public_mirror_at FROM files WHERE id = :id"),
        {"id": file_id},
    ).first()
    if not new_file_row:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'file 不存在'}}), 404
    new_s3_key = new_file_row[0]
    new_already_mirrored = bool(new_file_row[1])

    s3pub = S3PublicService()
    now = datetime.utcnow().isoformat()

    # ---- 步骤 1:mirror 新 cover(若需要) ----
    if not new_already_mirrored:
        try:
            s3pub.mirror_cover(new_s3_key)
        except Exception as e:
            current_app.logger.error(
                "set_person_cover: mirror new file=%d failed: %s", file_id, e
            )
            return jsonify({'error': {
                'code': 'MIRROR_FAILED',
                'message': f'公开桶镜像失败: {e}',
            }}), 500

    # ---- 步骤 2:DB 单 commit(real_people + persons + files 一起) ----
    try:
        if cur_real_pid:
            db.session.execute(
                _sql(
                    "UPDATE real_people SET cover_pinned = 1, "
                    "  anchor_file_id = :fid, anchor_bbox_x = :bx, anchor_bbox_y = :by, "
                    "  anchor_bbox_w = :bw, anchor_bbox_h = :bh, updated_at = :ts "
                    "WHERE id = :rid"
                ),
                {"fid": file_id,
                 "bx": new_bbox[0], "by": new_bbox[1],
                 "bw": new_bbox[2], "bh": new_bbox[3],
                 "ts": now, "rid": cur_real_pid},
            )
        else:
            res = db.session.execute(
                _sql(
                    "INSERT INTO real_people "
                    "  (name, cover_pinned, anchor_file_id, "
                    "   anchor_bbox_x, anchor_bbox_y, anchor_bbox_w, anchor_bbox_h, "
                    "   created_at, updated_at) "
                    "VALUES (NULL, 1, :fid, :bx, :by, :bw, :bh, :ts, :ts)"
                ),
                {"fid": file_id,
                 "bx": new_bbox[0], "by": new_bbox[1],
                 "bw": new_bbox[2], "bh": new_bbox[3],
                 "ts": now},
            )
            cur_real_pid = int(res.lastrowid)
            db.session.execute(
                _sql("UPDATE persons SET real_person_id = :rid WHERE id = :pid"),
                {"rid": cur_real_pid, "pid": person_id},
            )
        # cluster 层的 cover_face_id 也同步,这样列表缩略图立即跟上
        db.session.execute(
            _sql(
                "UPDATE persons SET cover_face_id = :fc, updated_at = :ts "
                "WHERE id = :pid"
            ),
            {"fc": new_face_id, "ts": now, "pid": person_id},
        )
        if not new_already_mirrored:
            db.session.execute(
                _sql("UPDATE files SET public_mirror_at = :ts WHERE id = :id"),
                {"ts": now, "id": file_id},
            )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            "set_person_cover: db commit failed: %s (新 mirror 落桶但 DB 没引用,cron 会清)", e
        )
        return jsonify({'error': {
            'code': 'DB_FAILED', 'message': f'DB 写入失败: {e}',
        }}), 500

    # ---- 步骤 3:旧 cover file 不再被引用就 unmirror(best-effort) ----
    if old_file_id and old_file_id != file_id:
        still_used = db.session.execute(
            _sql(
                "SELECT 1 FROM persons p JOIN faces f ON p.cover_face_id = f.face_id "
                "WHERE f.file_id = :fid LIMIT 1"
            ),
            {"fid": old_file_id},
        ).first()
        if not still_used:
            old_file_row = db.session.execute(
                _sql("SELECT s3_key FROM files WHERE id = :id"),
                {"id": old_file_id},
            ).first()
            if old_file_row:
                try:
                    s3pub.unmirror_cover(old_file_row[0])
                    db.session.execute(
                        _sql("UPDATE files SET public_mirror_at = NULL WHERE id = :id"),
                        {"id": old_file_id},
                    )
                    db.session.commit()
                except Exception as e:
                    current_app.logger.warning(
                        "set_person_cover: unmirror old file=%d failed: %s (cron 兜底)",
                        old_file_id, e,
                    )

    return jsonify({
        'id': person_id,
        'cover_face_id': new_face_id,
        'cover_pinned': True,
        'mirrored_new': not new_already_mirrored,
        'unmirrored_old': bool(old_file_id and old_file_id != file_id),
    })


@files_bp.route('/face-search', methods=['POST'])
@jwt_required()
def face_search():
    """POST /api/files/face-search { face_id, limit? } → 跟该脸最相似的脸列表,按相似度排序

    用于"找同一个人":前端点击详情页人脸框,以 face_id 反查所有相似脸所在的文件。
    走 sqlite-vec MATCH(余弦 KNN)。
    """
    import time as _time
    from sqlalchemy import text as _sql

    data = request.get_json(silent=True) or {}
    face_id = data.get('face_id')
    limit = int(data.get('limit') or 50)
    limit = max(1, min(limit, 200))

    if not face_id:
        return jsonify({'error': {'code': 'BAD_REQUEST', 'message': 'face_id 必填'}}), 400

    t0 = _time.monotonic()

    # 取 query 脸的 embedding
    row = db.session.execute(
        _sql("SELECT embedding FROM faces WHERE face_id = :fid"),
        {"fid": int(face_id)},
    ).first()
    if not row:
        return jsonify({'error': {'code': 'NOT_FOUND', 'message': 'face_id 不存在'}}), 404
    query_blob = row[0]

    # KNN over faces vec0
    try:
        rows = db.session.execute(
            _sql(
                "SELECT face_id, file_id, person_id, distance "
                "FROM faces WHERE embedding MATCH :vec AND k = :k "
                "ORDER BY distance"
            ),
            {"vec": query_blob, "k": limit + 1},  # +1 因为查询脸自己一定在 top-1
        ).all()
    except Exception as e:
        current_app.logger.error(f'face-search vec0 query failed: {e}')
        return jsonify({'error': {'code': 'VEC_QUERY_FAILED', 'message': f'向量检索失败: {e}'}}), 500

    ms = int((_time.monotonic() - t0) * 1000)

    # 排除自己,按 file_id 去重(每个文件保留最相似那张脸)
    seen_files = set()
    matches = []
    for r in rows:
        fid, file_id, person_id, dist = int(r[0]), int(r[1]), int(r[2]), float(r[3])
        if fid == int(face_id):
            continue
        if file_id in seen_files:
            continue
        seen_files.add(file_id)
        matches.append({
            'face_id': fid,
            'file_id': file_id,
            'person_id': person_id if person_id else None,
            'distance': dist,
            'similarity': 1.0 - dist,  # 余弦相似度
        })
        if len(matches) >= limit:
            break

    # JOIN files
    file_ids = [m['file_id'] for m in matches]
    files = File.query.filter(File.id.in_(file_ids)).all()
    by_id = {f.id: f for f in files}
    results = []
    for rank, m in enumerate(matches, 1):
        f = by_id.get(m['file_id'])
        if f is None:
            continue
        results.append({
            'rank': rank,
            'face_id': m['face_id'],
            'similarity': m['similarity'],
            'person_id': m['person_id'],
            'file': f.to_dict(include_uploader=True),
        })

    return jsonify({
        'query_face_id': int(face_id),
        'results': results,
        'ms': ms,
    })
