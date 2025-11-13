/**
 * Cache types and interfaces for IndexedDB storage
 */

export interface FileCacheEntry {
  id: string;              // Primary key: file ID
  s3Key: string;           // S3 object key
  blob: Blob;              // File data
  contentType: string;     // MIME type
  size: number;            // File size in bytes
  cachedAt: number;        // Timestamp
  lastAccessedAt: number;  // Timestamp for LRU
  accessCount: number;     // Access frequency
  version: string;         // ETag or version identifier
  isOfflineAvailable: boolean; // User marked for offline
}

export interface VideoFrameCacheEntry {
  id: string;              // Primary key: s3Key + frameIndex
  s3Key: string;           // Video S3 key
  frameIndex: number;      // Frame number
  blob: Blob;              // Frame image data
  width: number;           // Frame width
  height: number;          // Frame height
  cachedAt: number;        // Timestamp
  lastAccessedAt: number;  // Timestamp for LRU
}

export interface CacheMetadata {
  key: string;             // Primary key
  value: unknown;          // Metadata value
  updatedAt: number;       // Timestamp
}

export interface CacheStats {
  totalFiles: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  savedTraffic: number; // bytes
  cacheByType: {
    image: { count: number; size: number };
    video: { count: number; size: number };
    document: { count: number; size: number };
  };
}

export interface StorageInfo {
  used: number;
  available: number;
  quota: number;
  percentage: number;
}

export enum CacheErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  DB_ERROR = 'DB_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_DATA = 'INVALID_DATA',
}

export class CacheError extends Error {
  constructor(
    public type: CacheErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'CacheError';
  }
}
