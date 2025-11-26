"""
AI Request Queue Manager with Redis Backend
支持多进程环境的队列管理器（使用 Redis）
"""
import time
import json
import threading
import redis
from typing import Dict, Optional, Callable, Any
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)


class QueueItem:
    """队列项"""
    def __init__(self, request_id: str, user_id: int, callback: Callable = None, app_context: Any = None):
        self.request_id = request_id
        self.user_id = user_id
        self.callback = callback  # 注意：callback 不能序列化到 Redis
        self.app_context = app_context
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.result = None
        self.error = None
        self.status = 'pending'  # pending, processing, completed, failed
    
    def to_dict(self, include_result=True):
        """转换为可序列化的字典"""
        data = {
            'request_id': self.request_id,
            'user_id': self.user_id,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error': self.error
        }
        if include_result:
            data['result'] = self.result
        return data
    
    @classmethod
    def from_dict(cls, data: dict):
        """从字典创建实例"""
        item = cls(data['request_id'], data['user_id'])
        item.status = data['status']
        item.created_at = datetime.fromisoformat(data['created_at'])
        item.started_at = datetime.fromisoformat(data['started_at']) if data.get('started_at') else None
        item.completed_at = datetime.fromisoformat(data['completed_at']) if data.get('completed_at') else None
        item.result = data.get('result')
        item.error = data.get('error')
        return item


class AIRequestQueueManager:
    """AI 请求队列管理器（Redis 版本）"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            # 从环境变量获取 Redis URL
            redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
            
            # 初始化通用属性
            self.worker_thread = None
            self.is_processing = False
            self.max_completed_history = 100
            
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # 测试连接
                self.redis_client.ping()
                self.use_redis = True
                logger.info(f'AI Request Queue Manager initialized with Redis: {redis_url}')
            except Exception as e:
                logger.warning(f'Redis connection failed: {str(e)}. Falling back to in-memory queue.')
                self.redis_client = None
                self.use_redis = False
                # 回退到内存队列
                from queue import Queue
                self.queue = Queue()
                self.active_requests: Dict[str, QueueItem] = {}
                self.completed_requests: Dict[str, QueueItem] = {}
                self.start_worker()
            
            self.initialized = True
            
            # Redis 键前缀
            self.queue_key = 'ai_queue:pending'
            self.active_key_prefix = 'ai_queue:active:'
            self.completed_key_prefix = 'ai_queue:completed:'
            self.processing_lock_key = 'ai_queue:processing_lock'
            self.max_concurrent = 1  # 最大并发处理数
    
    def start_worker(self):
        """启动工作线程（仅内存模式需要）"""
        if not self.use_redis:
            if self.worker_thread is None or not self.worker_thread.is_alive():
                self.is_processing = True
                self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
                self.worker_thread.start()
                logger.info('Queue worker thread started (memory mode)')
    
    def _process_queue(self):
        """处理队列中的请求（工作线程）- 仅内存模式"""
        logger.info('Queue worker started processing (memory mode)')
        
        while self.is_processing:
            try:
                from queue import Empty
                try:
                    item = self.queue.get(timeout=1)
                    
                    logger.info(f'Processing request {item.request_id}')
                    item.status = 'processing'
                    item.started_at = datetime.utcnow()
                    
                    try:
                        if item.app_context:
                            with item.app_context:
                                result = item.callback()
                        else:
                            result = item.callback()
                        
                        item.result = result
                        item.status = 'completed'
                        logger.info(f'Request {item.request_id} completed successfully')
                        
                    except Exception as e:
                        item.error = str(e)
                        item.status = 'failed'
                        logger.error(f'Request {item.request_id} failed: {str(e)}')
                    
                    finally:
                        item.completed_at = datetime.utcnow()
                        self.completed_requests[item.request_id] = item
                        if item.request_id in self.active_requests:
                            del self.active_requests[item.request_id]
                        
                        self.queue.task_done()
                        
                except Empty:
                    continue
                    
            except Exception as e:
                logger.error(f'Queue worker error: {str(e)}')
    
    def add_request(self, request_id: str, user_id: int, callback: Callable = None, app_context: Any = None) -> QueueItem:
        """添加请求到队列"""
        item = QueueItem(request_id, user_id, callback, app_context)
        
        if self.use_redis:
            # 保存到 Redis（仅状态信息）
            active_key = f'{self.active_key_prefix}{request_id}'
            self.redis_client.set(active_key, json.dumps(item.to_dict()), ex=3600)  # 1小时过期
            
            # 添加到队列
            queue_item = {
                'request_id': request_id,
                'user_id': user_id,
                'created_at': item.created_at.isoformat(),
                'status': 'pending'
            }
            self.redis_client.rpush(self.queue_key, json.dumps(queue_item))
            
            queue_size = self.redis_client.llen(self.queue_key)
            logger.info(f'Request {request_id} added to Redis queue. Queue size: {queue_size}')
        else:
            # 内存模式
            self.active_requests[request_id] = item
            self.queue.put(item)
            logger.info(f'Request {request_id} added to memory queue. Queue size: {self.queue.qsize()}')
        
        return item
    
    def try_acquire_processing_slot(self, request_id: str, timeout: int = 300) -> bool:
        """尝试获取处理槽位（等待轮到自己）"""
        if self.use_redis:
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                # 检查当前正在处理的数量
                processing_count = self._get_processing_count()
                
                if processing_count < self.max_concurrent:
                    # 检查自己是否在队列首位
                    queue_items = self.redis_client.lrange(self.queue_key, 0, 0)
                    if queue_items:
                        first_item = json.loads(queue_items[0])
                        if first_item['request_id'] == request_id:
                            # 轮到自己了，从队列移除
                            self.redis_client.lpop(self.queue_key)
                            logger.info(f'Request {request_id} acquired processing slot')
                            return True
                
                # 等待一会儿再检查
                time.sleep(0.5)
            
            logger.warning(f'Request {request_id} timeout waiting for processing slot')
            return False
        else:
            # 内存模式不需要等待，由工作线程处理
            return True
    
    def _get_processing_count(self) -> int:
        """获取当前正在处理的请求数量"""
        if self.use_redis:
            active_keys = self.redis_client.keys(f'{self.active_key_prefix}*')
            count = 0
            for key in active_keys:
                data = self.redis_client.get(key)
                if data:
                    item_data = json.loads(data)
                    if item_data.get('status') == 'processing':
                        count += 1
            return count
        else:
            return sum(1 for item in self.active_requests.values() if item.status == 'processing')
    
    def get_request_status(self, request_id: str) -> Optional[Dict]:
        """获取请求状态"""
        if self.use_redis:
            # 检查活动请求
            active_key = f'{self.active_key_prefix}{request_id}'
            data = self.redis_client.get(active_key)
            if data:
                return json.loads(data)
            
            # 检查已完成请求
            completed_key = f'{self.completed_key_prefix}{request_id}'
            data = self.redis_client.get(completed_key)
            if data:
                return json.loads(data)
        else:
            # 内存模式
            if request_id in self.active_requests:
                return self.active_requests[request_id].to_dict()
            if request_id in self.completed_requests:
                return self.completed_requests[request_id].to_dict()
        
        return None
    
    def update_request_status(self, request_id: str, status: str, result=None, error=None):
        """更新请求状态"""
        if self.use_redis:
            active_key = f'{self.active_key_prefix}{request_id}'
            data = self.redis_client.get(active_key)
            if data:
                item_data = json.loads(data)
                item_data['status'] = status
                
                # 更新时间戳
                if status == 'processing':
                    item_data['started_at'] = datetime.utcnow().isoformat()
                    # 从队列中移除（开始处理时）
                    self._remove_from_queue(request_id)
                    logger.info(f'Request {request_id} started processing and removed from queue')
                    
                if status in ['completed', 'failed']:
                    item_data['completed_at'] = datetime.utcnow().isoformat()
                    
                if result is not None:
                    item_data['result'] = result
                if error is not None:
                    item_data['error'] = error
                
                if status in ['completed', 'failed']:
                    # 确保从队列中移除（如果还在队列中）
                    self._remove_from_queue(request_id)
                    
                    # 移到已完成
                    completed_key = f'{self.completed_key_prefix}{request_id}'
                    self.redis_client.set(completed_key, json.dumps(item_data), ex=3600)
                    self.redis_client.delete(active_key)
                    
                    logger.info(f'Request {request_id} marked as {status}, removed from active and queue')
                else:
                    # 更新 active 状态
                    self.redis_client.set(active_key, json.dumps(item_data), ex=3600)
    
    def _remove_from_queue(self, request_id: str):
        """从队列中移除指定的请求"""
        if self.use_redis:
            # 获取队列中的所有项
            queue_items = self.redis_client.lrange(self.queue_key, 0, -1)
            
            # 找到并移除匹配的项
            removed = False
            for item_json in queue_items:
                try:
                    item_data = json.loads(item_json)
                    if item_data['request_id'] == request_id:
                        # 从队列中移除这个项（移除第一个匹配的）
                        # 使用 lrem 删除，count=1 表示只删除第一个匹配的
                        result = self.redis_client.lrem(self.queue_key, 1, item_json)
                        if result > 0:
                            logger.info(f'Successfully removed request {request_id} from queue')
                            removed = True
                        else:
                            # lrem 失败，可能是 JSON 字符串格式不完全匹配
                            # 使用备用方案：重建队列
                            logger.warning(f'lrem failed for {request_id}, using fallback method')
                            self._remove_from_queue_fallback(request_id)
                            removed = True
                        break
                except json.JSONDecodeError as e:
                    logger.error(f'Failed to decode queue item: {e}')
                    continue
            
            if not removed:
                logger.warning(f'Request {request_id} not found in queue')
    
    def _remove_from_queue_fallback(self, request_id: str):
        """备用方案：重建队列（不包含指定的 request_id）"""
        if self.use_redis:
            # 获取所有队列项
            queue_items = self.redis_client.lrange(self.queue_key, 0, -1)
            
            # 过滤掉要删除的项
            filtered_items = []
            for item_json in queue_items:
                try:
                    item_data = json.loads(item_json)
                    if item_data['request_id'] != request_id:
                        filtered_items.append(item_json)
                except json.JSONDecodeError:
                    # 保留无法解析的项
                    filtered_items.append(item_json)
            
            # 使用事务重建队列
            pipe = self.redis_client.pipeline()
            pipe.delete(self.queue_key)
            if filtered_items:
                pipe.rpush(self.queue_key, *filtered_items)
            pipe.execute()
            
            logger.info(f'Rebuilt queue without request {request_id}')
    
    def get_queue_status(self) -> Dict:
        """获取队列整体状态"""
        if self.use_redis:
            # 清理过期的请求（超过1小时的）
            self._cleanup_expired_requests()
            
            # 获取队列大小
            pending_count = self.redis_client.llen(self.queue_key)
            
            # 获取队列中的所有请求
            queue_items_json = self.redis_client.lrange(self.queue_key, 0, -1)
            queue_items = [json.loads(item) for item in queue_items_json]
            
            # 获取正在处理的请求（只返回状态为 processing 的）
            active_keys = self.redis_client.keys(f'{self.active_key_prefix}*')
            processing_items = []
            for key in active_keys:
                data = self.redis_client.get(key)
                if data:
                    item_data = json.loads(data)
                    # 只返回真正在处理中的请求
                    if item_data.get('status') == 'processing':
                        processing_items.append(item_data)
            
            processing_count = len(processing_items)
            
            return {
                'queue_size': pending_count,
                'processing_count': processing_count,
                'total_active': pending_count + processing_count,
                'queue_items': queue_items,
                'processing_items': processing_items,
                'is_worker_alive': self.worker_thread.is_alive() if self.worker_thread else False,
                'backend': 'redis'
            }
        else:
            # 内存模式
            from queue import Empty
            pending_count = self.queue.qsize()
            processing_count = sum(1 for item in self.active_requests.values() if item.status == 'processing')
            
            queue_items = []
            temp_items = []
            try:
                while True:
                    item = self.queue.get_nowait()
                    temp_items.append(item)
                    queue_items.append({
                        'request_id': item.request_id,
                        'user_id': item.user_id,
                        'created_at': item.created_at.isoformat(),
                        'status': item.status
                    })
            except Empty:
                pass
            finally:
                for item in temp_items:
                    self.queue.put(item)
            
            processing_items = [
                item.to_dict(include_result=False)
                for item in self.active_requests.values()
                if item.status == 'processing'
            ]
            
            return {
                'queue_size': pending_count,
                'processing_count': processing_count,
                'total_active': pending_count + processing_count,
                'queue_items': queue_items,
                'processing_items': processing_items,
                'is_worker_alive': self.worker_thread.is_alive() if self.worker_thread else False,
                'backend': 'memory'
            }
    
    def wait_for_completion(self, request_id: str, timeout: int = 300) -> Dict:
        """等待请求完成"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_request_status(request_id)
            
            if status and status['status'] in ['completed', 'failed']:
                return status
            
            time.sleep(0.5)
        
        raise TimeoutError(f'Request {request_id} timed out after {timeout} seconds')
    
    def _cleanup_expired_requests(self):
        """清理过期的请求（超过1小时未完成的）"""
        if self.use_redis:
            try:
                # 清理队列中的过期项
                queue_items_json = self.redis_client.lrange(self.queue_key, 0, -1)
                now = datetime.utcnow()
                
                for item_json in queue_items_json:
                    try:
                        item_data = json.loads(item_json)
                        created_at = datetime.fromisoformat(item_data['created_at'])
                        # 如果超过1小时，移除
                        if (now - created_at).total_seconds() > 3600:
                            self.redis_client.lrem(self.queue_key, 1, item_json)
                            logger.info(f'Cleaned up expired queue item: {item_data["request_id"]}')
                    except Exception as e:
                        logger.error(f'Error cleaning up queue item: {str(e)}')
                        
            except Exception as e:
                logger.error(f'Error in cleanup: {str(e)}')
    
    def cancel_request(self, request_id: str, user_id: int) -> bool:
        """
        取消请求
        
        Args:
            request_id: 请求ID
            user_id: 用户ID（用于验证权限）
            
        Returns:
            bool: 是否成功取消
        """
        logger.info(f'[取消请求] 开始取消 - RequestID: {request_id}, UserID: {user_id}')
        
        if self.use_redis:
            # 检查请求是否存在且属于该用户
            active_key = f'{self.active_key_prefix}{request_id}'
            data = self.redis_client.get(active_key)
            
            if not data:
                logger.warning(f'[取消请求] 请求不存在 - RequestID: {request_id}')
                return False
            
            item_data = json.loads(data)
            logger.info(f'[取消请求] 找到请求 - Status: {item_data.get("status")}, Owner: {item_data.get("user_id")}')
            
            # 验证用户权限
            if item_data['user_id'] != user_id:
                logger.warning(f'[取消请求] 权限验证失败 - User {user_id} 尝试取消 User {item_data["user_id"]} 的请求')
                return False
            
            # 检查状态
            status = item_data.get('status')
            
            if status == 'processing':
                # 正在处理中，无法取消
                logger.warning(f'[取消请求] 请求正在处理中，无法取消 - RequestID: {request_id}')
                return False
            
            if status in ['completed', 'failed']:
                # 已完成或失败，无需取消
                logger.info(f'[取消请求] 请求已{status}，无需取消 - RequestID: {request_id}')
                return False
            
            # 检查队列中是否存在
            queue_items = self.redis_client.lrange(self.queue_key, 0, -1)
            in_queue = any(
                json.loads(item).get('request_id') == request_id 
                for item in queue_items
            )
            logger.info(f'[取消请求] 队列检查 - 在队列中: {in_queue}, 队列大小: {len(queue_items)}')
            
            # 从队列中移除
            logger.info(f'[取消请求] 开始从队列移除 - RequestID: {request_id}')
            self._remove_from_queue(request_id)
            
            # 验证是否移除成功
            queue_items_after = self.redis_client.lrange(self.queue_key, 0, -1)
            still_in_queue = any(
                json.loads(item).get('request_id') == request_id 
                for item in queue_items_after
            )
            logger.info(f'[取消请求] 移除后检查 - 仍在队列: {still_in_queue}, 队列大小: {len(queue_items_after)}')
            
            # 标记为已取消
            item_data['status'] = 'cancelled'
            item_data['completed_at'] = datetime.utcnow().isoformat()
            item_data['error'] = 'User cancelled request'
            
            # 移到已完成
            completed_key = f'{self.completed_key_prefix}{request_id}'
            self.redis_client.set(completed_key, json.dumps(item_data), ex=3600)
            self.redis_client.delete(active_key)
            
            logger.info(f'[取消请求] 取消成功 - RequestID: {request_id}, UserID: {user_id}')
            return True
            
        else:
            # 内存模式
            if request_id not in self.active_requests:
                logger.warning(f'Request {request_id} not found for cancellation')
                return False
            
            item = self.active_requests[request_id]
            
            # 验证用户权限
            if item.user_id != user_id:
                logger.warning(f'User {user_id} attempted to cancel request {request_id} owned by user {item.user_id}')
                return False
            
            # 检查状态
            if item.status == 'processing':
                logger.warning(f'Request {request_id} is already processing, cannot cancel')
                return False
            
            if item.status in ['completed', 'failed']:
                logger.info(f'Request {request_id} already {item.status}, no need to cancel')
                return False
            
            # 从队列中移除（尝试）
            try:
                from queue import Empty
                temp_items = []
                found = False
                
                while True:
                    try:
                        queue_item = self.queue.get_nowait()
                        if queue_item.request_id == request_id:
                            found = True
                            # 不放回队列
                        else:
                            temp_items.append(queue_item)
                    except Empty:
                        break
                
                # 放回其他项
                for queue_item in temp_items:
                    self.queue.put(queue_item)
                
                if found:
                    logger.info(f'Removed request {request_id} from memory queue')
                    
            except Exception as e:
                logger.error(f'Error removing from queue: {str(e)}')
            
            # 标记为已取消
            item.status = 'cancelled'
            item.completed_at = datetime.utcnow()
            item.error = 'User cancelled request'
            
            # 移到已完成
            self.completed_requests[request_id] = item
            del self.active_requests[request_id]
            
            logger.info(f'Request {request_id} cancelled by user {user_id}')
            return True
    
    def clear_all_queues(self):
        """清空所有队列（调试用）"""
        if self.use_redis:
            # 清空队列
            self.redis_client.delete(self.queue_key)
            
            # 清空所有 active 请求
            active_keys = self.redis_client.keys(f'{self.active_key_prefix}*')
            if active_keys:
                self.redis_client.delete(*active_keys)
            
            # 清空所有 completed 请求
            completed_keys = self.redis_client.keys(f'{self.completed_key_prefix}*')
            if completed_keys:
                self.redis_client.delete(*completed_keys)
            
            logger.info('All queues cleared')
    
    def stop_worker(self):
        """停止工作线程"""
        self.is_processing = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        logger.info('Queue worker stopped')


# 全局队列管理器实例
queue_manager = AIRequestQueueManager()
