import apiClient from './client';
import {
  File,
  UploadUrlRequest,
  UploadUrlResponse,
  FileConfirmRequest,
  FileFilters,
  DirectoryNode,
} from '@/types';

/**
 * Request signed upload URL from backend
 */
export const getUploadUrl = async (
  data: UploadUrlRequest
): Promise<UploadUrlResponse> => {
  const response = await apiClient.post('/api/files/upload-url', data);
  return response.data;
};

/**
 * Confirm file upload completion
 */
export const confirmUpload = async (data: FileConfirmRequest): Promise<File> => {
  const response = await apiClient.post('/api/files/confirm', data);
  return response.data;
};

/**
 * List files with optional filters
 */
export const listFiles = async (
  filters?: FileFilters
): Promise<{ files: File[]; total: number; page: number; per_page: number }> => {
  const response = await apiClient.get('/api/files', { params: filters });
  return response.data;
};

/**
 * Get single file metadata
 */
export const getFile = async (fileId: number): Promise<File> => {
  const response = await apiClient.get(`/api/files/${fileId}`);
  return response.data;
};

/**
 * Delete file (owner only)
 */
export const deleteFile = async (fileId: number): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/api/files/${fileId}`);
  return response.data;
};

/**
 * Get directory structure
 */
export const getDirectories = async (): Promise<DirectoryNode[]> => {
  const response = await apiClient.get('/api/files/directories');
  return response.data;
};
