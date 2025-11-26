from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from ai.models import AIConversation, AIMessage
from ai.service import AIService
from ai.queue_manager_redis import queue_manager
from exceptions import LockCloudException
import uuid

ai_bp = Blueprint('ai', __name__)
ai_service = AIService()


@ai_bp.route('/models', methods=['GET'])
@jwt_required()
def get_available_models():
    """Get list of available AI models"""
    models = ai_service.get_available_models()
    return jsonify({'models': models}), 200


@ai_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    """Get user's conversation history"""
    user_id = get_jwt_identity()
    
    conversations = AIConversation.query.filter_by(user_id=user_id)\
        .order_by(AIConversation.created_at.desc())\
        .all()
    
    return jsonify({
        'conversations': [conv.to_dict() for conv in conversations]
    }), 200


@ai_bp.route('/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    """Create a new conversation"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    model = data.get('model', 'gpt-3.5-turbo')
    
    conversation = AIConversation(
        user_id=user_id,
        model=model
    )
    
    db.session.add(conversation)
    db.session.commit()
    
    return jsonify(conversation.to_dict()), 201


@ai_bp.route('/conversations/<int:conversation_id>', methods=['GET'])
@jwt_required()
def get_conversation(conversation_id):
    """Get conversation details with messages"""
    user_id = get_jwt_identity()
    
    conversation = AIConversation.query.filter_by(
        id=conversation_id,
        user_id=user_id
    ).first()
    
    if not conversation:
        raise LockCloudException('AI_001', '对话不存在', 404)
    
    messages = AIMessage.query.filter_by(conversation_id=conversation_id)\
        .order_by(AIMessage.created_at.asc())\
        .all()
    
    # Get model pricing for calculating costs
    from ai.service import AIService
    ai_service = AIService()
    model_info = ai_service.get_model_info(conversation.model)
    pricing = model_info.get('pricing', {'input': 0, 'output': 0})
    
    # Add pricing info to each message
    messages_with_pricing = []
    for msg in messages:
        msg_dict = msg.to_dict()
        if msg.role == 'assistant':
            msg_dict['model_name'] = model_info.get('name', conversation.model)
            msg_dict['pricing'] = pricing
        messages_with_pricing.append(msg_dict)
    
    return jsonify({
        'conversation': conversation.to_dict(),
        'messages': messages_with_pricing
    }), 200


@ai_bp.route('/conversations/<int:conversation_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conversation_id):
    """Delete a conversation"""
    user_id = get_jwt_identity()
    
    conversation = AIConversation.query.filter_by(
        id=conversation_id,
        user_id=user_id
    ).first()
    
    if not conversation:
        raise LockCloudException('AI_001', '对话不存在', 404)
    
    db.session.delete(conversation)
    db.session.commit()
    
    return jsonify({'message': '对话已删除'}), 200


@ai_bp.route('/conversations/<int:conversation_id>/title', methods=['PUT'])
@jwt_required()
def update_conversation_title(conversation_id):
    """Update conversation title"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    title = data.get('title', '').strip()
    if not title:
        raise LockCloudException('AI_005', '标题不能为空', 400)
    
    if len(title) > 200:
        raise LockCloudException('AI_006', '标题过长（最多200字符）', 400)
    
    conversation = AIConversation.query.filter_by(
        id=conversation_id,
        user_id=user_id
    ).first()
    
    if not conversation:
        raise LockCloudException('AI_001', '对话不存在', 404)
    
    conversation.title = title
    db.session.commit()
    
    return jsonify(conversation.to_dict()), 200


@ai_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    """Send a message and get AI response (with queue support)"""
    import logging
    logger = logging.getLogger(__name__)
    
    user_id = get_jwt_identity()
    data = request.get_json()
    
    conversation_id = data.get('conversation_id')
    message = data.get('message')
    model = data.get('model', 'gpt-5.1-thinking')
    use_queue = data.get('use_queue', True)  # 默认使用队列
    use_web_search = data.get('use_web_search', False)  # 是否使用网络搜索（手动开关）
    web_search_query = data.get('web_search_query')  # 自定义搜索查询
    
    logger.info(f'AI chat request - User: {user_id}, Model: {model}, UseQueue: {use_queue}')
    
    if not message:
        raise LockCloudException('AI_002', '消息内容不能为空', 400)
    
    # Create conversation if not exists
    if not conversation_id:
        conversation = AIConversation(user_id=user_id, model=model)
        db.session.add(conversation)
        try:
            db.session.flush()
        except Exception as e:
            db.session.rollback()
            if 'database is locked' in str(e).lower():
                raise LockCloudException('AI_004', '数据库繁忙，请稍后重试', 503)
            raise
        conversation_id = conversation.id
    else:
        conversation = AIConversation.query.filter_by(
            id=conversation_id,
            user_id=user_id
        ).first()
        
        if not conversation:
            # 对话不存在，创建新对话
            logger.warning(f'Conversation {conversation_id} not found for user {user_id}, creating new one')
            conversation = AIConversation(user_id=user_id, model=model)
            db.session.add(conversation)
            try:
                db.session.flush()
            except Exception as e:
                db.session.rollback()
                if 'database is locked' in str(e).lower():
                    raise LockCloudException('AI_004', '数据库繁忙，请稍后重试', 503)
                raise
            conversation_id = conversation.id
    
    # Save user message
    user_message = AIMessage(
        conversation_id=conversation_id,
        role='user',
        content=message
    )
    db.session.add(user_message)
    
    # 先提交用户消息
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        if 'database is locked' in str(e).lower():
            raise LockCloudException('AI_004', '数据库繁忙，请稍后重试', 503)
        raise
    
    # Get conversation history
    history = AIMessage.query.filter_by(conversation_id=conversation_id)\
        .order_by(AIMessage.created_at.asc())\
        .all()
    
    messages = [{'role': msg.role, 'content': msg.content} for msg in history]
    
    # 使用队列处理请求
    if use_queue:
        try:
            request_id = str(uuid.uuid4())
            logger.info(f'Adding request to queue - RequestID: {request_id}')
            
            # 定义 AI 请求处理函数（在工作线程中执行）
            def process_ai_request():
                """处理 AI 请求的回调函数"""
                try:
                    logger.info(f'Processing AI request - Conversation: {conversation_id}, WebSearch: {use_web_search}')
                    response_data = ai_service.chat(
                        messages, 
                        model,
                        use_web_search=use_web_search,
                        web_search_query=web_search_query
                    )
                    logger.info(f'AI response received - Conversation: {conversation_id}')
                    
                    # 在工作线程中，需要创建新的会话
                    # 使用 scoped_session 确保线程安全
                    from sqlalchemy.orm import scoped_session, sessionmaker
                    from app import db as db_module
                    
                    # 创建线程本地会话
                    session_factory = sessionmaker(bind=db_module.engine)
                    Session = scoped_session(session_factory)
                    session = Session()
                    
                    try:
                        # Save assistant message with usage info
                        usage = response_data.get('usage', {})
                        assistant_message = AIMessage(
                            conversation_id=conversation_id,
                            role='assistant',
                            content=response_data['content'],
                            prompt_tokens=usage.get('prompt_tokens', 0),
                            completion_tokens=usage.get('completion_tokens', 0),
                            total_tokens=usage.get('total_tokens', 0)
                        )
                        session.add(assistant_message)
                        
                        # Update user message with 0 tokens
                        user_msg = session.query(AIMessage).filter_by(
                            conversation_id=conversation_id,
                            role='user'
                        ).order_by(AIMessage.created_at.desc()).first()
                        
                        if user_msg:
                            user_msg.prompt_tokens = 0
                            user_msg.completion_tokens = 0
                            user_msg.total_tokens = 0
                        
                        # Update user's AI usage statistics
                        from auth.models import User
                        user = session.query(User).get(user_id)
                        if user:
                            prompt_tokens = usage.get('prompt_tokens', 0)
                            completion_tokens = usage.get('completion_tokens', 0)
                            total_tokens = usage.get('total_tokens', 0)
                            
                            # Calculate cost
                            pricing = response_data.get('pricing', {'input': 0, 'output': 0})
                            input_cost = (prompt_tokens / 1000000) * pricing['input']
                            output_cost = (completion_tokens / 1000000) * pricing['output']
                            message_cost = input_cost + output_cost
                            
                            # Update user statistics
                            user.ai_total_prompt_tokens = (user.ai_total_prompt_tokens or 0) + prompt_tokens
                            user.ai_total_completion_tokens = (user.ai_total_completion_tokens or 0) + completion_tokens
                            user.ai_total_tokens = (user.ai_total_tokens or 0) + total_tokens
                            user.ai_total_cost = (user.ai_total_cost or 0.0) + message_cost
                        
                        # 提交事务
                        session.commit()
                        
                        # 获取消息字典（在会话关闭前）
                        message_dict = assistant_message.to_dict()
                        
                        return {
                            'conversation_id': conversation_id,
                            'message': message_dict,
                            'model_name': response_data.get('model', model),
                            'usage': usage,
                            'pricing': response_data.get('pricing', {'input': 0, 'output': 0}),
                            'web_search_used': response_data.get('web_search_used', False),
                            'search_results': response_data.get('search_results')
                        }
                        
                    except Exception as e:
                        session.rollback()
                        raise e
                    finally:
                        session.close()
                        Session.remove()
                    
                except Exception as e:
                    raise e
            
            # 添加到队列
            app_context = current_app.app_context()
            queue_manager.add_request(request_id, user_id, process_ai_request, app_context)
            
            logger.info(f'Request {request_id} added to queue, returning request_id to client')
            
            # 等待轮到自己（Redis 模式）或等待工作线程处理（内存模式）
            if queue_manager.use_redis:
                # Redis 模式：等待轮到自己
                if not queue_manager.try_acquire_processing_slot(request_id, timeout=300):
                    raise LockCloudException('AI_003', '请求超时，请稍后重试', 504)
                
                # 标记为正在处理
                queue_manager.update_request_status(request_id, 'processing')
                
                # 在当前进程中执行
                try:
                    result_data = process_ai_request()
                    queue_manager.update_request_status(request_id, 'completed', result=result_data)
                except Exception as e:
                    queue_manager.update_request_status(request_id, 'failed', error=str(e))
                    raise
                
                # 获取结果
                result = queue_manager.get_request_status(request_id)
            else:
                # 内存模式：等待工作线程处理完成
                result = queue_manager.wait_for_completion(request_id, timeout=300)
            
            if result['status'] == 'failed':
                error_msg = result.get('error', 'Unknown error')
                logger.error(f'Queue request failed - User: {user_id}, Error: {error_msg}')
                
                # Return appropriate status code based on error type
                if 'rate_limit' in error_msg.lower() or 'Rate limit reached' in error_msg:
                    raise LockCloudException('AI_003', error_msg, 429)
                elif '503' in error_msg or 'service_unavailable' in error_msg.lower():
                    raise LockCloudException('AI_003', error_msg, 503)
                else:
                    raise LockCloudException('AI_003', f'AI 服务错误: {error_msg}', 500)
            
            # 在返回结果中包含 request_id
            response_data = result['result']
            response_data['request_id'] = request_id
            return jsonify(response_data), 200
            
        except TimeoutError:
            raise LockCloudException('AI_003', '请求超时，请稍后重试', 504)
        except LockCloudException:
            raise
        except Exception as e:
            error_msg = str(e)
            logger.error(f'Queue error - User: {user_id}, Error: {error_msg}')
            raise LockCloudException('AI_003', f'队列处理错误: {error_msg}', 500)
    
    # 不使用队列，直接处理
    else:
        try:
            logger.info(f'Processing AI request directly - Conversation: {conversation_id}, WebSearch: {use_web_search}')
            response_data = ai_service.chat(
                messages, 
                model,
                use_web_search=use_web_search,
                web_search_query=web_search_query
            )
            logger.info(f'AI response received - Conversation: {conversation_id}')
            
            # Save assistant message with usage info
            usage = response_data.get('usage', {})
            assistant_message = AIMessage(
                conversation_id=conversation_id,
                role='assistant',
                content=response_data['content'],
                prompt_tokens=usage.get('prompt_tokens', 0),
                completion_tokens=usage.get('completion_tokens', 0),
                total_tokens=usage.get('total_tokens', 0)
            )
            db.session.add(assistant_message)
            
            # Update user message with 0 tokens
            user_message.prompt_tokens = 0
            user_message.completion_tokens = 0
            user_message.total_tokens = 0
            
            # Update user's AI usage statistics
            from auth.models import User
            user = User.query.get(user_id)
            if user:
                prompt_tokens = usage.get('prompt_tokens', 0)
                completion_tokens = usage.get('completion_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)
                
                # Calculate cost
                pricing = response_data.get('pricing', {'input': 0, 'output': 0})
                input_cost = (prompt_tokens / 1000000) * pricing['input']
                output_cost = (completion_tokens / 1000000) * pricing['output']
                message_cost = input_cost + output_cost
                
                # Update user statistics
                user.ai_total_prompt_tokens = (user.ai_total_prompt_tokens or 0) + prompt_tokens
                user.ai_total_completion_tokens = (user.ai_total_completion_tokens or 0) + completion_tokens
                user.ai_total_tokens = (user.ai_total_tokens or 0) + total_tokens
                user.ai_total_cost = (user.ai_total_cost or 0.0) + message_cost
            
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                if 'database is locked' in str(e).lower():
                    raise LockCloudException('AI_004', '数据库繁忙，请稍后重试', 503)
                raise
            
            return jsonify({
                'conversation_id': conversation_id,
                'message': assistant_message.to_dict(),
                'model_name': response_data.get('model', model),
                'usage': usage,
                'pricing': response_data.get('pricing', {'input': 0, 'output': 0}),
                'web_search_used': response_data.get('web_search_used', False),
                'search_results': response_data.get('search_results')
            }), 200
            
        except Exception as e:
            db.session.rollback()
            error_msg = str(e)
            logger.error(f'AI service error - User: {user_id}, Error: {error_msg}')
            
            # Return appropriate status code based on error type
            if 'rate_limit' in error_msg.lower() or 'Rate limit reached' in error_msg:
                raise LockCloudException('AI_003', error_msg, 429)
            elif '503' in error_msg or 'service_unavailable' in error_msg.lower():
                raise LockCloudException('AI_003', error_msg, 503)
            else:
                raise LockCloudException('AI_003', f'AI 服务错误: {error_msg}', 500)


@ai_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get user's usage statistics"""
    user_id = get_jwt_identity()
    
    # Get user's overall statistics from user table
    from auth.models import User
    user = User.query.get(user_id)
    
    if not user:
        raise LockCloudException('AI_007', '用户不存在', 404)
    
    # Get conversations for detailed breakdown
    conversations = AIConversation.query.filter_by(user_id=user_id).all()
    
    # Group by model for detailed statistics
    usage_by_model = {}
    for conv in conversations:
        if conv.model not in usage_by_model:
            usage_by_model[conv.model] = {
                'conversation_count': 0,
                'message_count': 0,
                'prompt_tokens': 0,
                'completion_tokens': 0,
                'total_tokens': 0
            }
        usage_by_model[conv.model]['conversation_count'] += 1
        
        # Sum up tokens from all messages in this conversation
        for msg in conv.messages:
            if msg.role == 'assistant':  # Only count assistant messages
                usage_by_model[conv.model]['message_count'] += 1
                usage_by_model[conv.model]['prompt_tokens'] += msg.prompt_tokens or 0
                usage_by_model[conv.model]['completion_tokens'] += msg.completion_tokens or 0
                usage_by_model[conv.model]['total_tokens'] += msg.total_tokens or 0
    
    # Get model pricing from AI service
    from ai.service import AIService
    ai_service = AIService()
    
    # Calculate cost per model
    for model_id, stats in usage_by_model.items():
        model_info = ai_service.get_model_info(model_id)
        pricing = model_info.get('pricing', {'input': 0, 'output': 0})
        
        input_cost = (stats['prompt_tokens'] / 1000000) * pricing['input']
        output_cost = (stats['completion_tokens'] / 1000000) * pricing['output']
        model_cost = input_cost + output_cost
        
        stats['cost'] = model_cost
        stats['pricing'] = pricing
    
    # Return user's overall statistics from user table
    return jsonify({
        'total_prompt_tokens': user.ai_total_prompt_tokens or 0,
        'total_completion_tokens': user.ai_total_completion_tokens or 0,
        'total_tokens': user.ai_total_tokens or 0,
        'total_cost': user.ai_total_cost or 0.0,
        'usage_by_model': usage_by_model
    }), 200


@ai_bp.route('/queue/status', methods=['GET'])
@jwt_required()
def get_queue_status():
    """Get current queue status with user information"""
    import logging
    logger = logging.getLogger(__name__)
    
    from auth.models import User
    
    status = queue_manager.get_queue_status()
    
    # 获取所有涉及的用户ID
    user_ids = set()
    for item in status['queue_items']:
        user_ids.add(item['user_id'])
    for item in status['processing_items']:
        user_ids.add(item['user_id'])
    
    logger.info(f'Queue status - User IDs: {user_ids}')
    
    # 查询用户信息（确保 user_id 是整数）
    users = {}
    if user_ids:
        # 转换为整数集合
        int_user_ids = set()
        for uid in user_ids:
            try:
                int_user_ids.add(int(uid))
            except (ValueError, TypeError):
                logger.warning(f'Invalid user_id: {uid}')
        
        logger.info(f'Querying users with IDs: {int_user_ids}')
        user_list = User.query.filter(User.id.in_(int_user_ids)).all()
        logger.info(f'Found {len(user_list)} users in database')
        for user in user_list:
            # 同时用整数和字符串作为键，兼容两种情况
            users[user.id] = {
                'id': user.id,
                'name': user.name,
                'email': user.email
            }
            users[str(user.id)] = users[user.id]  # 字符串键
            logger.info(f'User {user.id}: name={user.name}, email={user.email}')
    
    # 添加用户信息到队列项
    for item in status['queue_items']:
        user_info = users.get(item['user_id'])
        if user_info:
            item['user_name'] = user_info['name']
            item['user_email'] = user_info['email']
            logger.info(f'Added user info to queue item: {item["user_id"]} -> {user_info["name"]}')
        else:
            logger.warning(f'User {item["user_id"]} not found in database')
    
    for item in status['processing_items']:
        user_info = users.get(item['user_id'])
        if user_info:
            item['user_name'] = user_info['name']
            item['user_email'] = user_info['email']
            logger.info(f'Added user info to processing item: {item["user_id"]} -> {user_info["name"]}')
        else:
            logger.warning(f'User {item["user_id"]} not found in database')
    
    return jsonify(status), 200


@ai_bp.route('/queue/cancel/<request_id>', methods=['POST'])
@jwt_required()
def cancel_request(request_id):
    """Cancel a pending AI request"""
    import logging
    logger = logging.getLogger(__name__)
    
    user_id = get_jwt_identity()
    
    logger.info('='*60)
    logger.info(f'[API] 收到取消请求')
    logger.info(f'[API] User: {user_id}, RequestID: {request_id}')
    logger.info('='*60)
    
    # 尝试取消请求
    success = queue_manager.cancel_request(request_id, user_id)
    
    if success:
        return jsonify({
            'message': '请求已取消',
            'success': True
        }), 200
    else:
        # 检查请求状态
        status = queue_manager.get_request_status(request_id)
        
        if not status:
            raise LockCloudException('AI_008', '请求不存在或已过期', 404)
        
        if status.get('status') == 'processing':
            raise LockCloudException('AI_009', '请求正在处理中，无法取消', 400)
        
        if status.get('status') in ['completed', 'failed', 'cancelled']:
            raise LockCloudException('AI_010', f'请求已{status.get("status")}，无法取消', 400)
        
        raise LockCloudException('AI_011', '取消请求失败', 500)


@ai_bp.route('/queue/clear', methods=['POST'])
@jwt_required()
def clear_queue():
    """Clear all queues (admin only, for debugging)"""
    from auth.decorators import admin_required
    from auth.models import User
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or not user.is_admin:
        raise LockCloudException('AUTH_003', '需要管理员权限', 403)
    
    queue_manager.clear_all_queues()
    
    return jsonify({
        'message': '队列已清空',
        'success': True
    }), 200


@ai_bp.route('/admin/usage', methods=['GET'])
@jwt_required()
def get_all_users_usage():
    """Get all users' AI usage statistics (admin only)"""
    from auth.models import User
    from auth.decorators import admin_required
    
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or not current_user.is_admin:
        raise LockCloudException('AUTH_003', '需要管理员权限', 403)
    
    # Get all users with their AI statistics
    users = User.query.all()
    
    users_stats = []
    total_system_cost = 0.0
    total_system_tokens = 0
    
    for user in users:
        # Only include users who have used AI (have tokens or cost)
        if (user.ai_total_tokens and user.ai_total_tokens > 0) or (user.ai_total_cost and user.ai_total_cost > 0):
            users_stats.append({
                'user_id': user.id,
                'email': user.email,
                'name': user.name,
                'total_prompt_tokens': user.ai_total_prompt_tokens or 0,
                'total_completion_tokens': user.ai_total_completion_tokens or 0,
                'total_tokens': user.ai_total_tokens or 0,
                'total_cost': user.ai_total_cost or 0.0
            })
            total_system_cost += user.ai_total_cost or 0.0
            total_system_tokens += user.ai_total_tokens or 0
    
    # Sort by total cost descending
    users_stats.sort(key=lambda x: x['total_cost'], reverse=True)
    
    return jsonify({
        'users': users_stats,
        'summary': {
            'total_system_cost': total_system_cost,
            'total_system_tokens': total_system_tokens
        }
    }), 200
