/**
 * LockCloud Mobile App Type Definitions
 * 
 * These types are directly reused from the Web frontend (lockcloud-frontend/types/index.ts)
 * to ensure consistency with the backend API responses.
 */

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  is_admin: boolean;
}

// ============================================================================
// Free Tag Types
// ============================================================================

export interface FreeTag {
  id: number;
  name: string;
}

export interface TagWithCount extends FreeTag {
  count: number;
}

// ============================================================================
// File Types
// ============================================================================

export interface File {
  id: number;
  filename: string;
  original_filename?: string;
  directory: string;
  s3_key: string;
  size: number;
  content_type: string;
  activity_date?: string;
  activity_type?: string;
  activity_type_display?: string;
  activity_name?: string;
  is_legacy: boolean;
  uploader_id: number;
  uploaded_at: string;
  public_url: string;
  uploader?: User;
  free_tags?: FreeTag[];
}

// ============================================================================
// Auth Types (SSO-based)
// ============================================================================

export interface SSOConfig {
  sso_login_url: string;
  sso_frontend_url: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}


// ============================================================================
// File Operation Types
// ============================================================================

export interface UploadUrlRequest {
  original_filename: string;
  content_type: string;
  size: number;
  activity_date: string;
  activity_type: string;
  activity_name?: string;
  custom_filename?: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  s3_key: string;
  generated_filename: string;
  expires_in: number;
}

export interface FileConfirmRequest {
  s3_key: string;
  size: number;
  content_type: string;
  original_filename: string;
  activity_date: string;
  activity_type: string;
  activity_name?: string;
}

export interface UpdateFileData {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  free_tags?: string[];
}

// ============================================================================
// Log Types
// ============================================================================

export interface FileLog {
  id: number;
  user_id: number;
  file_id?: number;
  operation: 'upload' | 'delete' | 'access';
  file_path: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  user?: User;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface FileFilters {
  directory?: string;
  activity_type?: string;
  activity_name?: string;
  activity_date?: string;  // Specific date filter
  date_from?: string;
  date_to?: string;
  uploader_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
  media_type?: 'all' | 'image' | 'video';
  tags?: string[];
  year?: number;
  month?: number;
}

// ============================================================================
// Directory Types
// ============================================================================

export interface DirectoryNode {
  value?: string;  // Tag value (e.g., 'regular_training')
  name: string;    // Display name (e.g., '例训')
  path: string;
  subdirectories?: DirectoryNode[];  // Changed from children to match API
  file_count?: number;
  // Activity-level fields (for third level)
  activity_date?: string;
  activity_name?: string;
  activity_type?: string;
}

// ============================================================================
// Tag Preset Types
// ============================================================================

export interface TagPreset {
  id: number;
  category: 'activity_type';
  value: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TagPresetsResponse {
  success: boolean;
  presets: TagPreset[];
}

export interface AddTagPresetRequest {
  category: 'activity_type';
  value: string;
  display_name: string;
}

export interface UpdateFileTagsRequest {
  activity_date: string;
  activity_type: string;
  activity_name?: string;
}


// ============================================================================
// Timeline Types
// ============================================================================

export interface TimelineMonth {
  count: number;
}

export interface TimelineYear {
  [month: string]: TimelineMonth;
}

export interface Timeline {
  [year: string]: TimelineYear;
}

// ============================================================================
// Batch Operation Types
// ============================================================================

export interface BatchDeleteRequest {
  file_ids: number[];
}

export interface BatchTagRequest {
  file_ids: number[];
  tag_name: string;
}

export interface BatchRemoveTagRequest {
  file_ids: number[];
  tag_id: number;
}

export interface BatchUpdateData {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
}

export interface BatchUpdateRequest {
  file_ids: number[];
  updates: BatchUpdateData;
}

export interface BatchOperationFailure {
  file_id: number;
  error: string;
}

export interface BatchOperationResult {
  success: boolean;
  code?: string;
  message?: string;
  results?: {
    succeeded: number[];
    failed: BatchOperationFailure[];
  };
}

// ============================================================================
// File List Response Types
// ============================================================================

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
}

export interface FileListResponse {
  files: File[];
  pagination: Pagination;
  timeline?: Timeline;
}

// ============================================================================
// Adjacent Files Types
// ============================================================================

export interface AdjacentFiles {
  previous?: File;
  next?: File;
}


// ============================================================================
// File Request Types
// ============================================================================

export interface ProposedChanges {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  instructor?: string;
  filename?: string;
  free_tags?: string[];
  new_activity_name?: string;
  new_activity_type?: string;
}

export interface DirectoryInfo {
  activity_date: string;
  activity_name: string;
  activity_type: string;
}

export interface FileRequestFile {
  id: number;
  filename: string;
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
}

export interface FileRequestUser {
  id: number;
  name: string;
}

export interface FileRequest {
  id: number;
  file_id: number | null;
  requester_id: number;
  owner_id: number;
  request_type: 'edit' | 'delete' | 'directory_edit';
  status: 'pending' | 'approved' | 'rejected';
  proposed_changes?: ProposedChanges;
  directory_info?: DirectoryInfo;
  message?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
  file?: FileRequestFile;
  requester?: FileRequestUser;
  owner?: FileRequestUser;
}

export interface CreateRequestData {
  file_id: number;
  request_type: 'edit' | 'delete';
  proposed_changes?: ProposedChanges;
  message?: string;
}

export interface CreateDirectoryRequestData {
  activity_date: string;
  activity_name: string;
  activity_type: string;
  proposed_changes: {
    new_activity_name?: string;
    new_activity_type?: string;
  };
  message?: string;
}

// ============================================================================
// Upload Queue Types (Mobile-specific)
// ============================================================================

export interface UploadMetadata {
  activity_date: string;
  activity_type: string;
  activity_name?: string;
  custom_filename?: string;
}

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadQueueItem {
  id: string;
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  metadata: UploadMetadata;
  status: UploadStatus;
  progress: number;
  error?: string;
  createdAt: number;
}

// ============================================================================
// Media Type
// ============================================================================

export type MediaType = 'all' | 'image' | 'video';
