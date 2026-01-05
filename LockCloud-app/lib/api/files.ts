/**
 * Files API
 * 
 * Handles file operations including listing, uploading, updating, and deleting.
 * Strictly follows the Web frontend implementation (lockcloud-frontend/lib/api/files.ts)
 * and backend routes (backend/files/routes.py).
 * 
 * Requirements: 3.1, 4.4, 5.2, 5.4, 9.3, 9.4, 9.5, 9.6
 */

import apiClient from './client';
import {
  File,
  FileFilters,
  FileListResponse,
  DirectoryNode,
  UploadUrlRequest,
  UploadUrlResponse,
  FileConfirmRequest,
  UpdateFileData,
  AdjacentFiles,
  BatchOperationResult,
  BatchDeleteRequest,
  BatchTagRequest,
  BatchRemoveTagRequest,
  BatchUpdateData,
} from '../../types';

// ============================================================
// File Listing
// ============================================================

/**
 * List files with optional filters
 * Endpoint: GET /api/files
 * 
 * Supports media_type, tags, year, month filters in addition to existing filters.
 * Tags array is converted to comma-separated string for API.
 * 
 * @param filters - Optional filter parameters
 * @returns File list with pagination and timeline
 */
export const listFiles = async (
  filters?: FileFilters
): Promise<FileListResponse> => {
  // Convert tags array to comma-separated string for API
  const params: Record<string, unknown> = { ...filters };
  if (filters?.tags && filters.tags.length > 0) {
    params.tags = filters.tags.join(',');
  }
  const response = await apiClient.get('/api/files', { params });
  return response.data;
};

/**
 * Get single file metadata
 * Endpoint: GET /api/files/{id}
 * 
 * @param fileId - File ID
 * @returns File metadata
 */
export const getFile = async (fileId: number): Promise<File> => {
  const response = await apiClient.get(`/api/files/${fileId}`);
  // Backend returns { file: {...} } for single file endpoint
  return response.data.file || response.data;
};

/**
 * Get adjacent files (previous and next) in the same directory
 * Endpoint: GET /api/files/{id}/adjacent
 * 
 * @param fileId - Current file ID
 * @returns Previous and next files
 */
export const getAdjacentFiles = async (
  fileId: number
): Promise<AdjacentFiles> => {
  const response = await apiClient.get(`/api/files/${fileId}/adjacent`);
  return response.data;
};

// ============================================================
// File Upload
// ============================================================

/**
 * Request signed upload URL from backend
 * Endpoint: POST /api/files/upload-url
 * 
 * @param data - Upload request data including filename, content type, size, and metadata
 * @returns Signed upload URL and S3 key
 */
export const getUploadUrl = async (
  data: UploadUrlRequest
): Promise<UploadUrlResponse> => {
  const response = await apiClient.post('/api/files/upload-url', data);
  return response.data;
};

/**
 * Confirm file upload completion
 * Endpoint: POST /api/files/confirm
 * 
 * @param data - Confirmation data including S3 key and metadata
 * @returns Created file metadata
 */
export const confirmUpload = async (data: FileConfirmRequest): Promise<File> => {
  const response = await apiClient.post('/api/files/confirm', data);
  return response.data.file;
};

// ============================================================
// File Operations
// ============================================================

/**
 * Update file metadata
 * Endpoint: PATCH /api/files/{id}
 * 
 * @param fileId - File ID
 * @param data - Update data
 * @returns Updated file metadata
 */
export const updateFile = async (
  fileId: number,
  data: UpdateFileData
): Promise<File> => {
  const response = await apiClient.patch(`/api/files/${fileId}`, data);
  return response.data.file;
};

/**
 * Delete file (owner only)
 * Endpoint: DELETE /api/files/{id}
 * 
 * @param fileId - File ID
 * @returns Success message
 */
export const deleteFile = async (fileId: number): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/api/files/${fileId}`);
  return response.data;
};

// ============================================================
// Directory Operations
// ============================================================

/**
 * Get directory structure based on tag presets
 * Endpoint: GET /api/files/directories
 * 
 * @returns Directory tree structure
 */
export const getDirectories = async (): Promise<{ directories: DirectoryNode[] }> => {
  const response = await apiClient.get('/api/files/directories');
  return response.data;
};


// ============================================================
// Batch Operations
// ============================================================

/**
 * Batch delete multiple files
 * Endpoint: POST /api/files/batch/delete
 * 
 * @param fileIds - Array of file IDs to delete (max 100)
 * @returns Batch operation result with succeeded and failed IDs
 */
export const batchDelete = async (
  fileIds: number[]
): Promise<BatchOperationResult> => {
  const data: BatchDeleteRequest = { file_ids: fileIds };
  const response = await apiClient.post('/api/files/batch/delete', data);
  return response.data;
};

/**
 * Batch add a tag to multiple files
 * Endpoint: POST /api/files/batch/tags
 * 
 * @param fileIds - Array of file IDs
 * @param tagName - Tag name to add
 * @returns Batch operation result
 */
export const batchAddTag = async (
  fileIds: number[],
  tagName: string
): Promise<BatchOperationResult> => {
  const data: BatchTagRequest = { file_ids: fileIds, tag_name: tagName };
  const response = await apiClient.post('/api/files/batch/tags', data);
  return response.data;
};

/**
 * Batch remove a tag from multiple files
 * Endpoint: DELETE /api/files/batch/tags
 * 
 * @param fileIds - Array of file IDs
 * @param tagId - Tag ID to remove
 * @returns Batch operation result
 */
export const batchRemoveTag = async (
  fileIds: number[],
  tagId: number
): Promise<BatchOperationResult> => {
  const data: BatchRemoveTagRequest = { file_ids: fileIds, tag_id: tagId };
  const response = await apiClient.delete('/api/files/batch/tags', { data });
  return response.data;
};

/**
 * Batch update multiple files (owner or admin only)
 * Endpoint: POST /api/files/batch/update
 * 
 * @param fileIds - Array of file IDs to update (max 100)
 * @param updates - Update data to apply
 * @returns Batch operation result
 */
export const batchUpdate = async (
  fileIds: number[],
  updates: BatchUpdateData
): Promise<BatchOperationResult> => {
  const response = await apiClient.post('/api/files/batch/update', {
    file_ids: fileIds,
    updates,
  });
  return response.data;
};
