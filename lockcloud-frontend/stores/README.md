# Zustand Stores

This directory contains Zustand stores for global state management.

## Available Stores

### authStore.ts
Manages authentication state including user information, tokens, and login/logout operations.

### fileStore.ts
Manages file-related state including file lists, current directory, and file operations.

### cacheStore.ts
Manages cache system state and operations for IndexedDB-based file caching.

## Cache Store

The cache store provides a centralized interface for managing the browser-based cache system.

### Features

- **File Caching**: Cache files in IndexedDB for offline access and reduced S3 traffic
- **Video Frame Caching**: Cache video preview frames separately
- **Statistics Tracking**: Track cache hits, misses, and saved traffic
- **Space Management**: Monitor and manage storage space usage
- **Type-based Clearing**: Clear cache by file type (image, video, document)

### Usage

```typescript
import { useCacheStore } from '@/stores/cacheStore';

// Initialize cache on app startup
const initialize = useCacheStore((state) => state.initialize);
useEffect(() => {
  initialize();
}, []);

// Get file from cache
const getFile = useCacheStore((state) => state.getFile);
const blob = await getFile(fileId, s3Key);

// Cache a file
const cacheFile = useCacheStore((state) => state.cacheFile);
await cacheFile(fileId, s3Key, blob, version);

// Get statistics
const stats = useCacheStore((state) => state.stats);
console.log(`Cache hit rate: ${stats.hitCount / (stats.hitCount + stats.missCount)}`);

// Clear cache
const clearCache = useCacheStore((state) => state.clearCache);
await clearCache();
```

### State

- `stats`: Cache statistics (hits, misses, size, etc.)
- `isInitialized`: Whether the cache system is initialized
- `isPreloading`: Whether files are being preloaded
- `error`: Last error message (if any)

### Operations

- `initialize()`: Initialize the cache system
- `getFile(fileId, s3Key)`: Get file from cache
- `cacheFile(fileId, s3Key, blob, version?)`: Cache a file
- `deleteFile(fileId)`: Delete file from cache
- `preloadFile(fileId, s3Key)`: Preload file into cache
- `getVideoFrame(s3Key, frameIndex)`: Get video frame from cache
- `cacheVideoFrame(s3Key, frameIndex, blob, width?, height?)`: Cache video frame
- `updateStats()`: Update cache statistics
- `recordHit(size)`: Record cache hit
- `recordMiss()`: Record cache miss
- `clearCache()`: Clear all cache
- `clearCacheByType(type)`: Clear cache by file type
- `checkSpace()`: Check storage space usage

### Integration with CacheManager

The cache store integrates with the CacheManager singleton to provide:
- Async operation handling
- Error management
- State synchronization
- Statistics updates

All cache operations are performed through the CacheManager, ensuring consistent behavior across the application.
