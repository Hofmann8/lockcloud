import apiClient from './client';
import { FreeTag, TagWithCount } from '@/types';

/**
 * Get all free tags with usage count
 */
export const getTags = async (): Promise<TagWithCount[]> => {
  const response = await apiClient.get('/api/tags');
  return response.data.tags;
};

/**
 * Search tags by prefix
 * @param prefix Search prefix string
 * @param limit Maximum number of results (default 10)
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

/**
 * Add a free tag to a file
 * @param fileId File ID
 * @param tagName Tag name to add
 */
export const addTagToFile = async (
  fileId: number,
  tagName: string
): Promise<FreeTag> => {
  const response = await apiClient.post(`/api/files/${fileId}/tags`, {
    tag_name: tagName,
  });
  return response.data.tag;
};

/**
 * Remove a free tag from a file
 * @param fileId File ID
 * @param tagId Tag ID to remove
 */
export const removeTagFromFile = async (
  fileId: number,
  tagId: number
): Promise<void> => {
  await apiClient.delete(`/api/files/${fileId}/tags/${tagId}`);
};

/**
 * Get all free tags for a specific file
 * @param fileId File ID
 */
export const getFileTags = async (fileId: number): Promise<FreeTag[]> => {
  const response = await apiClient.get(`/api/files/${fileId}/tags`);
  return response.data.tags;
};
