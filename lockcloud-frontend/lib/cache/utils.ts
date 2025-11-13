/**
 * Cache utility functions
 */

/**
 * Generate cache key for a file
 */
export function generateFileCacheKey(fileId: string): string {
  return `file:${fileId}`;
}

/**
 * Generate cache key for a video frame
 */
export function generateFrameCacheKey(
  s3Key: string, 
  frameIndex: number, 
  width?: number
): string {
  const params = width ? `_w${width}` : '';
  return `frame:${s3Key}:${frameIndex}${params}`;
}

/**
 * Generate cache key for a thumbnail
 */
export function generateThumbnailKey(
  s3Key: string, 
  width: number, 
  quality: number
): string {
  return `thumb:${s3Key}:${width}x${quality}`;
}

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;
    
    return { usage, quota, percentage };
  }
  
  return { usage: 0, quota: 0, percentage: 0 };
}
