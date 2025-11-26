// User types
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
  instructor?: string;
  instructor_display?: string;
  is_legacy: boolean;
  uploader_id: number;
  uploaded_at: string;
  public_url: string;
  uploader?: User;
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
  instructor: string;
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
  instructor: string;
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
  instructor?: string;
  date_from?: string;
  date_to?: string;
  uploader_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

// Directory types
export interface DirectoryNode {
  value?: string;  // Tag value (e.g., 'regular_training')
  name: string;    // Display name (e.g., '例训')
  path: string;
  subdirectories?: DirectoryNode[];  // Changed from children to match API
  file_count?: number;
}

// Tag Preset types
export interface TagPreset {
  id: number;
  category: 'activity_type' | 'instructor';
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
  category: 'activity_type' | 'instructor';
  value: string;
  display_name: string;
}

export interface UpdateFileTagsRequest {
  activity_date: string;
  activity_type: string;
  instructor: string;
}
