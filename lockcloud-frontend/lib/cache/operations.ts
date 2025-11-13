/**
 * Basic CRUD operations for IndexedDB cache
 */

import { getDB, STORE_NAMES } from './db';
import { 
  FileCacheEntry, 
  VideoFrameCacheEntry, 
  CacheMetadata,
  CacheError,
  CacheErrorType 
} from './types';

/**
 * Generic get operation from IndexedDB
 */
async function getFromStore<T>(
  storeName: string,
  key: string
): Promise<T | null> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to get item from ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error accessing ${storeName}`,
      error as Error
    );
  }
}

/**
 * Generic put operation to IndexedDB
 */
async function putToStore<T>(
  storeName: string,
  value: T
): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        // Check for quota exceeded error
        if (request.error?.name === 'QuotaExceededError') {
          reject(new CacheError(
            CacheErrorType.QUOTA_EXCEEDED,
            'Storage quota exceeded',
            request.error
          ));
        } else {
          reject(new CacheError(
            CacheErrorType.DB_ERROR,
            `Failed to put item to ${storeName}`,
            request.error || undefined
          ));
        }
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error writing to ${storeName}`,
      error as Error
    );
  }
}

/**
 * Generic delete operation from IndexedDB
 */
async function deleteFromStore(
  storeName: string,
  key: string
): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to delete item from ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error deleting from ${storeName}`,
      error as Error
    );
  }
}

/**
 * Get all items from a store
 */
async function getAllFromStore<T>(
  storeName: string
): Promise<T[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to get all items from ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error reading from ${storeName}`,
      error as Error
    );
  }
}

/**
 * Clear all items from a store
 */
async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to clear ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error clearing ${storeName}`,
      error as Error
    );
  }
}

// File cache operations
export const fileCache = {
  get: (id: string) => getFromStore<FileCacheEntry>(STORE_NAMES.FILES, id),
  put: (entry: FileCacheEntry) => putToStore(STORE_NAMES.FILES, entry),
  delete: (id: string) => deleteFromStore(STORE_NAMES.FILES, id),
  getAll: () => getAllFromStore<FileCacheEntry>(STORE_NAMES.FILES),
  clear: () => clearStore(STORE_NAMES.FILES),
};

// Video frame cache operations
export const videoFrameCache = {
  get: (id: string) => getFromStore<VideoFrameCacheEntry>(STORE_NAMES.VIDEO_FRAMES, id),
  put: (entry: VideoFrameCacheEntry) => putToStore(STORE_NAMES.VIDEO_FRAMES, entry),
  delete: (id: string) => deleteFromStore(STORE_NAMES.VIDEO_FRAMES, id),
  getAll: () => getAllFromStore<VideoFrameCacheEntry>(STORE_NAMES.VIDEO_FRAMES),
  clear: () => clearStore(STORE_NAMES.VIDEO_FRAMES),
};

// Metadata operations
export const metadataCache = {
  get: (key: string) => getFromStore<CacheMetadata>(STORE_NAMES.METADATA, key),
  put: (entry: CacheMetadata) => putToStore(STORE_NAMES.METADATA, entry),
  delete: (key: string) => deleteFromStore(STORE_NAMES.METADATA, key),
  getAll: () => getAllFromStore<CacheMetadata>(STORE_NAMES.METADATA),
  clear: () => clearStore(STORE_NAMES.METADATA),
};

/**
 * Count items in a store
 */
export async function countItems(storeName: string): Promise<number> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to count items in ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error counting items in ${storeName}`,
      error as Error
    );
  }
}

/**
 * Get items by index
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to get items by index ${indexName} from ${storeName}`,
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    throw new CacheError(
      CacheErrorType.DB_ERROR,
      `Error querying ${storeName} by ${indexName}`,
      error as Error
    );
  }
}
