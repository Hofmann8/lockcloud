# Cache Infrastructure

This directory contains the IndexedDB-based cache infrastructure for LockCloud.

## Structure

- **types.ts** - TypeScript interfaces and types for cache entries
- **db.ts** - IndexedDB initialization and database management
- **operations.ts** - Basic CRUD operations for cache stores
- **CacheManager.ts** - Core cache management with singleton pattern (NEW)
- **index.ts** - Main export file

## Database Schema

### Database: `lockcloud-cache` (Version 1)

#### Object Stores

1. **files** - Stores cached file data
   - Primary Key: `id` (file ID)
   - Indexes: `s3Key`, `lastAccessedAt`, `cachedAt`, `isOfflineAvailable`

2. **video-frames** - Stores cached video frame thumbnails
   - Primary Key: `id` (generated from s3Key + frameIndex)
   - Indexes: `s3Key`, `lastAccessedAt`

3. **metadata** - Stores cache metadata and statistics
   - Primary Key: `key`

## Usage

### CacheManager (Recommended)

The `CacheManager` provides a high-level API with automatic space management, statistics tracking, and LRU cleanup.

```typescript
import { getCacheManager } from '@/lib/cache';

// Get singleton instance
const cacheManager = getCacheManager();
await cacheManager.initialize();

// Cache a file
const blob = new Blob([fileData], { type: 'image/jpeg' });
await cacheManager.setFile('file-123', 's3-key-path', blob, 'etag-version');

// Retrieve a file
const cachedBlob = await cacheManager.getFile('file-123', 's3-key-path');

// Cache video frame
await cacheManager.setVideoFrame('video-s3-key', 0, frameBlob, 1920, 1080);
const frame = await cacheManager.getVideoFrame('video-s3-key', 0);

// Get statistics
const stats = await cacheManager.getStats();
console.log(`Cache hit rate: ${stats.hitCount / (stats.hitCount + stats.missCount)}`);

// Space management
const storageInfo = await cacheManager.checkSpace();
await cacheManager.cleanup(50 * 1024 * 1024); // Free 50MB
await cacheManager.clearByType('image');
await cacheManager.clearAll();
```

### Low-Level Operations

For direct database access:

```typescript
import { initializeIndexedDB } from '@/lib/cache';

// Initialize the database
const db = await initializeIndexedDB();
```

### File Cache Operations

```typescript
import { fileCache } from '@/lib/cache';

// Store a file
await fileCache.put({
  id: 'file-123',
  s3Key: 'path/to/file.jpg',
  blob: fileBlob,
  contentType: 'image/jpeg',
  size: 1024000,
  cachedAt: Date.now(),
  lastAccessedAt: Date.now(),
  accessCount: 1,
  version: 'etag-abc123',
  isOfflineAvailable: false,
});

// Retrieve a file
const entry = await fileCache.get('file-123');

// Delete a file
await fileCache.delete('file-123');

// Get all files
const allFiles = await fileCache.getAll();

// Clear all files
await fileCache.clear();
```

### Video Frame Cache Operations

```typescript
import { videoFrameCache, generateFrameCacheKey } from '@/lib/cache';

const frameId = generateFrameCacheKey('video.mp4', 0, 800);

await videoFrameCache.put({
  id: frameId,
  s3Key: 'path/to/video.mp4',
  frameIndex: 0,
  blob: frameBlob,
  width: 800,
  height: 600,
  cachedAt: Date.now(),
  lastAccessedAt: Date.now(),
});
```

### Metadata Operations

```typescript
import { metadataCache } from '@/lib/cache';

// Store metadata
await metadataCache.put({
  key: 'cache-stats',
  value: { hitCount: 100, missCount: 20 },
  updatedAt: Date.now(),
});

// Retrieve metadata
const stats = await metadataCache.get('cache-stats');
```

### Utility Functions

```typescript
import { 
  isIndexedDBSupported, 
  getStorageEstimate,
  generateFileCacheKey 
} from '@/lib/cache';

// Check browser support
if (isIndexedDBSupported()) {
  // Initialize cache
}

// Get storage usage
const { usage, quota, percentage } = await getStorageEstimate();
console.log(`Using ${percentage.toFixed(2)}% of available storage`);

// Generate cache keys
const fileKey = generateFileCacheKey('file-123');
```

## Error Handling

All operations may throw `CacheError` with specific error types:

- `QUOTA_EXCEEDED` - Storage quota exceeded
- `DB_ERROR` - Database operation failed
- `NETWORK_ERROR` - Network request failed
- `INVALID_DATA` - Invalid data format

```typescript
import { CacheError, CacheErrorType } from '@/lib/cache';

try {
  await fileCache.put(entry);
} catch (error) {
  if (error instanceof CacheError) {
    if (error.type === CacheErrorType.QUOTA_EXCEEDED) {
      // Handle quota exceeded
      console.error('Storage full, need to cleanup');
    }
  }
}
```

## CacheManager Features

- **Singleton Pattern**: Ensures global cache coordination
- **Automatic Space Management**: LRU cleanup when approaching quota
- **Offline File Protection**: Preserves user-marked offline files during cleanup
- **Version Control**: ETag-based cache validation
- **Statistics Tracking**: Hit/miss rates and traffic savings
- **Type-based Management**: Separate handling for images, videos, documents
- **Error Recovery**: Automatic retry with cleanup on quota exceeded

## Requirements Covered

This implementation satisfies the following requirements:

- **1.1** - Files are downloaded from S3 and stored in IndexedDB on first access
- **1.2** - Files are read from IndexedDB on subsequent access
- **1.3** - Each cached file records ID, S3 key, cache time, and file size
- **1.4** - IndexedDB cache limited to 500MB maximum
- **1.5** - LRU cleanup when storage space insufficient
- **2.1-2.5** - Video frame caching with unique keys
- **5.1-5.3** - Cache version validation with ETag
- **6.1-6.3** - Cache statistics tracking
- **10.1-10.5** - Space management and cleanup strategies
