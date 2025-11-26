"""
Tavily Web Search Service for LockAI
提供联网搜索功能，增强 AI 回答的准确性和时效性
"""
import os
import logging
from typing import List, Dict, Optional
from tavily import TavilyClient

# 配置日志
logger = logging.getLogger(__name__)


class TavilySearchService:
    """Tavily 联网搜索服务"""
    
    def __init__(self):
        self.api_key = os.environ.get('TAVILY_API_KEY')
        self.client = None
        
        if self.api_key and self.api_key != 'your-tavily-api-key-here':
            try:
                self.client = TavilyClient(api_key=self.api_key)
                logger.info('✓ Tavily 客户端初始化成功')
                print(f'✓ Tavily 客户端初始化成功')
            except Exception as e:
                logger.error(f'✗ Tavily 初始化失败: {e}', exc_info=True)
                print(f'✗ Tavily 初始化失败: {e}')
                import traceback
                traceback.print_exc()
        else:
            logger.warning('Tavily API Key 未配置或无效，联网搜索功能不可用')
    
    def is_available(self) -> bool:
        """检查 Tavily 服务是否可用"""
        available = self.client is not None
        if not available:
            logger.debug('Tavily 服务不可用：客户端未初始化')
        return available
    
    def search(
        self, 
        query: str, 
        max_results: int = 5,
        search_depth: str = "basic",
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None
    ) -> Dict:
        """
        执行网络搜索
        
        Args:
            query: 搜索查询
            max_results: 最大结果数量 (1-10)
            search_depth: 搜索深度 ("basic" 或 "advanced")
            include_domains: 包含的域名列表
            exclude_domains: 排除的域名列表
            
        Returns:
            搜索结果字典，包含 results 和 answer
        """
        if not self.is_available():
            logger.error('Tavily 搜索失败：服务未配置或不可用')
            raise Exception('Tavily 服务未配置或不可用，请检查 TAVILY_API_KEY')
        
        # 记录搜索请求
        logger.info(f'[Tavily] 开始网络搜索')
        logger.info(f'[Tavily] 查询: {query[:200]}{"..." if len(query) > 200 else ""}')
        logger.info(f'[Tavily] 参数: max_results={max_results}, search_depth={search_depth}')
        if include_domains:
            logger.info(f'[Tavily] 包含域名: {include_domains}')
        if exclude_domains:
            logger.info(f'[Tavily] 排除域名: {exclude_domains}')
        
        try:
            # 调用 Tavily API
            import time
            start_time = time.time()
            
            response = self.client.search(
                query=query,
                max_results=max_results,
                search_depth=search_depth,
                include_domains=include_domains,
                exclude_domains=exclude_domains,
                include_answer=True,  # 包含 AI 生成的答案摘要
                include_raw_content=False  # 不包含原始内容（节省 token）
            )
            
            elapsed_time = time.time() - start_time
            
            # 记录搜索结果
            results_count = len(response.get('results', []))
            has_answer = bool(response.get('answer'))
            
            logger.info(f'[Tavily] 搜索完成 - 耗时: {elapsed_time:.2f}秒')
            logger.info(f'[Tavily] 结果数量: {results_count}')
            logger.info(f'[Tavily] 包含答案摘要: {has_answer}')
            
            # 记录每个搜索结果的详细信息
            for i, result in enumerate(response.get('results', []), 1):
                title = result.get('title', '无标题')
                url = result.get('url', '')
                score = result.get('score', 0)
                content_length = len(result.get('content', ''))
                
                logger.debug(f'[Tavily] 结果 {i}: {title}')
                logger.debug(f'[Tavily]   URL: {url}')
                logger.debug(f'[Tavily]   相关度: {score:.3f}')
                logger.debug(f'[Tavily]   内容长度: {content_length} 字符')
            
            # 记录答案摘要（如果有）
            if has_answer:
                answer_preview = response['answer'][:200]
                logger.debug(f'[Tavily] 答案摘要: {answer_preview}{"..." if len(response["answer"]) > 200 else ""}')
            
            return response
            
        except Exception as e:
            error_msg = str(e)
            
            # 记录错误详情
            logger.error(f'[Tavily] 搜索失败: {error_msg}')
            logger.error(f'[Tavily] 查询: {query[:200]}')
            
            # 处理常见错误
            if '401' in error_msg or 'unauthorized' in error_msg.lower():
                logger.error('[Tavily] 错误类型: API Key 无效或已过期')
                raise Exception('Tavily API Key 无效或已过期')
            elif '429' in error_msg or 'rate_limit' in error_msg.lower():
                logger.warning('[Tavily] 错误类型: 请求速率限制')
                raise Exception('Tavily API 请求速率限制，请稍后重试')
            elif '402' in error_msg or 'quota' in error_msg.lower():
                logger.error('[Tavily] 错误类型: API 配额不足')
                raise Exception('Tavily API 配额不足，请检查账户')
            else:
                logger.error(f'[Tavily] 错误类型: 未知错误 - {error_msg}')
                raise Exception(f'Tavily 搜索失败: {error_msg}')
    
    def format_search_results(self, search_response: Dict) -> str:
        """
        格式化搜索结果为可读文本
        
        Args:
            search_response: Tavily 搜索响应
            
        Returns:
            格式化的搜索结果文本
        """
        logger.debug('[Tavily] 开始格式化搜索结果')
        formatted = "## 网络搜索结果\n\n"
        
        # 添加 AI 生成的答案摘要（如果有）
        if 'answer' in search_response and search_response['answer']:
            formatted += f"**摘要**: {search_response['answer']}\n\n"
        
        # 添加搜索结果
        if 'results' in search_response and search_response['results']:
            formatted += "**相关来源**:\n\n"
            for i, result in enumerate(search_response['results'], 1):
                title = result.get('title', '无标题')
                url = result.get('url', '')
                content = result.get('content', '')
                
                formatted += f"{i}. **{title}**\n"
                formatted += f"   来源: {url}\n"
                if content:
                    # 限制内容长度
                    content_preview = content[:200] + '...' if len(content) > 200 else content
                    formatted += f"   摘要: {content_preview}\n"
                formatted += "\n"
        
        return formatted
    
    def get_context_for_ai(self, search_response: Dict) -> str:
        """
        将搜索结果转换为 AI 上下文
        
        Args:
            search_response: Tavily 搜索响应
            
        Returns:
            适合作为 AI 上下文的文本
        """
        logger.debug('[Tavily] 开始生成 AI 上下文')
        
        results_count = len(search_response.get('results', []))
        has_answer = bool(search_response.get('answer'))
        
        logger.debug(f'[Tavily] 上下文包含: {results_count} 个结果, 答案摘要: {has_answer}')
        
        context = "以下是网络搜索结果，请基于这些信息回答用户问题：\n\n"
        
        # 添加答案摘要
        if 'answer' in search_response and search_response['answer']:
            context += f"搜索摘要: {search_response['answer']}\n\n"
        
        # 添加详细结果
        if 'results' in search_response and search_response['results']:
            context += "详细来源:\n"
            for i, result in enumerate(search_response['results'], 1):
                title = result.get('title', '无标题')
                url = result.get('url', '')
                content = result.get('content', '')
                score = result.get('score', 0)
                
                context += f"\n[来源 {i}] {title}\n"
                context += f"URL: {url}\n"
                context += f"相关度: {score:.2f}\n"
                if content:
                    context += f"内容: {content}\n"
        
        context += "\n请基于以上信息，用中文回答用户的问题。如果信息不足，请说明。"
        
        return context


# 全局实例
tavily_service = TavilySearchService()
