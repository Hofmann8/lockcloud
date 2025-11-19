'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as aiApi from '@/lib/api/ai';
import toast from 'react-hot-toast';
import MarkdownMessage from '@/components/MarkdownMessage';

export default function AIPage() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState('gpt-5.1-thinking');
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>();
  const [messages, setMessages] = useState<aiApi.AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [messageMetadata, setMessageMetadata] = useState<Record<number, {
    model_name?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    pricing?: { input: number; output: number };
  }>>({});
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
      }
    };
  }, []);

  const { data: models = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: aiApi.getAvailableModels,
    retry: false
  });

  const { data: usage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: aiApi.getUsageStats,
    retry: false
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: aiApi.getConversations,
    retry: false
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ message, model, conversationId, signal }: {
      message: string;
      model: string;
      conversationId?: number;
      signal?: AbortSignal;
    }) => aiApi.sendMessage(message, model, conversationId, signal),
    retry: false,
    onSuccess: (data) => {
      setCurrentConversationId(data.conversation_id);
      setMessages(prev => [...prev, data.message]);
      
      if (data.message.id) {
        setMessageMetadata(prev => ({
          ...prev,
          [data.message.id]: {
            model_name: data.model_name,
            usage: data.usage,
            pricing: data.pricing
          }
        }));
      }
      
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
    },
    onError: (error: unknown) => {
      const err = error as { message?: string };
      const errorMessage = err.message || '发送消息失败';
      
      if (errorMessage.includes('速率限制') || errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
        toast.error('⚠️ API 速率限制：请等待1-2分钟后重试，或切换到其他节点', { duration: 6000 });
      } else if (errorMessage.includes('服务暂时不可用') || errorMessage.includes('503')) {
        toast.error('API 服务繁忙，请稍后重试或切换节点');
      } else if (errorMessage.includes('数据库繁忙')) {
        toast.error('系统繁忙，请稍后重试');
      } else if (errorMessage.includes('超时')) {
        toast.error('请求超时，模型响应时间过长，请稍后重试');
      } else if (errorMessage.includes('网络')) {
        toast.error('网络连接失败，请检查网络或切换节点');
      } else {
        toast.error(errorMessage);
      }
    }
  });

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || sendMessageMutation.isPending || isSending) return;
    
    setIsSending(true);
    const messageToSend = inputMessage;
    const userMessage: aiApi.AIMessage = {
      id: Date.now(),
      conversation_id: currentConversationId || 0,
      role: 'user',
      content: messageToSend,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowCancelWarning(false);
    setWaitingTime(0);

    waitingTimerRef.current = setInterval(() => {
      setWaitingTime(prev => prev + 1);
    }, 1000);

    abortControllerRef.current = new AbortController();

    try {
      await sendMessageMutation.mutateAsync({
        message: messageToSend,
        model: selectedModel,
        conversationId: currentConversationId,
        signal: abortControllerRef.current?.signal
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'CanceledError') {
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      }
    } finally {
      setIsLoading(false);
      setIsSending(false);
      abortControllerRef.current = null;
      
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      setWaitingTime(0);
    }
  }, [inputMessage, isLoading, sendMessageMutation, isSending, currentConversationId, selectedModel]);

  const handleCancelRequest = useCallback(() => {
    setShowCancelWarning(true);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setShowCancelWarning(false);
      abortControllerRef.current = null;
      
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      setWaitingTime(0);
      
      toast.error('请求已取消');
    }
  }, []);

  const handleCancelWarningClose = useCallback(() => {
    setShowCancelWarning(false);
  }, []);

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(undefined);
    setMessages([]);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleLoadConversation = async (conversationId: number) => {
    try {
      const { messages: loadedMessages } = await aiApi.getConversation(conversationId);
      setCurrentConversationId(conversationId);
      setMessages(loadedMessages.map(msg => ({ ...msg })));
      
      // Set metadata for assistant messages with pricing info
      const newMetadata: Record<number, {
        model_name?: string;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        pricing?: { input: number; output: number };
      }> = {};
      
      loadedMessages.forEach((msg: aiApi.AIMessage) => {
        if (msg.role === 'assistant' && msg.id) {
          newMetadata[msg.id] = {
            model_name: msg.model_name,
            usage: {
              prompt_tokens: msg.prompt_tokens || 0,
              completion_tokens: msg.completion_tokens || 0,
              total_tokens: msg.total_tokens || 0
            },
            pricing: msg.pricing || { input: 0, output: 0 }
          };
        }
      });
      
      setMessageMetadata(newMetadata);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('加载对话失败');
    }
  };

  const [editingConversationId, setEditingConversationId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleStartDelete = (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingConversationId(conversationId);
  };

  const handleConfirmDelete = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await aiApi.deleteConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (currentConversationId === conversationId) {
        setCurrentConversationId(undefined);
        setMessages([]);
      }
      setDeletingConversationId(null);
      toast.success('对话已删除');
    } catch {
      toast.error('删除对话失败');
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingConversationId(null);
  };

  const handleStartRename = (conv: aiApi.AIConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (conversationId: number) => {
    if (!editingTitle.trim()) {
      toast.error('对话名称不能为空');
      return;
    }
    
    try {
      await aiApi.updateConversationTitle(conversationId, editingTitle.trim());
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setEditingConversationId(null);
      toast.success('对话已重命名');
    } catch {
      toast.error('重命名失败');
    }
  };

  const handleCancelRename = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  return (
    <div className="fixed top-16 bottom-[60px] md:bottom-12 left-0 right-0 lg:left-64 flex bg-gray-50">
      {showCancelWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-start space-x-3 mb-4">
              <svg className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">确认取消请求</h3>
                <p className="text-sm text-gray-600 mb-3">取消请求将停止等待 AI 响应，但请注意：</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4 list-disc list-inside">
                  <li>如果模型已经开始处理您的请求，可能无法完全取消</li>
                  <li>已生成的部分响应将不会显示</li>
                  <li>建议等待模型完成响应以获得完整结果</li>
                </ul>
              </div>
            </div>
            <div className="flex space-x-3 justify-end">
              <button onClick={handleCancelWarningClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">继续等待</button>
              <button onClick={handleConfirmCancel} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">确认取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">对话历史</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="关闭侧边栏"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <button onClick={handleNewConversation} className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">+ 新对话</button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择模型</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm">
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </div>

        {usage && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">使用统计</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>对话数:</span>
                <span className="font-semibold">{usage.conversation_count}</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-500 mb-1">Token 用量</div>
                <div className="space-y-1 text-gray-600">
                  <div className="flex justify-between"><span>输入:</span><span className="font-mono text-blue-600">{usage.total_prompt_tokens.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>输出:</span><span className="font-mono text-green-600">{usage.total_completion_tokens.toLocaleString()}</span></div>
                  <div className="flex justify-between font-semibold"><span>总计:</span><span className="font-mono text-gray-700">{usage.total_tokens.toLocaleString()}</span></div>
                </div>
              </div>
              {usage.total_cost > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">总消费:</span>
                    <span className="font-mono font-bold text-orange-600">${usage.total_cost.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar-nav">
          <h3 className="text-sm font-medium text-gray-700 mb-2">历史对话</h3>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div key={conv.id} className={`group relative rounded-lg text-sm transition-colors ${currentConversationId === conv.id ? 'bg-orange-50' : 'hover:bg-gray-100'}`}>
                {editingConversationId === conv.id ? (
                  <div className="px-3 py-2">
                    <input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(conv.id); if (e.key === 'Escape') handleCancelRename(); }} className="w-full px-2 py-1 text-sm border border-orange-500 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" autoFocus />
                    <div className="flex space-x-2 mt-2">
                      <button onClick={() => handleSaveRename(conv.id)} className="flex-1 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">保存</button>
                      <button onClick={handleCancelRename} className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        handleLoadConversation(conv.id);
                        setIsSidebarOpen(false); // Close sidebar on mobile after selecting
                      }} 
                      className="w-full text-left px-3 py-2"
                    >
                      <div className={`font-medium truncate pr-12 ${currentConversationId === conv.id ? 'text-orange-600' : 'text-gray-700'}`}>{conv.title}</div>
                      <div className="text-xs text-gray-500">{new Date(conv.created_at).toLocaleDateString()}</div>
                    </button>
                    {deletingConversationId === conv.id ? (
                      <div className="absolute right-2 top-2 flex space-x-1 bg-white rounded shadow-md p-1">
                        <button onClick={(e) => handleConfirmDelete(conv.id, e)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">确认删除</button>
                        <button onClick={handleCancelDelete} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
                      </div>
                    ) : (
                      <div className="absolute right-2 top-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleStartRename(conv, e)} className="p-1 hover:bg-gray-200 rounded" title="重命名">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={(e) => handleStartDelete(conv.id, e)} className="p-1 hover:bg-red-100 rounded" title="删除">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center p-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="打开侧边栏"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="ml-3 text-lg font-semibold text-gray-900">LockAI</h1>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <p className="text-lg">开始新的对话</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message, index) => (
                <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === 'user' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                    <MarkdownMessage content={message.content} isUser={message.role === 'user'} />
                    {message.role === 'assistant' && message.id && (() => {
                      const metadata = messageMetadata[message.id];
                      const usage = metadata?.usage || { prompt_tokens: message.prompt_tokens || 0, completion_tokens: message.completion_tokens || 0, total_tokens: message.total_tokens || 0 };
                      const pricing = metadata?.pricing || { input: 0, output: 0 };
                      const modelName = metadata?.model_name || selectedModel;
                      const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
                      const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
                      const totalCost = inputCost + outputCost;
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                          <div className="flex items-center space-x-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                            <span className="font-medium">{modelName}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span>输入: <span className="font-mono font-semibold text-blue-600">{usage.prompt_tokens.toLocaleString()}</span></span>
                            <span>输出: <span className="font-mono font-semibold text-green-600">{usage.completion_tokens.toLocaleString()}</span></span>
                            <span>总计: <span className="font-mono font-semibold text-gray-700">{usage.total_tokens.toLocaleString()}</span></span>
                          </div>
                          {totalCost > 0 && (
                            <div className="flex items-center space-x-2 text-orange-600 font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span>本次消费: ${totalCost.toFixed(6)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 shadow-sm">
                    <div className="flex items-start space-x-4">
                      <div className="shrink-0 mt-1">
                        <svg className="w-8 h-8 text-orange-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">小锁老师正在让模型努力干活</span>
                          <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>预计需要 2~3 分钟时间等待</div>
                          <div className="flex items-center space-x-2">
                            <span>已等待:</span>
                            <span className="font-mono font-semibold text-orange-600">{Math.floor(waitingTime / 60)}:{(waitingTime % 60).toString().padStart(2, '0')}</span>
                          </div>
                        </div>
                        <button onClick={handleCancelRequest} className="mt-3 text-xs text-gray-500 hover:text-red-600 underline transition-colors">取消请求</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto flex space-x-4">
            <input type="text" value={inputMessage} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="输入消息..." disabled={isLoading} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100" />
            <button onClick={handleSendMessage} disabled={!inputMessage.trim() || isLoading || sendMessageMutation.isPending || isSending} className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              {isLoading || sendMessageMutation.isPending || isSending ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
