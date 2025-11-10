// API endpoints
export const API_ENDPOINTS = {
  // Auth
  SEND_CODE: '/api/auth/send-code',
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  REFRESH: '/api/auth/refresh',
  ME: '/api/auth/me',
  
  // Files
  UPLOAD_URL: '/api/files/upload-url',
  CONFIRM_UPLOAD: '/api/files/confirm',
  FILES: '/api/files',
  FILE_BY_ID: (id: number) => `/api/files/${id}`,
  DIRECTORIES: '/api/files/directories',
  
  // Logs
  LOGS: '/api/logs',
  LOGS_SUMMARY: '/api/logs/summary',
};

// Directory structure
export const DIRECTORIES = {
  REHEARSALS: 'rehearsals',
  EVENTS: 'events',
  MEMBERS: 'members',
  RESOURCES: 'resources',
  ADMIN: 'admin',
} as const;

// File size limits
export const FILE_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB

// Pagination
export const DEFAULT_PAGE_SIZE = 50;

// JWT token expiration (7 days in seconds)
export const JWT_EXPIRATION = 7 * 24 * 60 * 60;

// Verification code expiration (10 minutes in seconds)
export const VERIFICATION_CODE_EXPIRATION = 10 * 60;

// Rate limits
export const RATE_LIMITS = {
  VERIFICATION_CODE: 3, // per hour
  API_REQUESTS: 100, // per minute
};

// S3 URLs
export const S3_URLS = {
  BASE: process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud.s3.bitiful.net',
  MAIN: process.env.NEXT_PUBLIC_S3_MAIN_URL || 'https://funkandlove-main.s3.bitiful.net',
};

// Loading emoji count (1-16)
export const LOADING_EMOJI_COUNT = 16;

// Team information
export const TEAM_INFO = {
  NAME: 'Funk & Love',
  BUILDER: 'Hofmann',
  DOMAIN: 'cloud.funk-and.love',
};
