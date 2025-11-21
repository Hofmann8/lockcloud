"""
AI Request Queue Manager
管理 AI 请求队列，避免并发请求导致的速率限制问题
"""
import time
import threading
from queue import Queue, Empty
from typing import Dict, Optional, Callable, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class QueueItem:
    """队列项"""
    def __init__(self, request_id: str, user_id: int, callback: Callable, app_context: Any = None):
        self.request_id = request_id
        self.user_id = user_id
        self.callback = callback
        self.app_context = app_context  # Flask 应用上下文
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.result = None
        self.error = None
        self.status = 'pending'  # pending, processing, completed, failed


class AIRequestQueueManager:
    """AI 请求队列管理器"""
    
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
            self.queue = Queue()
            self.active_requests: Dict[str, QueueItem] = {}
            self.completed_requests: Dict[str, QueueItem] = {}
            self.is_processing = False
            self.worker_thread = None
            self.max_completed_history = 100
            self.initialized = True
            logger.info('AI Request Queue Manager initialized')
    
    def start_worker(self):
        """启动工作线程"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.is_processing = True
            self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.worker_thread.start()
            logger.info('Queue worker thread started')
    
    def _process_queue(self):
        """处理队列中的请求（工作线程）"""
        logger.info('Queue worker started processing')
        
        while self.is_processing:
            try:
                # 从队列获取请求，超时1秒
                item = self.queue.get(timeout=1)
                
                logger.info(f'Processing request {item.request_id} for user {item.user_id}')
                item.status = 'processing'
                item.started_at = datetime.utcnow()
                
                try:
                    # 如果有应用上下文，在上下文中执行
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
                    
                    # 移到已完成列表
                    self.completed_requests[item.request_id] = item
                    if item.request_id in self.active_requests:
                        del self.active_requests[item.request_id]
                    
                    # 清理旧的已完成请求
                    if len(self.completed_requests) > self.max_completed_history:
                        oldest_keys = sorted(
                            self.completed_requests.keys(),
                            key=lambda k: self.completed_requests[k].completed_at
                        )[:len(self.completed_requests) - self.max_completed_history]
                        for key in oldest_keys:
                            del self.completed_requests[key]
                    
                    self.queue.task_done()
                
            except Empty:
                continue
            except Exception as e:
                logger.error(f'Queue worker error: {str(e)}')
    
    def add_request(self, request_id: str, user_id: int, callback: Callable, app_context: Any = None) -> QueueItem:
        """添加请求到队列"""
        item = QueueItem(request_id, user_id, callback, app_context)
        self.active_requests[request_id] = item
        self.queue.put(item)
        
        # 确保工作线程正在运行
        self.start_worker()
        
        logger.info(f'Request {request_id} added to queue. Queue size: {self.queue.qsize()}')
        return item
    
    def get_request_status(self, request_id: str) -> Optional[Dict]:
        """获取请求状态"""
        # 检查活动请求
        if request_id in self.active_requests:
            item = self.active_requests[request_id]
            return self._item_to_dict(item)
        
        # 检查已完成请求
        if request_id in self.completed_requests:
            item = self.completed_requests[request_id]
            return self._item_to_dict(item)
        
        return None
    
    def get_queue_status(self) -> Dict:
        """获取队列整体状态"""
        pending_count = self.queue.qsize()
        processing_count = sum(1 for item in self.active_requests.values() if item.status == 'processing')
        
        # 获取队列中的所有请求（不移除）
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
            # 将项目放回队列
            for item in temp_items:
                self.queue.put(item)
        
        # 获取正在处理的请求
        processing_items = [
            {
                'request_id': item.request_id,
                'user_id': item.user_id,
                'created_at': item.created_at.isoformat(),
                'started_at': item.started_at.isoformat() if item.started_at else None,
                'status': item.status
            }
            for item in self.active_requests.values()
            if item.status == 'processing'
        ]
        
        return {
            'queue_size': pending_count,
            'processing_count': processing_count,
            'total_active': pending_count + processing_count,
            'queue_items': queue_items,
            'processing_items': processing_items,
            'is_worker_alive': self.worker_thread.is_alive() if self.worker_thread else False
        }
    
    def _item_to_dict(self, item: QueueItem) -> Dict:
        """将队列项转换为字典"""
        return {
            'request_id': item.request_id,
            'user_id': item.user_id,
            'status': item.status,
            'created_at': item.created_at.isoformat(),
            'started_at': item.started_at.isoformat() if item.started_at else None,
            'completed_at': item.completed_at.isoformat() if item.completed_at else None,
            'result': item.result,
            'error': item.error
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
    
    def stop_worker(self):
        """停止工作线程"""
        self.is_processing = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        logger.info('Queue worker stopped')


# 全局队列管理器实例
queue_manager = AIRequestQueueManager()
