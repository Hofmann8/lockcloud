"""
Tag management routes for LockCloud
Implements tag listing and search endpoints
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.tag_service import tag_service
from extensions import limiter


# Create blueprint
tags_bp = Blueprint('tags', __name__)

# Exempt OPTIONS requests from rate limiting (for CORS preflight)
@tags_bp.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return '', 200


@tags_bp.route('', methods=['GET'])
@jwt_required()
def list_tags():
    """
    List all tags with usage count
    
    GET /api/tags
    Headers: Authorization: Bearer <token>
    
    Returns:
        200: Tag list retrieved successfully
        401: Unauthorized
        500: Query failed
    
    Requirements: 7.4
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        tags = tag_service.get_all_tags_with_count()
        
        current_app.logger.info(
            f'User {current_user_id} listed {len(tags)} tags'
        )
        
        return jsonify({
            'success': True,
            'tags': [
                {'id': t.id, 'name': t.name, 'count': t.count}
                for t in tags
            ]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error listing tags: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取标签列表失败，请稍后重试'
            }
        }), 500


@tags_bp.route('/search', methods=['GET'])
@limiter.limit("30 per minute")  # More lenient limit for search
@jwt_required()
def search_tags():
    """
    Search tags by prefix
    
    GET /api/tags/search?q=prefix&limit=10
    Headers: Authorization: Bearer <token>
    Query Parameters:
        - q: Search prefix (required)
        - limit: Maximum results (default: 10, max: 50)
    
    Returns:
        200: Search results retrieved successfully
        400: Missing search query
        401: Unauthorized
        500: Query failed
    
    Requirements: 6.1, 6.2
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get search prefix
        prefix = request.args.get('q', '').strip()
        if not prefix:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '缺少搜索关键词参数 (q)'
                }
            }), 400
        
        # Get limit parameter
        limit = request.args.get('limit', 10, type=int)
        if limit < 1:
            limit = 10
        if limit > 50:
            limit = 50
        
        tags = tag_service.search_tags(prefix, limit)
        
        current_app.logger.info(
            f'User {current_user_id} searched tags with prefix "{prefix}", found {len(tags)} results'
        )
        
        return jsonify({
            'success': True,
            'tags': [
                {'id': t.id, 'name': t.name, 'count': t.count}
                for t in tags
            ]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error searching tags: {str(e)}')
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '搜索标签失败，请稍后重试'
            }
        }), 500
