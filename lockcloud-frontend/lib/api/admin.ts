import apiClient from './client';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface BlacklistEntry {
  id: number;
  email: string;
  reason?: string;
  blocked_by: number;
  blocker_name?: string;
  blocked_at: string;
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

/**
 * Delete a user (admin only)
 */
export const deleteUser = async (userId: number): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/api/admin/users/${userId}`);
  return response.data;
};

/**
 * Get blacklist
 */
export const getBlacklist = async (): Promise<{ blacklist: BlacklistEntry[] }> => {
  const response = await apiClient.get('/api/admin/blacklist');
  return response.data;
};

/**
 * Add email to blacklist
 */
export const addToBlacklist = async (data: {
  email: string;
  reason?: string;
}): Promise<{ blacklist_entry: BlacklistEntry }> => {
  const response = await apiClient.post('/api/admin/blacklist', data);
  return response.data;
};

/**
 * Remove email from blacklist
 */
export const removeFromBlacklist = async (
  blacklistId: number
): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/api/admin/blacklist/${blacklistId}`);
  return response.data;
};
