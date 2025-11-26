import apiClient from './client';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
}

/**
 * Get list of all users (admin only)
 */
export const getUsers = async (page = 1, perPage = 50): Promise<UsersResponse> => {
  const response = await apiClient.get('/api/admin/users', {
    params: { page, per_page: perPage },
  });
  return response.data;
};
