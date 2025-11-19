import os
from openai import OpenAI
from typing import List, Dict


class AIService:
    """Service for interacting with AI models"""
    
    def __init__(self):
        self.openai_api_key = os.environ.get('OPENAI_API_KEY', 'sk-default-key')
        self.base_url = 'https://coultra.blueshirtmap.com/v1'
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
    
    def chat(self, messages: List[Dict], model: str = 'gpt-5.1-thinking') -> Dict:
        """
        Send chat messages to AI model and get response
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model ID to use
            
        Returns:
            Dict with 'content'
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Create client with custom base URL and no timeout
            # Allow infinite wait for AI model responses
            client = OpenAI(
                api_key=self.openai_api_key,
                base_url=self.base_url,
                timeout=None  # No timeout - wait for model to complete
            )
            
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            # Debug: log response type and content
            logger.info(f'Response type: {type(response)}')
            
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
                
                return {
                    'content': content,
                    'usage': usage,
                    'model': model_info['name'],
                    'pricing': model_info.get('pricing', {'input': 0, 'output': 0})
                }
            else:
                logger.error(f'Unexpected response format: {response}')
                raise Exception('API 返回格式异常，请联系管理员')
            
        except Exception as e:
            error_msg = str(e)
            
            # Handle rate limit errors
            if '429' in error_msg or 'rate_limit' in error_msg.lower() or 'Rate limit reached' in error_msg:
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
