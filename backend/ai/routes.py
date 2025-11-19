from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from ai.models import AIConversation, AIMessage
from ai.service import AIService
from exceptions import LockCloudException

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
    
    return jsonify({
        'conversation': conversation.to_dict(),
        'messages': [msg.to_dict() for msg in messages]
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
    """Send a message and get AI response"""
    import logging
    logger = logging.getLogger(__name__)
    
    user_id = get_jwt_identity()
    data = request.get_json()
    
    conversation_id = data.get('conversation_id')
    message = data.get('message')
    model = data.get('model', 'gpt-5.1-thinking')
    
    logger.info(f'AI chat request - User: {user_id}, Model: {model}')
    
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
            raise LockCloudException('AI_001', '对话不存在', 404)
    
    # Save user message
    user_message = AIMessage(
        conversation_id=conversation_id,
        role='user',
        content=message
    )
    db.session.add(user_message)
    
    # Get conversation history
    history = AIMessage.query.filter_by(conversation_id=conversation_id)\
        .order_by(AIMessage.created_at.asc())\
        .all()
    
    messages = [{'role': msg.role, 'content': msg.content} for msg in history]
    messages.append({'role': 'user', 'content': message})
    
    # Get AI response
    try:
        logger.info(f'Sending request to AI service - Conversation: {conversation_id}')
        response_data = ai_service.chat(messages, model)
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
            'pricing': response_data.get('pricing', {'input': 0, 'output': 0})
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
    
    conversations = AIConversation.query.filter_by(user_id=user_id).all()
    
    # Calculate total tokens and cost
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    
    # Group by model
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
                
                total_prompt_tokens += msg.prompt_tokens or 0
                total_completion_tokens += msg.completion_tokens or 0
                total_tokens += msg.total_tokens or 0
    
    # Get model pricing from AI service
    from ai.service import AIService
    ai_service = AIService()
    
    # Calculate total cost
    total_cost = 0
    for model_id, stats in usage_by_model.items():
        model_info = ai_service.get_model_info(model_id)
        pricing = model_info.get('pricing', {'input': 0, 'output': 0})
        
        input_cost = (stats['prompt_tokens'] / 1000000) * pricing['input']
        output_cost = (stats['completion_tokens'] / 1000000) * pricing['output']
        model_cost = input_cost + output_cost
        
        stats['cost'] = model_cost
        stats['pricing'] = pricing
        total_cost += model_cost
    
    return jsonify({
        'conversation_count': len(conversations),
        'total_prompt_tokens': total_prompt_tokens,
        'total_completion_tokens': total_completion_tokens,
        'total_tokens': total_tokens,
        'total_cost': total_cost,
        'usage_by_model': usage_by_model
    }), 200
