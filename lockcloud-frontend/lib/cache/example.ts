/**
 * Example usage of CacheManager
 * This file demonstrates how to use the cache system
 */

import { getCacheManager } from './index';

export async function exampleUsage() {
  // Get singleton instance
  const cacheManager = getCacheManager();
  
  // Initialize cache system
  await cacheManager.initialize();
  
  // Example 1: Cache a file
  const fileBlob = new Blob(['file content'], { type: 'text/plain' });
  await cacheManager.setFile('file-123', 's3/path/to/file.txt', fileBlob, 'etag-abc');
  
  // Retrieve the cached file
  const cachedFile = await cacheManager.getFile('file-123', 's3/path/to/file.txt');
  if (cachedFile) {
    console.log('File retrieved from cache');
    await cacheManager.recordHit(cachedFile.size);
  } else {
    console.log('File not in cache');
    await cacheManager.recordMiss();
  }
  
  // Example 2: Cache video frame
  const frameBlob = new Blob(['frame data'], { type: 'image/jpeg' });
  await cacheManager.setVideoFrame('video.mp4', 0, frameBlob, 1920, 1080);
  
  const frame = await cacheManager.getVideoFrame('video.mp4', 0);
  if (frame) {
    console.log('Video frame retrieved from cache');
  }
  
  // Example 3: Get statistics
  const stats = await cacheManager.getStats();
  console.log('Cache Statistics:', {
    totalFiles: stats.totalFiles,
    totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
    hitRate: `${((stats.hitCount / (stats.hitCount + stats.missCount)) * 100).toFixed(2)}%`,
    savedTraffic: `${(stats.savedTraffic / 1024 / 1024).toFixed(2)} MB`,
  });
  
  // Example 4: Check storage space
  const storageInfo = await cacheManager.checkSpace();
  console.log('Storage Info:', {
    used: `${(storageInfo.used / 1024 / 1024).toFixed(2)} MB`,
    available: `${(storageInfo.available / 1024 / 1024).toFixed(2)} MB`,
    percentage: `${storageInfo.percentage.toFixed(2)}%`,
  });
  
  // Example 5: Cleanup if needed
  if (storageInfo.percentage > 80) {
    console.log('Storage usage high, triggering cleanup...');
    await cacheManager.cleanup(50 * 1024 * 1024); // Free 50MB
  }
  
  // Example 6: Clear specific type
  await cacheManager.clearByType('image');
  console.log('Cleared all image cache');
  
  // Example 7: Delete specific file
  await cacheManager.deleteFile('file-123');
  console.log('Deleted file from cache');
}

// Example: React hook usage
export function useCacheManager() {
  const cacheManager = getCacheManager();
  
  return {
    cacheFile: async (fileId: string, s3Key: string, blob: Blob, version?: string) => {
      try {
        await cacheManager.setFile(fileId, s3Key, blob, version);
        return true;
      } catch (error) {
        console.error('Failed to cache file:', error);
        return false;
      }
    },
    
    getCachedFile: async (fileId: string, s3Key: string) => {
      try {
        const blob = await cacheManager.getFile(fileId, s3Key);
        if (blob) {
          await cacheManager.recordHit(blob.size);
        } else {
          await cacheManager.recordMiss();
        }
        return blob;
      } catch (error) {
        console.error('Failed to get cached file:', error);
        return null;
      }
    },
    
    getStats: () => cacheManager.getStats(),
    checkSpace: () => cacheManager.checkSpace(),
    cleanup: () => cacheManager.cleanup(),
  };
}
