import apiClient from './client';
import { FileLog } from '@/types';

/**
 * Query file operation logs with filters
 */
export const getLogs = async (filters?: {
  start_date?: string;
  end_date?: string;
  user_id?: number;
  operation?: 'upload' | 'delete' | 'access';
  page?: number;
  per_page?: number;
}): Promise<{
  logs: FileLog[];
  total: number;
  page: number;
  per_page: number;
}> => {
  const response = await apiClient.get('/api/logs', { params: filters });
  return response.data;
};

/**
 * Get usage summary statistics
 */
export const getSummary = async (): Promise<{
  total_storage: number;
  upload_count: number;
  active_users: number;
  quarterly_stats: {
    quarter: string;
    uploads: number;
    storage: number;
  }[];
}> => {
  const response = await apiClient.get('/api/logs/summary');
  return response.data;
};
