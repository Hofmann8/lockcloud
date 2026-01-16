// User types
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar_key?: string;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  is_admin: boolean;
}

// Free Tag types
export interface FreeTag {
  id: number;
  name: string;
}

export interface TagWithCount extends FreeTag {
  count: number;
}

// File types
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
  thumbhash?: string;
}

// Auth types (SSO-based)
export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// File operation types
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

// Log types
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

// Filter types
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

// Directory types
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

// Tag Preset types
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

// Timeline types
export interface TimelineMonth {
  count: number;
}

export interface TimelineYear {
  [month: string]: TimelineMonth;
}

export interface Timeline {
  [year: string]: TimelineYear;
}

// Batch operation types
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

export interface BatchOperationResult {
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

// File list response with timeline
export interface FileListResponse {
  files: File[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
  timeline?: Timeline;
}
