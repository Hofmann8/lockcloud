/**
 * Storage Services Index
 * 
 * Exports both secure storage (for sensitive data) and cache storage (for general caching).
 */

// Re-export secure store functions with namespace
export {
  setToken,
  getToken,
  removeToken,
  setUser,
  getUser,
  removeUser,
  clearAll as clearSecureStorage,
  secureStore,
} from './secureStore';

// Re-export cache store functions with namespace
export {
  set as cacheSet,
  get as cacheGet,
  remove as cacheRemove,
  isExpired as cacheIsExpired,
  clearExpired as cacheClearExpired,
  clearAll as clearCacheStorage,
  clearByPrefix as cacheClearByPrefix,
  setFileList,
  getFileList,
  setThumbnail,
  getThumbnail,
  setActivityPresets,
  getActivityPresets,
  setDirectories,
  getDirectories,
  setTags,
  getTags,
  cacheStore,
  CACHE_EXPIRATION,
  CACHE_KEYS,
} from './cacheStore';

// Re-export offline sync functions
export {
  generateFilterKey,
  cacheFileList,
  getCachedFileList,
  clearCachedFileLists,
  queueOperation,
  getPendingOperations,
  removePendingOperation,
  clearPendingOperations,
  processPendingOperations,
  getLastSyncTime,
  updateLastSyncTime,
  getSyncStatus,
  subscribeToNetworkChanges,
  isOnline,
  default as offlineSync,
} from './offlineSync';

// Re-export types
export type { StorageService } from './secureStore';
export type { CacheService, CachedItem } from './cacheStore';
export type {
  OfflineOperationType,
  PendingOperation,
  SyncStatus,
  OperationExecutor,
  NetworkChangeCallback,
} from './offlineSync';
