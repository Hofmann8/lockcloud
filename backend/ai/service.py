import os
from openai import OpenAI
from typing import List, Dict, Optional
from ai.tavily_service import tavily_service


class AIService:
    """Service for interacting with AI models"""
    
    def __init__(self):
        self.openai_api_key = os.environ.get('OPENAI_API_KEY', 'sk-default-key')
        # Allow custom base URL from environment variable
        self.base_url = os.environ.get('OPENAI_BASE_URL', 'https://coultra.blueshirtmap.com/v1')
        self.client = None
        
        # Available models configuration
        self.models = [
            {
                'id': 'gpt-5.1-thinking',
                'name': 'LockAI-gpt-5.1-thinking',
                'provider': 'LockAI',
                'description': 'GPT-5.1 思考模型，具备深度推理能力',
                'max_tokens': 128000,
                'pricing': {
                    'input': 1.25,  # USD per million tokens
                    'output': 10.0  # USD per million tokens
                }
            },
            {
                'id': 'gemini-3-pro',
                'name': 'LockAI-gemini-3-pro',
                'provider': 'LockAI',
                'description': 'Gemini 3 Pro 模型，Google 最新一代大语言模型',
                'max_tokens': 128000,
                'pricing': {
                    'input': 0.5,   # USD per million tokens
                    'output': 1.5   # USD per million tokens
                }
            }
        ]
    
    def get_available_models(self) -> List[Dict]:
        """Get list of available AI models"""
        return self.models
    
    def get_model_info(self, model_id: str) -> Dict:
        """Get model information by ID"""
        for model in self.models:
            if model['id'] == model_id:
                return model
        return self.models[0]  # Return first model as default
    
    def chat(
        self, 
        messages: List[Dict], 
        model: str = 'gpt-5.1-thinking',
        use_web_search: bool = False,
        web_search_query: Optional[str] = None
    ) -> Dict:
        """
        Send chat messages to AI model and get response
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model ID to use
            use_web_search: 是否使用网络搜索（手动开关）
            web_search_query: 自定义搜索查询（如果为空，使用最后一条用户消息）
            
        Returns:
            Dict with 'content', 'usage', 'web_search_used', 'search_results'
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # 网络搜索结果
        search_results = None
        
        # 手动模式：如果用户启用网络搜索
        if use_web_search and tavily_service.is_available():
            try:
                logger.info('=' * 60)
                logger.info('[联网搜索] 用户启用了网络搜索功能')
                
                # 确定搜索查询
                if not web_search_query:
                    # 使用最后一条用户消息作为搜索查询
                    for msg in reversed(messages):
                        if msg.get('role') == 'user':
                            web_search_query = msg.get('content', '')
                            break
                    logger.info(f'[联网搜索] 使用用户消息作为搜索查询')
                else:
                    logger.info(f'[联网搜索] 使用自定义搜索查询')
                
                if web_search_query:
                    logger.info(f'[联网搜索] 搜索查询: {web_search_query[:100]}{"..." if len(web_search_query) > 100 else ""}')
                    logger.info(f'[联网搜索] 查询长度: {len(web_search_query)} 字符')
                    
                    # 执行搜索
                    import time
                    search_start = time.time()
                    
                    search_response = tavily_service.search(
                        query=web_search_query,
                        max_results=5,
                        search_depth="basic"
                    )
                    
                    search_elapsed = time.time() - search_start
                    
                    # 保存搜索结果
                    search_results = search_response
                    
                    # 统计搜索结果
                    results_count = len(search_response.get("results", []))
                    has_answer = bool(search_response.get("answer"))
                    
                    logger.info(f'[联网搜索] 搜索完成 - 耗时: {search_elapsed:.2f}秒')
                    logger.info(f'[联网搜索] 找到 {results_count} 条结果')
                    logger.info(f'[联网搜索] 包含答案摘要: {has_answer}')
                    
                    # 将搜索结果添加到上下文
                    search_context = tavily_service.get_context_for_ai(search_response)
                    context_length = len(search_context)
                    
                    logger.info(f'[联网搜索] 生成上下文长度: {context_length} 字符')
                    
                    # 在消息列表中插入搜索上下文
                    messages_with_search = messages.copy()
                    messages_with_search.append({
                        'role': 'system',
                        'content': search_context
                    })
                    messages = messages_with_search
                    
                    logger.info(f'[联网搜索] 已将搜索结果添加到 AI 上下文')
                    logger.info(f'[联网搜索] 消息数量: {len(messages)} (包含搜索上下文)')
                    
                    # 记录搜索结果的URL
                    for i, result in enumerate(search_response.get("results", []), 1):
                        url = result.get('url', '')
                        title = result.get('title', '无标题')
                        logger.debug(f'[联网搜索] 结果 {i}: {title} - {url}')
                    
                    logger.info('=' * 60)
                else:
                    logger.warning('[联网搜索] 未找到有效的搜索查询，跳过网络搜索')
                    
            except Exception as e:
                logger.error('=' * 60)
                logger.error(f'[联网搜索] 搜索失败: {e}')
                logger.error(f'[联网搜索] 错误类型: {type(e).__name__}')
                logger.error('[联网搜索] 将继续使用普通模式（不联网）')
                logger.error('=' * 60)
                # 搜索失败不影响正常对话
        elif use_web_search and not tavily_service.is_available():
            logger.warning('[联网搜索] 用户启用了网络搜索，但 Tavily 服务不可用')
            logger.warning('[联网搜索] 请检查 TAVILY_API_KEY 环境变量配置')
        
        try:
            # Create client with custom base URL and no timeout
            # Allow infinite wait for AI model responses
            client = OpenAI(
                api_key=self.openai_api_key,
                base_url=self.base_url,
                timeout=None  # No timeout - wait for model to complete
            )
            
            logger.info(f'[AI请求] 发送请求到 AI 模型')
            logger.info(f'[AI请求] Model: {model}')
            logger.info(f'[AI请求] Messages: {len(messages)} 条')
            logger.info(f'[AI请求] WebSearch: {use_web_search}')
            logger.info(f'[AI请求] Temperature: 0.7, MaxTokens: 2000')
            
            # 构建请求参数
            import time
            ai_start = time.time()
            
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            ai_elapsed = time.time() - ai_start
            
            logger.info(f'[AI响应] 收到 AI 响应 - 耗时: {ai_elapsed:.2f}秒')
            logger.info(f'[AI响应] Response Type: {type(response).__name__}')
            
            # Check if response is a string (HTML page returned - API error)
            if isinstance(response, str):
                if '<!DOCTYPE html>' in response or '<html' in response:
                    raise Exception('API 返回了 HTML 页面而不是 JSON，请检查 API 地址和密钥是否正确')
                return {
                    'content': response
                }
            
            # Standard OpenAI format
            if hasattr(response, 'choices') and len(response.choices) > 0:
                content = response.choices[0].message.content
                
                # Remove <think> tags from thinking models
                import re
                content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
                content = content.strip()
                
                # Get token usage
                usage = {
                    'prompt_tokens': 0,
                    'completion_tokens': 0,
                    'total_tokens': 0
                }
                
                if hasattr(response, 'usage'):
                    usage['prompt_tokens'] = response.usage.prompt_tokens
                    usage['completion_tokens'] = response.usage.completion_tokens
                    usage['total_tokens'] = response.usage.total_tokens
                
                # Get model info for pricing
                model_info = self.get_model_info(model)
                
                # Check if response contains actual citation URLs
                has_citation_urls = (
                    hasattr(response, 'citations') or 
                    hasattr(response, 'references') or 
                    hasattr(response, 'web_search_results')
                )
                
                # 记录响应统计
                logger.info(f'[AI响应] 内容长度: {len(content)} 字符')
                logger.info(f'[AI响应] Prompt Tokens: {usage["prompt_tokens"]}')
                logger.info(f'[AI响应] Completion Tokens: {usage["completion_tokens"]}')
                logger.info(f'[AI响应] Total Tokens: {usage["total_tokens"]}')
                logger.info(f'[AI响应] 使用了网络搜索: {search_results is not None}')
                
                if search_results is not None:
                    logger.info(f'[AI响应] 搜索结果数量: {len(search_results.get("results", []))}')
                
                return {
                    'content': content,
                    'usage': usage,
                    'model': model_info['name'],
                    'pricing': model_info.get('pricing', {'input': 0, 'output': 0}),
                    'web_search_used': search_results is not None,  # 是否使用了网络搜索
                    'search_results': search_results  # Tavily 搜索结果
                }
            else:
                logger.error(f'Unexpected response format: {response}')
                raise Exception('API 返回格式异常，请联系管理员')
            
        except Exception as e:
            error_msg = str(e)
            
            # Log the full error for debugging
            logger.error(f'=== AI API ERROR ===')
            logger.error(f'Error type: {type(e).__name__}')
            logger.error(f'Error message: {error_msg}')
            logger.error(f'=== END ERROR ===')
            
            # Handle payment/quota errors
            if '402' in error_msg or 'deactivated_workspace' in error_msg.lower():
                raise Exception('API 工作空间已停用或配额不足，请检查账户状态或充值')
            
            # Handle rate limit errors
            elif '429' in error_msg or 'rate_limit' in error_msg.lower() or 'Rate limit reached' in error_msg:
                raise Exception('API 请求速率限制，请等待1-2分钟后重试，或切换到其他节点')
            
            # Handle service unavailable
            elif '503' in error_msg or 'service_unavailable' in error_msg.lower():
                raise Exception('API 服务暂时不可用，请稍后重试或切换节点')
            
            # Handle authentication errors
            elif '401' in error_msg or 'unauthorized' in error_msg.lower():
                raise Exception('API Key 无效或已过期，请检查配置')
            
            # Handle permission errors
            elif '403' in error_msg or 'forbidden' in error_msg.lower():
                raise Exception('API 访问被拒绝，请检查 API Key 权限')
            
            # Handle timeout errors
            elif 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
                raise Exception('请求超时，模型响应时间过长，请稍后重试')
            
            # Handle connection errors
            elif 'connection' in error_msg.lower() or 'network' in error_msg.lower():
                raise Exception('网络连接失败，请检查网络或切换节点')
            
            # Generic error
            else:
                raise Exception(f'AI API 调用失败: {error_msg}')
