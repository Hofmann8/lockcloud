import apiClient from './client';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  max_tokens: number;
}

export interface AIMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  created_at: string;
  model_name?: string;
  pricing?: {
    input: number;
    output: number;
  };
}

export interface AIConversation {
  id: number;
  user_id: number;
  title: string;
  model: string;
  created_at: string;
  message_count: number;
}

export interface ChatResponse {
  conversation_id: number;
  message: AIMessage;
  model_name?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  pricing?: {
    input: number;
    output: number;
  };
}

export interface UsageStats {
  conversation_count: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  usage_by_model: {
    [model: string]: {
      conversation_count: number;
      message_count: number;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      cost: number;
      pricing: {
        input: number;
        output: number;
      };
    };
  };
}

export async function getAvailableModels(): Promise<AIModel[]> {
  const response = await apiClient.get('/api/ai/models');
  return response.data.models;
}

export async function getConversations(): Promise<AIConversation[]> {
  const response = await apiClient.get('/api/ai/conversations');
  return response.data.conversations;
}

export async function createConversation(model: string): Promise<AIConversation> {
  const response = await apiClient.post('/api/ai/conversations', { model });
  return response.data;
}

export async function getConversation(conversationId: number): Promise<{
  conversation: AIConversation;
  messages: AIMessage[];
}> {
  const response = await apiClient.get(`/api/ai/conversations/${conversationId}`);
  return response.data;
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await apiClient.delete(`/api/ai/conversations/${conversationId}`);
}

export async function updateConversationTitle(conversationId: number, title: string): Promise<AIConversation> {
  const response = await apiClient.put(`/api/ai/conversations/${conversationId}/title`, { title });
  return response.data;
}

export async function sendMessage(
  message: string,
  model: string,
  conversationId?: number,
  signal?: AbortSignal,
  useWebSearch?: boolean
): Promise<ChatResponse> {
  const response = await apiClient.post('/api/ai/chat', {
    message,
    model,
    conversation_id: conversationId,
    use_web_search: useWebSearch || false
  }, {
    signal
  });
  return response.data;
}

export async function getUsageStats(): Promise<UsageStats> {
  const response = await apiClient.get('/api/ai/usage');
  return response.data;
}

export interface UserAIStats {
  user_id: number;
  email: string;
  name: string;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
}

export interface AllUsersUsageStats {
  users: UserAIStats[];
  summary: {
    total_system_cost: number;
    total_system_tokens: number;
  };
}

export async function getAllUsersUsage(): Promise<AllUsersUsageStats> {
  const response = await apiClient.get('/api/ai/admin/usage');
  return response.data;
}

export interface QueueStatus {
  queue_size: number;
  processing_count: number;
  total_active: number;
  queue_items: Array<{
    request_id: string;
    user_id: number;
    user_name?: string;
    user_email?: string;
    created_at: string;
    status: string;
  }>;
  processing_items: Array<{
    request_id: string;
    user_id: number;
    user_name?: string;
    user_email?: string;
    created_at: string;
    started_at: string | null;
    status: string;
  }>;
  is_worker_alive: boolean;
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const response = await apiClient.get('/api/ai/queue/status');
  return response.data;
}

export async function cancelRequest(requestId: string): Promise<{ message: string; success: boolean }> {
  const response = await apiClient.post(`/api/ai/queue/cancel/${requestId}`);
  return response.data;
}
