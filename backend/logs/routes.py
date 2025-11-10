"""
Log routes for LockCloud
Provides endpoints for querying logs and usage statistics
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from logs.service import get_logs, get_usage_summary, get_quarterly_stats
from logs.models import OperationType
from auth.decorators import admin_required

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('', methods=['GET'])
@jwt_required()
@admin_required()
def query_logs():
    """
    Query file logs with filters and pagination
    
    Query Parameters:
        user_id (int): Filter by user ID
        operation (str): Filter by operation type (upload, delete, access)
        start_date (str): Filter logs after this date (ISO format)
        end_date (str): Filter logs before this date (ISO format)
        page (int): Page number (default: 1)
        per_page (int): Results per page (default: 50, max: 100)
    
    Returns:
        JSON response with paginated logs
    """
    try:
        # Get query parameters
        user_id = request.args.get('user_id', type=int)
        operation = request.args.get('operation')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        
        # Validate operation type if provided
        if operation:
            valid_operations = [op.value for op in OperationType]
            if operation not in valid_operations:
                return jsonify({
                    'error': {
                        'code': 'VALIDATION_001',
                        'message': f'操作类型无效。必须是以下之一: {", ".join(valid_operations)}'
                    }
                }), 400
        
        # Query logs
        result = get_logs(
            user_id=user_id,
            operation=operation,
            start_date=start_date,
            end_date=end_date,
            page=page,
            per_page=per_page
        )
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': f'输入数据无效: {str(e)}'
            }
        }), 400
    except Exception as e:
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '查询日志时发生错误',
                'details': str(e)
            }
        }), 500


@logs_bp.route('/summary', methods=['GET'])
@jwt_required()
@admin_required()
def usage_summary():
    """
    Get usage statistics summary
    
    Query Parameters:
        start_date (str): Start date for statistics (ISO format)
        end_date (str): End date for statistics (ISO format)
    
    Returns:
        JSON response with usage statistics
    """
    try:
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Get summary
        summary = get_usage_summary(
            start_date=start_date,
            end_date=end_date
        )
        
        return jsonify({
            'success': True,
            'data': summary
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': f'输入数据无效: {str(e)}'
            }
        }), 400
    except Exception as e:
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取使用统计时发生错误',
                'details': str(e)
            }
        }), 500


@logs_bp.route('/quarterly/<int:year>/<int:quarter>', methods=['GET'])
@jwt_required()
@admin_required()
def quarterly_stats(year, quarter):
    """
    Get quarterly statistics
    
    Path Parameters:
        year (int): Year (e.g., 2025)
        quarter (int): Quarter number (1-4)
    
    Returns:
        JSON response with quarterly statistics
    """
    try:
        # Validate quarter
        if quarter < 1 or quarter > 4:
            return jsonify({
                'error': {
                    'code': 'VALIDATION_001',
                    'message': '季度必须在 1 到 4 之间'
                }
            }), 400
        
        # Get quarterly stats
        stats = get_quarterly_stats(year, quarter)
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': {
                'code': 'VALIDATION_001',
                'message': f'输入数据无效: {str(e)}'
            }
        }), 400
    except Exception as e:
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '获取季度统计时发生错误',
                'details': str(e)
            }
        }), 500
