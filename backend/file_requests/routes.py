"""
File request routes for LockCloud
Handles edit/delete requests from non-owners
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from files.models import File
from files.request_models import FileRequest
from auth.models import User

requests_bp = Blueprint('requests', __name__)


@requests_bp.route('', methods=['POST'])
@jwt_required()
def create_request():
    """
    Create a new file modification/deletion request
    
    POST /api/requests
    Body: {
        "file_id": 123,
        "request_type": "edit" | "delete",
        "proposed_changes": {...},  // for edit requests
        "message": "optional message"
    }
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '请求数据不能为空'}}), 400
        
        file_id = data.get('file_id')
        request_type = data.get('request_type')
        proposed_changes = data.get('proposed_changes')
        message = data.get('message', '').strip()
        
        if not file_id or not request_type:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '缺少必填字段'}}), 400
        
        if request_type not in ['edit', 'delete']:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '无效的请求类型'}}), 400
        
        # Get file
        file = File.query.get(file_id)
        if not file:
            return jsonify({'error': {'code': 'FILE_001', 'message': '文件不存在'}}), 404
        
        # Can't request changes to own files
        if file.uploader_id == current_user_id:
            return jsonify({'error': {'code': 'REQUEST_001', 'message': '不能对自己的文件发起请求'}}), 400
        
        # Check for existing pending request
        existing = FileRequest.query.filter_by(
            file_id=file_id,
            requester_id=current_user_id,
            status='pending'
        ).first()
        
        if existing:
            return jsonify({'error': {'code': 'REQUEST_002', 'message': '已有待处理的请求'}}), 400
        
        # Create request
        file_request = FileRequest(
            file_id=file_id,
            requester_id=current_user_id,
            owner_id=file.uploader_id,
            request_type=request_type,
            proposed_changes=proposed_changes if request_type == 'edit' else None,
            message=message or None,
        )
        
        db.session.add(file_request)
        db.session.commit()
        
        current_app.logger.info(f'User {current_user_id} created {request_type} request for file {file_id}')
        
        return jsonify({
            'success': True,
            'message': '请求已发送',
            'request': file_request.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating request: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '创建请求失败'}}), 500


@requests_bp.route('/received', methods=['GET'])
@jwt_required()
def get_received_requests():
    """
    Get requests received by current user (as file owner)
    
    GET /api/requests/received?status=pending
    """
    try:
        current_user_id = int(get_jwt_identity())
        status = request.args.get('status', '').strip()
        
        query = FileRequest.query.filter_by(owner_id=current_user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(FileRequest.created_at.desc())
        requests_list = query.all()
        
        return jsonify({
            'success': True,
            'requests': [r.to_dict(include_file=True, include_users=True) for r in requests_list]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting received requests: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '获取请求失败'}}), 500


@requests_bp.route('/sent', methods=['GET'])
@jwt_required()
def get_sent_requests():
    """
    Get requests sent by current user
    
    GET /api/requests/sent?status=pending
    """
    try:
        current_user_id = int(get_jwt_identity())
        status = request.args.get('status', '').strip()
        
        query = FileRequest.query.filter_by(requester_id=current_user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(FileRequest.created_at.desc())
        requests_list = query.all()
        
        return jsonify({
            'success': True,
            'requests': [r.to_dict(include_file=True, include_users=True) for r in requests_list]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting sent requests: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '获取请求失败'}}), 500


@requests_bp.route('/pending-count', methods=['GET'])
@jwt_required()
def get_pending_count():
    """Get count of pending requests for current user"""
    try:
        current_user_id = int(get_jwt_identity())
        count = FileRequest.query.filter_by(owner_id=current_user_id, status='pending').count()
        return jsonify({'success': True, 'count': count}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '获取数量失败'}}), 500


@requests_bp.route('/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_request(request_id):
    """
    Approve a request (apply changes, delete file, or update directory)
    
    POST /api/requests/{request_id}/approve
    Body: { "response_message": "optional" }
    """
    try:
        from datetime import datetime
        
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        file_request = FileRequest.query.get(request_id)
        if not file_request:
            return jsonify({'error': {'code': 'REQUEST_003', 'message': '请求不存在'}}), 404
        
        # Only owner or admin can approve
        is_admin = current_user and current_user.is_admin
        if file_request.owner_id != current_user_id and not is_admin:
            return jsonify({'error': {'code': 'REQUEST_004', 'message': '无权处理此请求'}}), 403
        
        if file_request.status != 'pending':
            return jsonify({'error': {'code': 'REQUEST_005', 'message': '请求已处理'}}), 400
        
        data = request.get_json() or {}
        response_message = data.get('response_message', '').strip()
        
        # Handle directory edit request
        if file_request.request_type == 'directory_edit':
            dir_info = file_request.directory_info or {}
            changes = file_request.proposed_changes or {}
            
            activity_date = datetime.fromisoformat(dir_info['activity_date']).date()
            activity_name = dir_info['activity_name']
            activity_type = dir_info['activity_type']
            
            # Find all files in this directory
            files_to_update = File.query.filter(
                File.activity_date == activity_date,
                File.activity_name == activity_name,
                File.activity_type == activity_type
            ).all()
            
            if not files_to_update:
                file_request.status = 'rejected'
                file_request.response_message = '目录已不存在'
                db.session.commit()
                return jsonify({'error': {'code': 'DIR_001', 'message': '目录已不存在'}}), 404
            
            # Apply changes
            updated_count = 0
            for file in files_to_update:
                if changes.get('new_activity_name'):
                    file.activity_name = changes['new_activity_name']
                if changes.get('new_activity_type'):
                    file.activity_type = changes['new_activity_type']
                updated_count += 1
            
            file_request.status = 'approved'
            file_request.response_message = response_message or None
            db.session.commit()
            
            current_app.logger.info(
                f'Directory request {request_id} approved by user {current_user_id}, updated {updated_count} files'
            )
            
            return jsonify({
                'success': True,
                'message': f'请求已批准，已更新 {updated_count} 个文件',
                'request': file_request.to_dict(),
                'updated_count': updated_count
            }), 200
        
        # Handle file requests (edit/delete)
        file = file_request.file
        if not file:
            file_request.status = 'rejected'
            file_request.response_message = '文件已不存在'
            db.session.commit()
            return jsonify({'error': {'code': 'FILE_001', 'message': '文件已不存在'}}), 404
        
        # Apply the request
        if file_request.request_type == 'delete':
            # Delete the file
            from services.s3_service import s3_service
            try:
                s3_service.delete_file(file.s3_key)
            except Exception as e:
                current_app.logger.warning(f'Failed to delete from S3: {str(e)}')
            
            db.session.delete(file)
            
        elif file_request.request_type == 'edit':
            # Apply proposed changes
            changes = file_request.proposed_changes or {}
            
            old_directory = file.directory
            old_s3_key = file.s3_key
            need_s3_move = False
            
            if 'activity_date' in changes:
                new_date = datetime.fromisoformat(changes['activity_date']).date()
                if file.activity_date != new_date:
                    file.activity_date = new_date
                    need_s3_move = True
            if 'activity_type' in changes:
                if file.activity_type != changes['activity_type']:
                    file.activity_type = changes['activity_type']
                    need_s3_move = True
            if 'activity_name' in changes:
                file.activity_name = changes['activity_name']
            if 'instructor' in changes:
                file.instructor = changes['instructor']
            if 'filename' in changes and changes['filename']:
                new_filename = changes['filename'].strip()
                if file.filename != new_filename:
                    file.filename = new_filename
                    need_s3_move = True
            
            # Handle free_tags update
            if 'free_tags' in changes:
                from services.tag_service import tag_service
                new_tags = changes['free_tags'] or []
                current_tag_names = set(t.name for t in file.tags)
                new_tag_names = set(t.strip() for t in new_tags if t and t.strip())
                
                # Remove old tags
                for tag in list(file.tags):
                    if tag.name not in new_tag_names:
                        tag_service.remove_tag_from_file(file.id, tag.id)
                
                # Add new tags
                for tag_name in new_tag_names:
                    if tag_name not in current_tag_names:
                        tag_service.add_tag_to_file(file.id, tag_name, current_user_id)
            
            # Move file in S3 if needed
            if need_s3_move and file.activity_date and file.activity_type:
                from services.s3_service import s3_service
                
                year = file.activity_date.year
                month = f"{file.activity_date.month:02d}"
                new_directory = f"{file.activity_type}/{year}/{month}"
                file.directory = new_directory
                new_s3_key = f"{new_directory}/{file.filename}"
                
                if new_s3_key != old_s3_key:
                    try:
                        s3_service.copy_file(old_s3_key, new_s3_key)
                        s3_service.delete_file(old_s3_key)
                        file.s3_key = new_s3_key
                        
                        # Update public URL
                        bucket = s3_service.get_bucket_name()
                        endpoint = current_app.config.get('S3_ENDPOINT', 'https://s3.bitiful.net')
                        file.public_url = f"{endpoint}/{bucket}/{new_s3_key}"
                    except Exception as e:
                        current_app.logger.error(f'Failed to move file in S3: {str(e)}')
                        return jsonify({'error': {'code': 'S3_001', 'message': '移动文件失败'}}), 500
        
        file_request.status = 'approved'
        file_request.response_message = response_message or None
        db.session.commit()
        
        current_app.logger.info(f'Request {request_id} approved by user {current_user_id}')
        
        return jsonify({
            'success': True,
            'message': '请求已批准',
            'request': file_request.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error approving request: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '处理请求失败'}}), 500


@requests_bp.route('/<int:request_id>/reject', methods=['POST'])
@jwt_required()
def reject_request(request_id):
    """
    Reject a request
    
    POST /api/requests/{request_id}/reject
    Body: { "response_message": "reason" }
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        file_request = FileRequest.query.get(request_id)
        if not file_request:
            return jsonify({'error': {'code': 'REQUEST_003', 'message': '请求不存在'}}), 404
        
        is_admin = current_user and current_user.is_admin
        if file_request.owner_id != current_user_id and not is_admin:
            return jsonify({'error': {'code': 'REQUEST_004', 'message': '无权处理此请求'}}), 403
        
        if file_request.status != 'pending':
            return jsonify({'error': {'code': 'REQUEST_005', 'message': '请求已处理'}}), 400
        
        data = request.get_json() or {}
        response_message = data.get('response_message', '').strip()
        
        file_request.status = 'rejected'
        file_request.response_message = response_message or None
        db.session.commit()
        
        current_app.logger.info(f'Request {request_id} rejected by user {current_user_id}')
        
        return jsonify({
            'success': True,
            'message': '请求已拒绝',
            'request': file_request.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error rejecting request: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '处理请求失败'}}), 500


@requests_bp.route('/directory', methods=['POST'])
@jwt_required()
def create_directory_request():
    """
    Create a directory edit request (for non-owners)
    
    POST /api/requests/directory
    Body: {
        "activity_date": "2025-03-15",
        "activity_name": "周末团建",
        "activity_type": "team_building",
        "proposed_changes": {
            "new_activity_name": "新活动名称",
            "new_activity_type": "special_event"
        },
        "message": "optional message"
    }
    """
    try:
        from datetime import datetime
        
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '请求数据不能为空'}}), 400
        
        activity_date_str = data.get('activity_date', '').strip()
        activity_name = data.get('activity_name', '').strip()
        activity_type = data.get('activity_type', '').strip()
        proposed_changes = data.get('proposed_changes', {})
        message = data.get('message', '').strip()
        
        if not activity_date_str or not activity_name or not activity_type:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '缺少必填字段'}}), 400
        
        if not proposed_changes.get('new_activity_name') and not proposed_changes.get('new_activity_type'):
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '请提供要修改的内容'}}), 400
        
        # Parse date
        try:
            activity_date = datetime.fromisoformat(activity_date_str).date()
        except ValueError:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '日期格式无效'}}), 400
        
        # Validate new_activity_type if provided
        if proposed_changes.get('new_activity_type'):
            from services.tag_preset_service import tag_preset_service
            activity_type_presets = tag_preset_service.get_active_presets('activity_type')
            valid_types = [p.value for p in activity_type_presets]
            if proposed_changes['new_activity_type'] not in valid_types:
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
            return jsonify({'error': {'code': 'DIR_001', 'message': '目录不存在'}}), 404
        
        owner_id = first_file.uploader_id
        
        # Can't request changes to own directory
        if owner_id == current_user_id:
            return jsonify({'error': {'code': 'REQUEST_001', 'message': '不能对自己的目录发起请求'}}), 400
        
        # Check for existing pending directory request
        pending_requests = FileRequest.query.filter_by(
            requester_id=current_user_id,
            request_type='directory_edit',
            status='pending'
        ).all()
        
        for req in pending_requests:
            dir_info = req.directory_info or {}
            if (dir_info.get('activity_date') == activity_date_str and
                dir_info.get('activity_name') == activity_name and
                dir_info.get('activity_type') == activity_type):
                return jsonify({'error': {'code': 'REQUEST_002', 'message': '已有待处理的目录修改请求'}}), 400
        
        # Create request
        directory_info = {
            'activity_date': activity_date_str,
            'activity_name': activity_name,
            'activity_type': activity_type
        }
        
        file_request = FileRequest(
            file_id=None,  # Directory requests don't link to a single file
            requester_id=current_user_id,
            owner_id=owner_id,
            request_type='directory_edit',
            proposed_changes=proposed_changes,
            directory_info=directory_info,
            message=message or None,
        )
        
        db.session.add(file_request)
        db.session.commit()
        
        current_app.logger.info(f'User {current_user_id} created directory edit request for {activity_name}')
        
        return jsonify({
            'success': True,
            'message': '目录修改请求已发送',
            'request': file_request.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating directory request: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '创建请求失败'}}), 500


@requests_bp.route('/batch', methods=['POST'])
@jwt_required()
def batch_create_requests():
    """
    Batch create file modification requests for multiple files
    
    POST /api/requests/batch
    Body: {
        "file_ids": [1, 2, 3],
        "proposed_changes": {
            "activity_date": "2025-03-20",
            "activity_type": "performance",
            "activity_name": "新活动名称",
            "free_tags": ["tag1", "tag2"]
        }
    }
    
    Returns:
        200: All requests created successfully
        207: Partial success (some requests failed)
        400: Invalid input
        401: Unauthorized
        500: Creation failed
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '请求数据不能为空'}}), 400
        
        file_ids = data.get('file_ids', [])
        proposed_changes = data.get('proposed_changes', {})
        
        if not file_ids:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '文件ID列表不能为空'}}), 400
        
        if not proposed_changes:
            return jsonify({'error': {'code': 'VALIDATION_001', 'message': '修改内容不能为空'}}), 400
        
        # Validate batch size limit (max 100)
        if len(file_ids) > 100:
            return jsonify({'error': {'code': 'BATCH_002', 'message': '批量操作限制最多100个文件'}}), 400
        
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
            
            # Can't request changes to own files
            if file.uploader_id == current_user_id:
                failed.append({
                    'file_id': file_id,
                    'error': '不能对自己的文件发起请求'
                })
                continue
            
            # Check for existing pending request
            existing = FileRequest.query.filter_by(
                file_id=file_id,
                requester_id=current_user_id,
                status='pending'
            ).first()
            
            if existing:
                failed.append({
                    'file_id': file_id,
                    'error': '已有待处理的请求'
                })
                continue
            
            try:
                # Create request
                file_request = FileRequest(
                    file_id=file_id,
                    requester_id=current_user_id,
                    owner_id=file.uploader_id,
                    request_type='edit',
                    proposed_changes=proposed_changes,
                    message=None,
                )
                
                db.session.add(file_request)
                succeeded.append(file_id)
                
            except Exception as e:
                current_app.logger.error(f'Error creating request for file {file_id}: {str(e)}')
                failed.append({
                    'file_id': file_id,
                    'error': str(e)
                })
        
        # Commit all successful requests
        if succeeded:
            db.session.commit()
        
        current_app.logger.info(
            f'User {current_user_id} batch created {len(succeeded)} requests, {len(failed)} failed'
        )
        
        # Return appropriate response
        if len(failed) == 0:
            return jsonify({
                'success': True,
                'message': f'成功发送 {len(succeeded)} 个修改请求',
                'results': {
                    'succeeded': succeeded,
                    'failed': failed
                }
            }), 200
        elif len(succeeded) == 0:
            return jsonify({
                'success': False,
                'message': '所有请求发送失败',
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
        current_app.logger.error(f'Error in batch create requests: {str(e)}')
        return jsonify({'error': {'code': 'INTERNAL_ERROR', 'message': '批量创建请求失败'}}), 500
