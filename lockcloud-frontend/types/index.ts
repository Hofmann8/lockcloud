// User types
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  is_admin: boolean;
}

// File types
export interface File {
  id: number;
  filename: string;
  directory: string;
  s3_key: string;
  size: number;
  content_type: string;
  uploader_id: number;
  uploaded_at: string;
  public_url: string;
  uploader?: User;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  code: string;
}

export interface AuthResponse {
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
  filename: string;
  directory: string;
  content_type: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_key: string;
}

export interface FileConfirmRequest {
  file_key: string;
  filename: string;
  directory: string;
  size: number;
  content_type: string;
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
  start_date?: string;
  end_date?: string;
  uploader_id?: number;
  page?: number;
  per_page?: number;
}

// Directory types
export interface DirectoryNode {
  name: string;
  path: string;
  children?: DirectoryNode[];
  file_count?: number;
}
