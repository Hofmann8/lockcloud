import apiClient from './client';
import {
  File,
  UploadUrlRequest,
  UploadUrlResponse,
  FileConfirmRequest,
  FileFilters,
  DirectoryNode,
  UpdateFileTagsRequest,
  FileListResponse,
  BatchDeleteRequest,
  BatchTagRequest,
  BatchRemoveTagRequest,
  BatchOperationResult,
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
 * Supports media_type, tags, year, month filters in addition to existing filters
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
 * Update file metadata
 */
export const updateFile = async (
  fileId: number,
  data: {
    activity_date?: string;
    activity_type?: string;
    activity_name?: string;
    instructor?: string;
    filename?: string;
    free_tags?: string[];
  }
): Promise<File> => {
  const response = await apiClient.patch(`/api/files/${fileId}`, data);
  return response.data.file;
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

/**
 * Check if filenames already exist in database
 */
export const checkFilenames = async (data: {
  filenames: string[];
  activity_date: string;
  activity_type: string;
}): Promise<{
  existing_files: string[];
  available_files: string[];
}> => {
  const response = await apiClient.post('/api/files/check-filenames', data);
  return response.data;
};

/**
 * Get adjacent files (previous and next) in the same directory
 * @param fileId Current file ID
 * @param limit Number of files to return on each side (default: 3, max: 20)
 */
export const getAdjacentFiles = async (
  fileId: number,
  limit: number = 3
): Promise<{
  previous: File | null;
  next: File | null;
  previous_files?: File[];
  next_files?: File[];
}> => {
  const response = await apiClient.get(`/api/files/${fileId}/adjacent`, {
    params: { limit }
  });
  return response.data;
};

/**
 * Batch delete multiple files
 * @param fileIds Array of file IDs to delete (max 100)
 */
export const batchDeleteFiles = async (
  fileIds: number[]
): Promise<BatchOperationResult> => {
  const data: BatchDeleteRequest = { file_ids: fileIds };
  const response = await apiClient.post('/api/files/batch/delete', data);
  return response.data;
};

/**
 * Batch add a tag to multiple files
 * @param fileIds Array of file IDs
 * @param tagName Tag name to add
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
 * @param fileIds Array of file IDs
 * @param tagId Tag ID to remove
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
 * Activity name with associated activity type
 */
export interface ActivityNameInfo {
  name: string;
  activity_type: string;
  activity_type_display: string;
  file_count: number;
}

/**
 * Get activity names for a specific date
 * Returns unique activity names with their associated activity types
 */
export const getActivityNamesByDate = async (
  date: string
): Promise<{
  date: string;
  activity_names: ActivityNameInfo[];
}> => {
  const response = await apiClient.get('/api/files/activity-names', {
    params: { date }
  });
  return response.data;
};


/**
 * Batch update data for multiple files
 */
export interface BatchUpdateData {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  free_tags?: string[];
  tag_mode?: 'add' | 'replace';
}

/**
 * Batch update result
 */
export interface BatchUpdateResult {
  success: boolean;
  code?: string;
  message?: string;
  results?: {
    succeeded: number[];
    failed: Array<{
      file_id: number;
      error: string;
    }>;
  };
}

/**
 * Batch update multiple files (owner or admin only)
 * @param fileIds Array of file IDs to update (max 100)
 * @param updates Update data to apply
 */
export const batchUpdateFiles = async (
  fileIds: number[],
  updates: BatchUpdateData
): Promise<BatchUpdateResult> => {
  const response = await apiClient.post('/api/files/batch/update', {
    file_ids: fileIds,
    updates,
  });
  return response.data;
};

/**
 * Batch create edit requests for multiple files (for non-owners)
 * @param fileIds Array of file IDs
 * @param proposedChanges Proposed changes
 */
export const batchCreateRequests = async (
  fileIds: number[],
  proposedChanges: {
    activity_date?: string;
    activity_type?: string;
    activity_name?: string;
    free_tags?: string[];
  }
): Promise<BatchUpdateResult> => {
  const response = await apiClient.post('/api/requests/batch', {
    file_ids: fileIds,
    proposed_changes: proposedChanges,
  });
  return response.data;
};

/**
 * Activity directory information
 */
export interface ActivityDirectoryInfo {
  activity_date: string;
  activity_name: string;
  activity_type: string;
  activity_type_display: string;
  file_count: number;
  owner_id: number;
  owner_name: string;
  created_at: string | null;
  is_owner: boolean;
}

/**
 * Get activity directory information
 */
export const getActivityDirectoryInfo = async (params: {
  activity_date: string;
  activity_name: string;
  activity_type: string;
}): Promise<{ directory: ActivityDirectoryInfo }> => {
  const response = await apiClient.get('/api/files/activity-directory', { params });
  return response.data;
};

/**
 * Update activity directory (owner only)
 */
export const updateActivityDirectory = async (data: {
  activity_date: string;
  activity_name: string;
  activity_type: string;
  new_activity_name?: string;
  new_activity_type?: string;
}): Promise<{
  success: boolean;
  message: string;
  updated_count: number;
  new_activity_name: string;
  new_activity_type: string;
}> => {
  const response = await apiClient.patch('/api/files/activity-directory', data);
  return response.data;
};


// ============================================
// 签名 URL 相关 API（私有桶访问）
// ============================================

/**
 * Style 预设类型（样式名称只能包含字母和数字）
 */
export type StylePreset = 
  | 'thumbmobile'
  | 'thumbdesktop'
  | 'thumbnav'
  | 'thumbnavdesktop'
  | 'previewmobile'
  | 'previewtablet'
  | 'previewdesktop'
  | 'videothumbmobile'
  | 'videothumbdesktop'
  | 'videothumbnav'
  | 'videothumbnavdesktop'
  | 'videopreload'
  | 'original';

/**
 * 获取单个文件的签名 URL
 * @param fileId 文件 ID
 * @param style 样式预设名称
 * @param expiration URL 有效期（秒）
 */
export const getSignedUrl = async (
  fileId: number,
  style?: StylePreset,
  expiration?: number
): Promise<{ signed_url: string; expires_in: number }> => {
  const params: Record<string, string | number> = {};
  if (style) params.style = style;
  if (expiration) params.expiration = expiration;
  
  const response = await apiClient.get(`/api/files/signed-url/${fileId}`, { params });
  return response.data;
};

/**
 * 批量获取文件的签名 URL
 * @param fileIds 文件 ID 数组（最多 100 个）
 * @param style 样式预设名称
 * @param expiration URL 有效期（秒）
 */
export const getSignedUrlsBatch = async (
  fileIds: number[],
  style?: StylePreset,
  expiration?: number
): Promise<{
  urls: Record<number, { signed_url: string; s3_key: string }>;
  expires_in: number;
}> => {
  const response = await apiClient.post('/api/files/signed-urls', {
    file_ids: fileIds,
    style,
    expiration,
  });
  return response.data;
};

// ============================================
// HLS 清晰度相关 API
// ============================================

/**
 * HLS 清晰度信息
 */
export interface HLSQuality {
  height: number;
  width?: number;
  label: string;
  playlist: string;
  bandwidth?: number;
}

/**
 * 获取视频的 HLS 可用清晰度列表
 * @param fileId 文件 ID
 */
export const getHLSQualities = async (
  fileId: number
): Promise<{
  success: boolean;
  qualities: HLSQuality[];
  default_quality: number;
  from_manifest: boolean;
}> => {
  const response = await apiClient.get(`/api/files/hls-qualities/${fileId}`);
  return response.data;
};
