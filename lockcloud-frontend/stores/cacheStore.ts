/**
 * Cache Store - Zustand store for cache management
 * Provides state management and operations for the cache system
 * 
 * This store integrates with CacheManager to provide:
 * - Centralized cache state management
 * - Async operations with error handling
 * - Statistics tracking and updates
 * - Cache lifecycle management
 */

import { create } from 'zustand';
import { getCacheManager } from '@/lib/cache/CacheManager';
import { CacheStats } from '@/lib/cache/types';

/**
 * Initial cache statistics
 */
const initialStats: CacheStats = {
  totalFiles: 0,
  totalSize: 0,
  hitCount: 0,
  missCount: 0,
  savedTraffic: 0,
  cacheByType: {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    document: { count: 0, size: 0 },
  },
};

/**
 * Cache Store interface
 */
interface CacheStore {
  // State
  stats: CacheStats;
  isInitialized: boolean;
  isPreloading: boolean;
  error: string | null;
  
  // Operations
  initialize: () => Promise<void>;
  getFile: (fileId: string, s3Key: string) => Promise<Blob | null>;
  cacheFile: (fileId: string, s3Key: string, blob: Blob, version?: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  preloadFile: (fileId: string, s3Key: string) => Promise<void>;
  
  // Statistics
  updateStats: () => Promise<void>;
  recordHit: (size: number) => void;
  recordMiss: () => void;
  
  // Cache management
  clearCache: () => Promise<void>;
  clearCacheByType: (type: 'image' | 'video' | 'document') => Promise<void>;
  checkSpace: () => Promise<{ used: number; available: number; quota: number; percentage: number }>;
  
  // Video frame operations
  getVideoFrame: (s3Key: string, frameIndex: number) => Promise<Blob | null>;
  cacheVideoFrame: (s3Key: string, frameIndex: number, blob: Blob, width?: number, height?: number) => Promise<void>;
  
  // Internal state setters
  setError: (error: string | null) => void;
  setIsPreloading: (isPreloading: boolean) => void;
}

/**
 * Create cache store
 */
export const useCacheStore = create<CacheStore>((set, get) => ({
  // Initial state
  stats: initialStats,
  isInitialized: false,
  isPreloading: false,
  error: null,
  
  /**
   * Initialize cache system
   * Initializes the CacheManager and loads initial statistics
   */
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }
    
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.initialize();
      
      // Load initial statistics
      await get().updateStats();
      
      set({ isInitialized: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize cache';
      set({ error: errorMessage, isInitialized: false });
      console.error('Cache initialization failed:', error);
    }
  },
  
  /**
   * Get file from cache
   * Returns cached file blob or null if not cached
   */
  getFile: async (fileId: string, s3Key: string) => {
    try {
      const cacheManager = getCacheManager();
      const blob = await cacheManager.getFile(fileId, s3Key);
      
      if (blob) {
        // Record cache hit
        get().recordHit(blob.size);
      } else {
        // Record cache miss
        get().recordMiss();
      }
      
      return blob;
    } catch (error) {
      console.error('Failed to get file from cache:', error);
      get().recordMiss();
      return null;
    }
  },
  
  /**
   * Cache file
   * Stores file blob in cache with optional version
   */
  cacheFile: async (fileId: string, s3Key: string, blob: Blob, version?: string) => {
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.setFile(fileId, s3Key, blob, version);
      
      // Update statistics after caching
      await get().updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cache file';
      set({ error: errorMessage });
      console.error('Failed to cache file:', error);
      throw error;
    }
  },
  
  /**
   * Delete file from cache
   */
  deleteFile: async (fileId: string) => {
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.deleteFile(fileId);
      
      // Update statistics after deletion
      await get().updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
      set({ error: errorMessage });
      console.error('Failed to delete file from cache:', error);
      throw error;
    }
  },
  
  /**
   * Preload file into cache
   * Fetches file from S3 and caches it
   */
  preloadFile: async (fileId: string, s3Key: string) => {
    try {
      // Check if already cached
      const cacheManager = getCacheManager();
      const cached = await cacheManager.getFile(fileId, s3Key);
      
      if (cached) {
        // Already cached, no need to preload
        return;
      }
      
      // Note: Actual fetching from S3 would be done by the component
      // This is just a placeholder for the preload logic
      // The component will call cacheFile after fetching
    } catch (error) {
      console.error('Failed to preload file:', error);
    }
  },
  
  /**
   * Update cache statistics
   * Fetches latest statistics from CacheManager
   */
  updateStats: async () => {
    try {
      const cacheManager = getCacheManager();
      const stats = await cacheManager.getStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to update cache statistics:', error);
    }
  },
  
  /**
   * Record cache hit
   * Updates hit count and saved traffic
   */
  recordHit: (size: number) => {
    const cacheManager = getCacheManager();
    
    // Update statistics in background (don't await)
    cacheManager.recordHit(size).catch((error) => {
      console.error('Failed to record cache hit:', error);
    });
    
    // Optimistically update local stats
    set((state) => ({
      stats: {
        ...state.stats,
        hitCount: state.stats.hitCount + 1,
        savedTraffic: state.stats.savedTraffic + size,
      },
    }));
  },
  
  /**
   * Record cache miss
   * Updates miss count
   */
  recordMiss: () => {
    const cacheManager = getCacheManager();
    
    // Update statistics in background (don't await)
    cacheManager.recordMiss().catch((error) => {
      console.error('Failed to record cache miss:', error);
    });
    
    // Optimistically update local stats
    set((state) => ({
      stats: {
        ...state.stats,
        missCount: state.stats.missCount + 1,
      },
    }));
  },
  
  /**
   * Clear all cache
   * Removes all cached files and resets statistics
   */
  clearCache: async () => {
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.clearAll();
      
      // Reset statistics
      set({ stats: initialStats });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear cache';
      set({ error: errorMessage });
      console.error('Failed to clear cache:', error);
      throw error;
    }
  },
  
  /**
   * Clear cache by file type
   * Removes cached files of specific type
   */
  clearCacheByType: async (type: 'image' | 'video' | 'document') => {
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.clearByType(type);
      
      // Update statistics after clearing
      await get().updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear cache by type';
      set({ error: errorMessage });
      console.error(`Failed to clear ${type} cache:`, error);
      throw error;
    }
  },
  
  /**
   * Check storage space
   * Returns current storage usage information
   */
  checkSpace: async () => {
    try {
      const cacheManager = getCacheManager();
      return await cacheManager.checkSpace();
    } catch (error) {
      console.error('Failed to check storage space:', error);
      throw error;
    }
  },
  
  /**
   * Get video frame from cache
   * Returns cached video frame blob or null if not cached
   */
  getVideoFrame: async (s3Key: string, frameIndex: number) => {
    try {
      const cacheManager = getCacheManager();
      const blob = await cacheManager.getVideoFrame(s3Key, frameIndex);
      
      if (blob) {
        // Record cache hit for video frame
        get().recordHit(blob.size);
      } else {
        // Record cache miss
        get().recordMiss();
      }
      
      return blob;
    } catch (error) {
      console.error('Failed to get video frame from cache:', error);
      get().recordMiss();
      return null;
    }
  },
  
  /**
   * Cache video frame
   * Stores video frame blob in cache
   */
  cacheVideoFrame: async (s3Key: string, frameIndex: number, blob: Blob, width?: number, height?: number) => {
    try {
      set({ error: null });
      const cacheManager = getCacheManager();
      await cacheManager.setVideoFrame(s3Key, frameIndex, blob, width, height);
      
      // Update statistics after caching
      await get().updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cache video frame';
      set({ error: errorMessage });
      console.error('Failed to cache video frame:', error);
      
      // Don't throw - video frame caching is not critical
      // Just log the error and continue
    }
  },
  
  setError: (error: string | null) => set({ error }),
  
  setIsPreloading: (isPreloading: boolean) => set({ isPreloading }),
}));
