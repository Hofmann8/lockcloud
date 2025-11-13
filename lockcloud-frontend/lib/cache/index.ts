/**
 * Cache module exports
 */

export { CacheManager, getCacheManager, type ICacheManager } from './CacheManager';
export { initializeIndexedDB, getDB, closeDB, deleteDatabase, STORE_NAMES } from './db';
export { 
  fileCache, 
  videoFrameCache, 
  metadataCache,
  countItems,
  getByIndex 
} from './operations';
export {
  type FileCacheEntry,
  type VideoFrameCacheEntry,
  type CacheMetadata,
  type CacheStats,
  type StorageInfo,
  CacheError,
  CacheErrorType,
} from './types';
