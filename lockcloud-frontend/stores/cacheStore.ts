import { create } from 'zustand';

/**
 * Cache Store
 * 
 * Manages file caching using IndexedDB for efficient storage
 * and retrieval of preloaded files.
 */

interface CacheItem {
  fileId: string;
  s3Key: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

interface CacheState {
  // State
  cacheSize: number;
  maxCacheSize: number; // in bytes, default 100MB
  
  // Actions
  cacheFile: (fileId: string, s3Key: string, blob: Blob) => Promise<void>;
  getFile: (fileId: string, s3Key: string) => Promise<Blob | null>;
  removeFile: (fileId: string, s3Key: string) => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  evictOldestFiles: (requiredSpace: number) => Promise<void>;
}

// IndexedDB database name and version
const DB_NAME = 'lockcloud-cache';
const DB_VERSION = 1;
const STORE_NAME = 'files';

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('size', 'size', { unique: false });
      }
    };
  });
}

/**
 * Generate cache key
 */
function getCacheKey(fileId: string, s3Key: string): string {
  return `${fileId}:${s3Key}`;
}

export const useCacheStore = create<CacheState>()((set, get) => ({
  cacheSize: 0,
  maxCacheSize: 100 * 1024 * 1024, // 100MB

  cacheFile: async (fileId: string, s3Key: string, blob: Blob) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const key = getCacheKey(fileId, s3Key);
      const item: CacheItem & { key: string } = {
        key,
        fileId,
        s3Key,
        blob,
        timestamp: Date.now(),
        size: blob.size,
      };

      // Check if adding this file would exceed max cache size
      const currentSize = await get().getCacheSize();
      if (currentSize + blob.size > get().maxCacheSize) {
        // Remove oldest files until we have enough space
        await get().evictOldestFiles(blob.size);
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update cache size
      set({ cacheSize: currentSize + blob.size });
    } catch (error) {
      console.error('Failed to cache file:', error);
    }
  },

  getFile: async (fileId: string, s3Key: string) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const key = getCacheKey(fileId, s3Key);

      return await new Promise<Blob | null>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result as (CacheItem & { key: string }) | undefined;
          resolve(result?.blob || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get cached file:', error);
      return null;
    }
  },

  removeFile: async (fileId: string, s3Key: string) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const key = getCacheKey(fileId, s3Key);

      // Get file size before deleting
      const item = await new Promise<(CacheItem & { key: string }) | undefined>((resolve, reject) => {
        const getRequest = store.get(key);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      });

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update cache size
      if (item) {
        const currentSize = get().cacheSize;
        set({ cacheSize: Math.max(0, currentSize - item.size) });
      }
    } catch (error) {
      console.error('Failed to remove cached file:', error);
    }
  },

  clearCache: async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      set({ cacheSize: 0 });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },

  getCacheSize: async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise<number>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const items = request.result as (CacheItem & { key: string })[];
          const totalSize = items.reduce((sum, item) => sum + item.size, 0);
          resolve(totalSize);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  },

  // Helper method to evict oldest files
  evictOldestFiles: async (requiredSpace: number) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      // Get all items sorted by timestamp (oldest first)
      const items = await new Promise<(CacheItem & { key: string })[]>((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      let freedSpace = 0;
      const currentSize = await get().getCacheSize();
      const targetSize = currentSize + requiredSpace - get().maxCacheSize;

      // Delete oldest files until we have enough space
      for (const item of items) {
        if (freedSpace >= targetSize) break;

        await new Promise<void>((resolve, reject) => {
          const request = store.delete(item.key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        freedSpace += item.size;
      }

      // Update cache size
      set({ cacheSize: Math.max(0, currentSize - freedSpace) });
    } catch (error) {
      console.error('Failed to evict oldest files:', error);
    }
  },
}));
