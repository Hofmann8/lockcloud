/**
 * CacheManager - Core cache management system
 * Implements singleton pattern for global cache coordination
 */

import { fileCache, videoFrameCache, metadataCache } from './operations';
import { 
  FileCacheEntry, 
  VideoFrameCacheEntry, 
  CacheStats, 
  StorageInfo,
  CacheError,
  CacheErrorType 
} from './types';
import { initializeIndexedDB } from './db';

// Constants
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
const CLEANUP_THRESHOLD = 400 * 1024 * 1024; // 400MB - trigger cleanup
const METADATA_KEYS = {
  HIT_COUNT: 'cache_hit_count',
  MISS_COUNT: 'cache_miss_count',
  SAVED_TRAFFIC: 'cache_saved_traffic',
};

/**
 * File type detection from content type
 */
function getFileType(contentType: string): 'image' | 'video' | 'document' {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Generate cache key for video frames
 */
function generateFrameCacheKey(s3Key: string, frameIndex: number): string {
  return `${s3Key}:frame:${frameIndex}`;
}

/**
 * CacheManager interface definition
 */
export interface ICacheManager {
  // Initialization
  initialize(): Promise<void>;
  
  // File cache operations
  getFile(fileId: string, s3Key: string): Promise<Blob | null>;
  setFile(fileId: string, s3Key: string, blob: Blob, version?: string): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  
  // Video frame cache operations
  getVideoFrame(s3Key: string, frameIndex: number): Promise<Blob | null>;
  setVideoFrame(s3Key: string, frameIndex: number, blob: Blob, width?: number, height?: number): Promise<void>;
  
  // Statistics
  getStats(): Promise<CacheStats>;
  recordHit(size: number): Promise<void>;
  recordMiss(): Promise<void>;
  
  // Space management
  checkSpace(): Promise<StorageInfo>;
  cleanup(targetSize?: number): Promise<void>;
  clearAll(): Promise<void>;
  clearByType(type: 'image' | 'video' | 'document'): Promise<void>;
}

/**
 * CacheManager singleton class
 */
export class CacheManager implements ICacheManager {
  private static instance: CacheManager | null = null;
  private initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Initialize cache system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await initializeIndexedDB();
      this.initialized = true;
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to initialize cache manager',
        error as Error
      );
    }
  }

  /**
   * Ensure cache is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============================================
  // File Cache Operations (Subtask 2.2)
  // ============================================

  /**
   * Get file from cache
   */
  public async getFile(fileId: string, _s3Key: string): Promise<Blob | null> {
    await this.ensureInitialized();
    
    try {
      const entry = await fileCache.get(fileId);
      
      if (!entry) {
        return null;
      }

      // Update last accessed time and access count
      entry.lastAccessedAt = Date.now();
      entry.accessCount += 1;
      await fileCache.put(entry);

      return entry.blob;
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        `Failed to get file ${fileId}`,
        error as Error
      );
    }
  }

  /**
   * Set file in cache
   */
  public async setFile(
    fileId: string, 
    s3Key: string, 
    blob: Blob, 
    version?: string
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // Check if we need to cleanup first
      const storageInfo = await this.checkSpace();
      if (storageInfo.used + blob.size > CLEANUP_THRESHOLD) {
        await this.cleanup(blob.size);
      }

      const now = Date.now();
      const entry: FileCacheEntry = {
        id: fileId,
        s3Key,
        blob,
        contentType: blob.type || 'application/octet-stream',
        size: blob.size,
        cachedAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        version: version || '',
        isOfflineAvailable: false,
      };

      await fileCache.put(entry);
    } catch (error) {
      if (error instanceof CacheError && error.type === CacheErrorType.QUOTA_EXCEEDED) {
        // Try cleanup and retry once
        await this.cleanup(blob.size * 2);
        await fileCache.put({
          id: fileId,
          s3Key,
          blob,
          contentType: blob.type || 'application/octet-stream',
          size: blob.size,
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 0,
          version: version || '',
          isOfflineAvailable: false,
        });
      } else {
        throw new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to set file ${fileId}`,
          error as Error
        );
      }
    }
  }

  /**
   * Delete file from cache
   */
  public async deleteFile(fileId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await fileCache.delete(fileId);
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        `Failed to delete file ${fileId}`,
        error as Error
      );
    }
  }

  // ============================================
  // Video Frame Cache Operations (Subtask 2.3)
  // ============================================

  /**
   * Get video frame from cache
   */
  public async getVideoFrame(s3Key: string, frameIndex: number): Promise<Blob | null> {
    await this.ensureInitialized();

    try {
      const cacheKey = generateFrameCacheKey(s3Key, frameIndex);
      const entry = await videoFrameCache.get(cacheKey);

      if (!entry) {
        return null;
      }

      // Update last accessed time
      entry.lastAccessedAt = Date.now();
      await videoFrameCache.put(entry);

      return entry.blob;
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        `Failed to get video frame ${s3Key}:${frameIndex}`,
        error as Error
      );
    }
  }

  /**
   * Set video frame in cache
   */
  public async setVideoFrame(
    s3Key: string,
    frameIndex: number,
    blob: Blob,
    width?: number,
    height?: number
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const cacheKey = generateFrameCacheKey(s3Key, frameIndex);
      const now = Date.now();

      const entry: VideoFrameCacheEntry = {
        id: cacheKey,
        s3Key,
        frameIndex,
        blob,
        width: width || 0,
        height: height || 0,
        cachedAt: now,
        lastAccessedAt: now,
      };

      await videoFrameCache.put(entry);
    } catch (error) {
      if (error instanceof CacheError && error.type === CacheErrorType.QUOTA_EXCEEDED) {
        // Try cleanup and retry once
        await this.cleanup(blob.size * 2);
        const cacheKey = generateFrameCacheKey(s3Key, frameIndex);
        await videoFrameCache.put({
          id: cacheKey,
          s3Key,
          frameIndex,
          blob,
          width: width || 0,
          height: height || 0,
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
      } else {
        throw new CacheError(
          CacheErrorType.DB_ERROR,
          `Failed to set video frame ${s3Key}:${frameIndex}`,
          error as Error
        );
      }
    }
  }

  // ============================================
  // Statistics Operations (Subtask 2.4)
  // ============================================

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    await this.ensureInitialized();

    try {
      const files = await fileCache.getAll();
      
      // Calculate totals and by-type stats
      let totalSize = 0;
      const byType = {
        image: { count: 0, size: 0 },
        video: { count: 0, size: 0 },
        document: { count: 0, size: 0 },
      };

      for (const file of files) {
        totalSize += file.size;
        const type = getFileType(file.contentType);
        byType[type].count += 1;
        byType[type].size += file.size;
      }

      // Get hit/miss counts from metadata
      const hitCountMeta = await metadataCache.get(METADATA_KEYS.HIT_COUNT);
      const missCountMeta = await metadataCache.get(METADATA_KEYS.MISS_COUNT);
      const savedTrafficMeta = await metadataCache.get(METADATA_KEYS.SAVED_TRAFFIC);

      const hitCount = (hitCountMeta?.value as number) || 0;
      const missCount = (missCountMeta?.value as number) || 0;
      const savedTraffic = (savedTrafficMeta?.value as number) || 0;

      return {
        totalFiles: files.length,
        totalSize,
        hitCount,
        missCount,
        savedTraffic,
        cacheByType: byType,
      };
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to get cache statistics',
        error as Error
      );
    }
  }

  /**
   * Record cache hit
   */
  public async recordHit(size: number): Promise<void> {
    await this.ensureInitialized();

    try {
      const hitCountMeta = await metadataCache.get(METADATA_KEYS.HIT_COUNT);
      const savedTrafficMeta = await metadataCache.get(METADATA_KEYS.SAVED_TRAFFIC);

      const hitCount = ((hitCountMeta?.value as number) || 0) + 1;
      const savedTraffic = ((savedTrafficMeta?.value as number) || 0) + size;

      await metadataCache.put({
        key: METADATA_KEYS.HIT_COUNT,
        value: hitCount,
        updatedAt: Date.now(),
      });

      await metadataCache.put({
        key: METADATA_KEYS.SAVED_TRAFFIC,
        value: savedTraffic,
        updatedAt: Date.now(),
      });
    } catch (error) {
      // Don't throw on stats update failure
      console.error('Failed to record cache hit:', error);
    }
  }

  /**
   * Record cache miss
   */
  public async recordMiss(): Promise<void> {
    await this.ensureInitialized();

    try {
      const missCountMeta = await metadataCache.get(METADATA_KEYS.MISS_COUNT);
      const missCount = ((missCountMeta?.value as number) || 0) + 1;

      await metadataCache.put({
        key: METADATA_KEYS.MISS_COUNT,
        value: missCount,
        updatedAt: Date.now(),
      });
    } catch (error) {
      // Don't throw on stats update failure
      console.error('Failed to record cache miss:', error);
    }
  }

  // ============================================
  // Space Management Operations (Subtask 2.5)
  // ============================================

  /**
   * Check storage space
   */
  public async checkSpace(): Promise<StorageInfo> {
    await this.ensureInitialized();

    try {
      // Get current usage from files
      const files = await fileCache.getAll();
      const frames = await videoFrameCache.getAll();

      const used = files.reduce((sum, f) => sum + f.size, 0) +
                    frames.reduce((sum, f) => sum + f.blob.size, 0);

      // Try to get quota from Storage API
      let quota = MAX_CACHE_SIZE;
      let available = MAX_CACHE_SIZE - used;

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage !== undefined) {
          quota = Math.min(estimate.quota, MAX_CACHE_SIZE);
          available = quota - estimate.usage;
        }
      }

      return {
        used,
        available: Math.max(0, available),
        quota,
        percentage: (used / quota) * 100,
      };
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to check storage space',
        error as Error
      );
    }
  }

  /**
   * Cleanup cache using LRU algorithm
   */
  public async cleanup(targetSize?: number): Promise<void> {
    await this.ensureInitialized();

    try {
      const files = await fileCache.getAll();
      
      // Sort by last accessed time (LRU)
      const sortedFiles = files
        .filter(f => !f.isOfflineAvailable) // Protect offline files
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

      let freedSize = 0;
      const target = targetSize || (MAX_CACHE_SIZE * 0.2); // Free 20% by default

      for (const file of sortedFiles) {
        if (freedSize >= target) break;
        
        await fileCache.delete(file.id);
        freedSize += file.size;
      }

      // Also cleanup old video frames if needed
      if (freedSize < target) {
        const frames = await videoFrameCache.getAll();
        const sortedFrames = frames.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

        for (const frame of sortedFrames) {
          if (freedSize >= target) break;
          
          await videoFrameCache.delete(frame.id);
          freedSize += frame.blob.size;
        }
      }
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to cleanup cache',
        error as Error
      );
    }
  }

  /**
   * Clear all cache
   */
  public async clearAll(): Promise<void> {
    await this.ensureInitialized();

    try {
      await fileCache.clear();
      await videoFrameCache.clear();
      
      // Reset statistics
      await metadataCache.put({
        key: METADATA_KEYS.HIT_COUNT,
        value: 0,
        updatedAt: Date.now(),
      });
      await metadataCache.put({
        key: METADATA_KEYS.MISS_COUNT,
        value: 0,
        updatedAt: Date.now(),
      });
      await metadataCache.put({
        key: METADATA_KEYS.SAVED_TRAFFIC,
        value: 0,
        updatedAt: Date.now(),
      });
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        'Failed to clear all cache',
        error as Error
      );
    }
  }

  /**
   * Clear cache by file type
   */
  public async clearByType(type: 'image' | 'video' | 'document'): Promise<void> {
    await this.ensureInitialized();

    try {
      const files = await fileCache.getAll();
      
      for (const file of files) {
        const fileType = getFileType(file.contentType);
        if (fileType === type) {
          await fileCache.delete(file.id);
        }
      }
    } catch (error) {
      throw new CacheError(
        CacheErrorType.DB_ERROR,
        `Failed to clear ${type} cache`,
        error as Error
      );
    }
  }
}

// Export singleton instance getter
export const getCacheManager = () => CacheManager.getInstance();
