/**
 * Tags API
 * 
 * Handles tag listing and search operations.
 * Follows backend routes (backend/tags/routes.py).
 * 
 * Requirements: 6.1, 6.2
 */

import apiClient from './client';
import { TagWithCount } from '../../types';

/**
 * Get all free tags with usage count
 * Endpoint: GET /api/tags
 * 
 * @returns Array of tags with their usage counts
 */
export const listTags = async (): Promise<TagWithCount[]> => {
  const response = await apiClient.get('/api/tags');
  return response.data.tags;
};

/**
 * Search tags by prefix
 * Endpoint: GET /api/tags/search?q={prefix}&limit={limit}
 * 
 * @param prefix - Search prefix string
 * @param limit - Maximum number of results (default 10)
 * @returns Array of matching tags with counts
 */
export const searchTags = async (
  prefix: string,
  limit: number = 10
): Promise<TagWithCount[]> => {
  const response = await apiClient.get('/api/tags/search', {
    params: { q: prefix, limit },
  });
  return response.data.tags;
};
