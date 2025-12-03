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
    Approve a request (apply changes or delete file)
    
    POST /api/requests/{request_id}/approve
    Body: { "response_message": "optional" }
    """
    try:
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
            if 'activity_date' in changes:
                from datetime import datetime
                file.activity_date = datetime.fromisoformat(changes['activity_date']).date()
            if 'activity_type' in changes:
                file.activity_type = changes['activity_type']
            if 'activity_name' in changes:
                file.activity_name = changes['activity_name']
        
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
