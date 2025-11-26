"""
Tag Preset routes for LockCloud
Implements tag preset management endpoints for file categorization
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from auth.models import User
from services.tag_preset_service import tag_preset_service
from functools import wraps


# Create blueprint
tag_presets_bp = Blueprint('tag_presets', __name__)


def admin_required(fn):
    """
    Decorator to require admin privileges for an endpoint
    
    Usage:
        @tag_presets_bp.route('/admin-only', methods=['POST'])
        @jwt_required()
        @admin_required
        def admin_only_endpoint():
            ...
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get user from database
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'error': {
                    'code': 'AUTH_001',
                    'message': '用户不存在'
                }
            }), 401
        
        # Check if user is admin
        if not user.is_admin:
            current_app.logger.warning(
                f'Non-admin user {current_user_id} attempted to access admin endpoint'
            )
            return jsonify({
                'error': {
                    'code': 'TAG_003',
                    'message': '无权限管理标签预设，仅管理员可操作'
                }
            }), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


@tag_presets_bp.route('', methods=['GET'])
@jwt_required()
def get_tag_presets():
    """
    Get active tag presets for a specific category
    
    GET /api/tag-presets?category=activity_type
    GET /api/tag-presets?category=instructor
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - category: Category name ('activity_type' or 'instructor', required)
    
    Returns:
        200: Tag presets retrieved successfully
        400: Invalid or missing category parameter
        401: Unauthorized
        500: Query failed
    """
    try:
        # Get current user ID from JWT (for authentication)
        current_user_id = int(get_jwt_identity())
        
        # Get category parameter
        category = request.args.get('category', '').strip()
        
        if not category:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少必填参数: category'
                }
            }), 400
        
        # Validate category value
        valid_categories = ['activity_type', 'instructor']
        if category not in valid_categories:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': f'无效的category参数。有效值: {", ".join(valid_categories)}'
                }
            }), 400
        
        # Get active presets for the category
        presets = tag_preset_service.get_active_presets(category)
        
        # Convert to dictionaries
        presets_data = [preset.to_dict() for preset in presets]
        
        current_app.logger.info(
            f'User {current_user_id} retrieved {len(presets_data)} tag presets for category: {category}'
        )
        
        return jsonify({
            'success': True,
            'presets': presets_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error getting tag presets: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取标签预设失败，请稍后重试'
            }
        }), 500


@tag_presets_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
def add_tag_preset():
    """
    Add a new tag preset (admin only)
    
    POST /api/tag-presets
    Headers: Authorization: Bearer <token>
    Body: {
        "category": "instructor",
        "value": "li_ming",
        "display_name": "李明"
    }
    
    Returns:
        201: Tag preset created successfully
        400: Invalid input or preset already exists
        401: Unauthorized
        403: Not an admin
        500: Creation failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['category', 'value', 'display_name']
        for field in required_fields:
            if not data or field not in data:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'缺少必填字段: {field}'
                    }
                }), 400
        
        category = data['category'].strip()
        value = data['value'].strip()
        display_name = data['display_name'].strip()
        
        # Validate category value
        valid_categories = ['activity_type', 'instructor']
        if category not in valid_categories:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': f'无效的category参数。有效值: {", ".join(valid_categories)}'
                }
            }), 400
        
        # Validate value and display_name are not empty
        if not value:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': 'value不能为空'
                }
            }), 400
        
        if not display_name:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': 'display_name不能为空'
                }
            }), 400
        
        # Add the preset
        try:
            preset = tag_preset_service.add_preset(
                category=category,
                value=value,
                display_name=display_name,
                created_by=current_user_id
            )
        except ValueError as e:
            # Handle duplicate preset error
            error_message = str(e)
            if '标签已存在' in error_message:
                return jsonify({
                    'error': {
                        'code': 'TAG_002',
                        'message': error_message
                    }
                }), 400
            else:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': error_message
                    }
                }), 400
        
        current_app.logger.info(
            f'Admin user {current_user_id} created tag preset: {category}:{value}'
        )
        
        return jsonify({
            'success': True,
            'message': '标签预设创建成功',
            'preset': preset.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error adding tag preset: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '创建标签预设失败，请稍后重试'
            }
        }), 500


@tag_presets_bp.route('/<int:preset_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def deactivate_tag_preset(preset_id):
    """
    Deactivate a tag preset (admin only)
    
    DELETE /api/tag-presets/{preset_id}
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Tag preset deactivated successfully
        401: Unauthorized
        403: Not an admin
        404: Tag preset not found
        500: Deactivation failed
    """
    try:
        # Get current user ID from JWT
        current_user_id = int(get_jwt_identity())
        
        # Deactivate the preset
        preset = tag_preset_service.deactivate_preset(preset_id)
        
        if not preset:
            return jsonify({
                'error': {
                    'code': 'TAG_001',
                    'message': '标签预设不存在'
                }
            }), 404
        
        current_app.logger.info(
            f'Admin user {current_user_id} deactivated tag preset: {preset_id}'
        )
        
        return jsonify({
            'success': True,
            'message': '标签预设已停用',
            'preset': preset.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': str(e)
            }
        }), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deactivating tag preset: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '停用标签预设失败，请稍后重试'
            }
        }), 500
