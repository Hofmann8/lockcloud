import apiClient from './client';
import {
  File,
  UploadUrlRequest,
  UploadUrlResponse,
  FileConfirmRequest,
  FileFilters,
  DirectoryNode,
  UpdateFileTagsRequest,
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
  return response.data.file;
};

/**
 * List files with optional filters
 */
export const listFiles = async (
  filters?: FileFilters
): Promise<{
  files: File[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
}> => {
  const response = await apiClient.get('/api/files', { params: filters });
  return response.data;
};

/**
 * Get single file metadata
 */
export const getFile = async (fileId: number): Promise<File> => {
  const response = await apiClient.get(`/api/files/${fileId}`);
  // Backend returns { file: {...} } for single file endpoint
  return response.data.file || response.data;
};

/**
 * Get file by ID with enhanced error handling
 * Alias for getFile with additional validation
 */
export const getFileById = async (fileId: number): Promise<File> => {
  if (!fileId || fileId <= 0) {
    throw new Error('Invalid file ID');
  }
  
  try {
    const response = await apiClient.get(`/api/files/${fileId}`);
    // Backend returns { file: {...} } for single file endpoint
    return response.data.file || response.data;
  } catch (error: any) {
    // Enhanced error handling
    if (error.response?.status === 404) {
      throw new Error('File not found');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied');
    }
    throw error;
  }
};

/**
 * Delete file (owner only)
 */
export const deleteFile = async (fileId: number): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/api/files/${fileId}`);
  return response.data;
};

/**
 * Get directory structure based on tag presets
 */
export const getDirectories = async (): Promise<{ directories: DirectoryNode[] }> => {
  const response = await apiClient.get('/api/files/directories');
  return response.data;
};

/**
 * Update file tags (for legacy files)
 */
export const updateFileTags = async (
  fileId: number,
  data: UpdateFileTagsRequest
): Promise<File> => {
  const response = await apiClient.patch(`/api/files/${fileId}/tags`, data);
  return response.data.file;
};
