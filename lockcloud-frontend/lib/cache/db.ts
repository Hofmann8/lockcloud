/**
 * IndexedDB initialization and database management
 */

import { CacheError, CacheErrorType } from './types';

const DB_NAME = 'lockcloud-cache';
const DB_VERSION = 1;

export const STORE_NAMES = {
  FILES: 'files',
  VIDEO_FRAMES: 'video-frames',
  METADATA: 'metadata',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB database with proper schema
 */
export async function initializeIndexedDB(): Promise<IDBDatabase> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing promise if initialization is in progress
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new CacheError(
        CacheErrorType.DB_ERROR,
        'IndexedDB is not supported in this environment'
      ));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to open IndexedDB',
        request.error || undefined
      );
      reject(error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle unexpected database closure
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create files object store
      if (!db.objectStoreNames.contains(STORE_NAMES.FILES)) {
        const filesStore = db.createObjectStore(STORE_NAMES.FILES, { keyPath: 'id' });
        filesStore.createIndex('s3Key', 's3Key', { unique: false });
        filesStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        filesStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        filesStore.createIndex('isOfflineAvailable', 'isOfflineAvailable', { unique: false });
      }

      // Create video-frames object store
      if (!db.objectStoreNames.contains(STORE_NAMES.VIDEO_FRAMES)) {
        const framesStore = db.createObjectStore(STORE_NAMES.VIDEO_FRAMES, { keyPath: 'id' });
        framesStore.createIndex('s3Key', 's3Key', { unique: false });
        framesStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }

      // Create metadata object store
      if (!db.objectStoreNames.contains(STORE_NAMES.METADATA)) {
        db.createObjectStore(STORE_NAMES.METADATA, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

/**
 * Get database instance (lazy initialization)
 */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  return initializeIndexedDB();
}

/**
 * Close database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

/**
 * Delete entire database (for testing or reset)
 */
export async function deleteDatabase(): Promise<void> {
  closeDB();
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new CacheError(
      CacheErrorType.DB_ERROR,
      'Failed to delete database',
      request.error || undefined
    ));
  });
}
