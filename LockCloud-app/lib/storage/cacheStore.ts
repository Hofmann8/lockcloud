/**
 * Cache Storage Service
 * 
 * Uses AsyncStorage for general-purpose caching with expiration support.
 * Implements cache expiration: 24 hours for file lists, 7 days for thumbnails.
 * 
 * Requirements: 7.4, 11.1, 11.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache expiration times in milliseconds
export const CACHE_EXPIRATION = {
  FILE_LIST: 24 * 60 * 60 * 1000,      // 24 hours
  THUMBNAILS: 7 * 24 * 60 * 60 * 1000, // 7 days
  ACTIVITY_PRESETS: 7 * 24 * 60 * 60 * 1000, // 7 days
  DEFAULT: 24 * 60 * 60 * 1000,        // 24 hours default
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  FILE_LIST: 'cache_file_list_',
  THUMBNAIL: 'cache_thumbnail_',
  ACTIVITY_PRESETS: 'cache_activity_presets',
  DIRECTORIES: 'cache_directories',
  TAGS: 'cache_tags',
} as const;

/**
 * Cached item wrapper with metadata
 */
export interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache service interface
 */
export interface CacheService {
  set<T>(key: string, data: T, expirationMs?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  isExpired(key: string): Promise<boolean>;
  clearExpired(): Promise<void>;
  clearAll(): Promise<void>;
  clearByPrefix(prefix: string): Promise<void>;
}

/**
 * Store data in cache with expiration
 * @param key - Cache key
 * @param data - Data to cache
 * @param expirationMs - Expiration time in milliseconds (default: 24 hours)
 */
export async function set<T>(
  key: string,
  data: T,
  expirationMs: number = CACHE_EXPIRATION.DEFAULT
): Promise<void> {
  const now = Date.now();
  const cachedItem: CachedItem<T> = {
    data,
    timestamp: now,
    expiresAt: now + expirationMs,
  };
  await AsyncStorage.setItem(key, JSON.stringify(cachedItem));
}

/**
 * Retrieve data from cache if not expired
 * @param key - Cache key
 * @returns Cached data or null if not found or expired
 */
export async function get<T>(key: string): Promise<T | null> {
  const itemJson = await AsyncStorage.getItem(key);
  if (!itemJson) {
    return null;
  }

  try {
    const cachedItem = JSON.parse(itemJson) as CachedItem<T>;
    const now = Date.now();

    // Check if expired
    if (now >= cachedItem.expiresAt) {
      // Remove expired item
      await remove(key);
      return null;
    }

    return cachedItem.data;
  } catch {
    // If JSON parsing fails, remove corrupted data
    await remove(key);
    return null;
  }
}

/**
 * Remove item from cache
 * @param key - Cache key
 */
export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Check if a cached item is expired
 * @param key - Cache key
 * @returns true if expired or not found, false if valid
 */
export async function isExpired(key: string): Promise<boolean> {
  const itemJson = await AsyncStorage.getItem(key);
  if (!itemJson) {
    return true;
  }

  try {
    const cachedItem = JSON.parse(itemJson) as CachedItem<unknown>;
    return Date.now() >= cachedItem.expiresAt;
  } catch {
    return true;
  }
}

/**
 * Clear all expired cache items
 */
export async function clearExpired(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(key => 
    key.startsWith('cache_')
  );

  const now = Date.now();
  const keysToRemove: string[] = [];

  for (const key of cacheKeys) {
    const itemJson = await AsyncStorage.getItem(key);
    if (itemJson) {
      try {
        const cachedItem = JSON.parse(itemJson) as CachedItem<unknown>;
        if (now >= cachedItem.expiresAt) {
          keysToRemove.push(key);
        }
      } catch {
        // Remove corrupted items
        keysToRemove.push(key);
      }
    }
  }

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}

/**
 * Clear all cache items
 */
export async function clearAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(key => key.startsWith('cache_'));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

/**
 * Clear cache items by key prefix
 * @param prefix - Key prefix to match
 */
export async function clearByPrefix(prefix: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const matchingKeys = keys.filter(key => key.startsWith(prefix));
  if (matchingKeys.length > 0) {
    await AsyncStorage.multiRemove(matchingKeys);
  }
}

// ============================================================================
// Convenience methods for specific cache types
// ============================================================================

/**
 * Cache file list response
 * @param filterKey - Unique key based on filters
 * @param data - File list data
 */
export async function setFileList<T>(filterKey: string, data: T): Promise<void> {
  await set(`${CACHE_KEYS.FILE_LIST}${filterKey}`, data, CACHE_EXPIRATION.FILE_LIST);
}

/**
 * Get cached file list
 * @param filterKey - Unique key based on filters
 */
export async function getFileList<T>(filterKey: string): Promise<T | null> {
  return get<T>(`${CACHE_KEYS.FILE_LIST}${filterKey}`);
}

/**
 * Cache thumbnail URL
 * @param fileId - File ID
 * @param url - Thumbnail URL
 */
export async function setThumbnail(fileId: number, url: string): Promise<void> {
  await set(`${CACHE_KEYS.THUMBNAIL}${fileId}`, url, CACHE_EXPIRATION.THUMBNAILS);
}

/**
 * Get cached thumbnail URL
 * @param fileId - File ID
 */
export async function getThumbnail(fileId: number): Promise<string | null> {
  return get<string>(`${CACHE_KEYS.THUMBNAIL}${fileId}`);
}

/**
 * Cache activity type presets
 * @param presets - Activity type presets
 */
export async function setActivityPresets<T>(presets: T): Promise<void> {
  await set(CACHE_KEYS.ACTIVITY_PRESETS, presets, CACHE_EXPIRATION.ACTIVITY_PRESETS);
}

/**
 * Get cached activity type presets
 */
export async function getActivityPresets<T>(): Promise<T | null> {
  return get<T>(CACHE_KEYS.ACTIVITY_PRESETS);
}

/**
 * Cache directory structure
 * @param directories - Directory tree
 */
export async function setDirectories<T>(directories: T): Promise<void> {
  await set(CACHE_KEYS.DIRECTORIES, directories, CACHE_EXPIRATION.FILE_LIST);
}

/**
 * Get cached directory structure
 */
export async function getDirectories<T>(): Promise<T | null> {
  return get<T>(CACHE_KEYS.DIRECTORIES);
}

/**
 * Cache tags list
 * @param tags - Tags with counts
 */
export async function setTags<T>(tags: T): Promise<void> {
  await set(CACHE_KEYS.TAGS, tags, CACHE_EXPIRATION.FILE_LIST);
}

/**
 * Get cached tags list
 */
export async function getTags<T>(): Promise<T | null> {
  return get<T>(CACHE_KEYS.TAGS);
}

// Export as a service object for convenience
export const cacheStore: CacheService = {
  set,
  get,
  remove,
  isExpired,
  clearExpired,
  clearAll,
  clearByPrefix,
};

export default cacheStore;
