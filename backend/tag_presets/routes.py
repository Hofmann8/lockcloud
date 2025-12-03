"""
Tag Preset routes for LockCloud
Implements tag preset query endpoint for file categorization
Note: Activity types are fixed and cannot be added or removed by users.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.tag_preset_service import tag_preset_service


# Create blueprint
tag_presets_bp = Blueprint('tag_presets', __name__)


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


# Note: POST and DELETE endpoints have been removed.
# Activity types are now fixed and cannot be added or removed by users.
