// LockCloud Service Worker
// 用于拦截和缓存 S3 资源请求

const CACHE_NAME = 'lockcloud-v1';
const S3_CACHE_NAME = 'lockcloud-s3-v1';

// 缓存策略配置
const CACHE_STRATEGIES = {
  image: {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    maxSize: 5 * 1024 * 1024,          // 5MB per file
  },
  video: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxSize: 50 * 1024 * 1024,         // 50MB per file
  },
  document: {
    maxAge: 3 * 24 * 60 * 60 * 1000,  // 3 days
    maxSize: 10 * 1024 * 1024,         // 10MB per file
  },
  default: {
    maxAge: 1 * 24 * 60 * 60 * 1000,  // 1 day
    maxSize: 10 * 1024 * 1024,         // 10MB per file
  },
};

// S3 域名配置
const S3_HOSTNAMES = [
  's3.bitiful.net',
  'funkandlove-cloud.s3.bitiful.net',
  'funkandlove-main.s3.bitiful.net',
];

// Install 事件 - Service Worker 安装时触发
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cache opened');
      // 预缓存关键资源（如果需要）
      return cache.addAll([
        // 可以在这里添加需要预缓存的静态资源
      ]);
    }).then(() => {
      // 强制激活新的 Service Worker
      return self.skipWaiting();
    })
  );
});

// Activate 事件 - Service Worker 激活时触发
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME && cacheName !== S3_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有客户端
      return self.clients.claim();
    })
  );
});


// 辅助函数：检查是否为 S3 请求
function isS3Request(url) {
  try {
    const urlObj = new URL(url);
    return S3_HOSTNAMES.some(hostname => urlObj.hostname.includes(hostname));
  } catch {
    return false;
  }
}

// 辅助函数：根据 URL 获取文件类型
function getFileType(url) {
  const urlLower = url.toLowerCase();
  
  // 图片类型
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)(\?|$)/i)) {
    return 'image';
  }
  
  // 视频类型
  if (urlLower.match(/\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i)) {
    return 'video';
  }
  
  // 文档类型
  if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/i)) {
    return 'document';
  }
  
  return 'default';
}

// 辅助函数：获取缓存策略
function getCacheStrategy(url) {
  const fileType = getFileType(url);
  return CACHE_STRATEGIES[fileType] || CACHE_STRATEGIES.default;
}

// 辅助函数：检查响应大小是否符合缓存策略
function shouldCacheBySize(response, strategy) {
  const contentLength = response.headers.get('content-length');
  if (!contentLength) return true; // 如果没有 content-length，允许缓存
  
  const size = parseInt(contentLength, 10);
  return size <= strategy.maxSize;
}

// 辅助函数：检查响应是否应该被缓存
function shouldCache(request, response, strategy) {
  // 只缓存成功的 GET 请求
  if (request.method !== 'GET' || !response.ok) {
    return false;
  }
  
  // 检查文件大小
  if (!shouldCacheBySize(response, strategy)) {
    console.log('[Service Worker] File too large to cache:', request.url);
    return false;
  }
  
  return true;
}

// Cache-First 策略：优先使用缓存
async function cacheFirstStrategy(request) {
  const cache = await caches.open(S3_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('[Service Worker] Cache hit:', request.url);
    return cachedResponse;
  }
  
  console.log('[Service Worker] Cache miss, fetching from network:', request.url);
  
  try {
    const response = await fetch(request);
    const strategy = getCacheStrategy(request.url);
    
    // 缓存响应（如果符合条件）
    if (shouldCache(request, response, strategy)) {
      cache.put(request, response.clone());
      console.log('[Service Worker] Cached response:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // 网络失败，尝试返回过期的缓存
    const staleCache = await cache.match(request);
    if (staleCache) {
      console.log('[Service Worker] Returning stale cache:', request.url);
      return staleCache;
    }
    
    throw error;
  }
}

// Network-First 策略：优先使用网络
async function networkFirstStrategy(request) {
  const cache = await caches.open(S3_CACHE_NAME);
  
  try {
    const response = await fetch(request);
    const strategy = getCacheStrategy(request.url);
    
    // 缓存响应（如果符合条件）
    if (shouldCache(request, response, strategy)) {
      cache.put(request, response.clone());
      console.log('[Service Worker] Cached response:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Network failed, trying cache:', error);
    
    // 网络失败，返回缓存
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Returning cached response:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// 辅助函数：选择缓存策略
function selectCacheStrategy(url) {
  const fileType = getFileType(url);
  
  // 图片和视频使用 Cache-First（优先缓存）
  if (fileType === 'image' || fileType === 'video') {
    return cacheFirstStrategy;
  }
  
  // 文档使用 Network-First（优先网络）
  return networkFirstStrategy;
}

// Fetch 事件 - 拦截所有网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 只拦截 S3 请求
  if (!isS3Request(request.url)) {
    return;
  }
  
  console.log('[Service Worker] Intercepting S3 request:', request.url);
  
  // 选择并应用缓存策略
  const strategy = selectCacheStrategy(request.url);
  event.respondWith(strategy(request));
});

// 辅助函数：检查缓存是否过期
function isCacheExpired(response, strategy) {
  const cachedTime = response.headers.get('sw-cached-time');
  if (!cachedTime) return false;
  
  const age = Date.now() - parseInt(cachedTime, 10);
  return age > strategy.maxAge;
}

// 辅助函数：为响应添加缓存时间戳
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// 改进的 Cache-First 策略（带过期检查）
async function cacheFirstStrategyWithExpiration(request) {
  const cache = await caches.open(S3_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const strategy = getCacheStrategy(request.url);
  
  if (cachedResponse) {
    // 检查缓存是否过期
    if (!isCacheExpired(cachedResponse, strategy)) {
      console.log('[Service Worker] Cache hit (valid):', request.url);
      return cachedResponse;
    } else {
      console.log('[Service Worker] Cache expired, fetching fresh:', request.url);
      // 缓存过期，删除旧缓存
      await cache.delete(request);
    }
  }
  
  console.log('[Service Worker] Cache miss, fetching from network:', request.url);
  
  try {
    const response = await fetch(request);
    
    // 缓存响应（如果符合条件）
    if (shouldCache(request, response, strategy)) {
      const responseWithTimestamp = addCacheTimestamp(response.clone());
      cache.put(request, responseWithTimestamp);
      console.log('[Service Worker] Cached response:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // 网络失败，返回过期的缓存（如果存在）
    if (cachedResponse) {
      console.log('[Service Worker] Returning expired cache (offline):', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// 改进的 Network-First 策略（带缓存时间戳）
async function networkFirstStrategyWithExpiration(request) {
  const cache = await caches.open(S3_CACHE_NAME);
  const strategy = getCacheStrategy(request.url);
  
  try {
    const response = await fetch(request);
    
    // 缓存响应（如果符合条件）
    if (shouldCache(request, response, strategy)) {
      const responseWithTimestamp = addCacheTimestamp(response.clone());
      cache.put(request, responseWithTimestamp);
      console.log('[Service Worker] Cached response:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Network failed, trying cache:', error);
    
    // 网络失败，返回缓存（即使过期）
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Returning cached response (offline):', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// 缓存清理函数
async function cleanupCache() {
  console.log('[Service Worker] Starting cache cleanup...');
  
  const cache = await caches.open(S3_CACHE_NAME);
  const requests = await cache.keys();
  
  let deletedCount = 0;
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    
    const strategy = getCacheStrategy(request.url);
    
    // 检查是否过期
    if (isCacheExpired(response, strategy)) {
      await cache.delete(request);
      deletedCount++;
      console.log('[Service Worker] Deleted expired cache:', request.url);
      continue;
    }
    
    // 统计缓存大小
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      totalSize += parseInt(contentLength, 10);
    }
  }
  
  console.log(`[Service Worker] Cleanup complete. Deleted ${deletedCount} expired entries.`);
  console.log(`[Service Worker] Total cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  // 如果缓存总大小超过限制（100MB），删除最旧的条目
  const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  if (totalSize > MAX_CACHE_SIZE) {
    await cleanupOldestEntries(cache, totalSize - MAX_CACHE_SIZE);
  }
}

// 删除最旧的缓存条目
async function cleanupOldestEntries(cache, targetSize) {
  console.log(`[Service Worker] Cache size exceeded, removing ${(targetSize / 1024 / 1024).toFixed(2)} MB...`);
  
  const requests = await cache.keys();
  const entries = [];
  
  // 收集所有缓存条目及其时间戳
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    
    const cachedTime = response.headers.get('sw-cached-time');
    const contentLength = response.headers.get('content-length');
    
    entries.push({
      request,
      cachedTime: cachedTime ? parseInt(cachedTime, 10) : 0,
      size: contentLength ? parseInt(contentLength, 10) : 0,
    });
  }
  
  // 按时间排序（最旧的在前）
  entries.sort((a, b) => a.cachedTime - b.cachedTime);
  
  // 删除最旧的条目直到达到目标大小
  let freedSize = 0;
  for (const entry of entries) {
    if (freedSize >= targetSize) break;
    
    await cache.delete(entry.request);
    freedSize += entry.size;
    console.log('[Service Worker] Deleted old cache:', entry.request.url);
  }
  
  console.log(`[Service Worker] Freed ${(freedSize / 1024 / 1024).toFixed(2)} MB`);
}

// 定期清理缓存（每小时）
setInterval(() => {
  cleanupCache();
}, 60 * 60 * 1000);

// 监听消息事件（用于手动触发清理）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEANUP_CACHE') {
    console.log('[Service Worker] Manual cleanup triggered');
    event.waitUntil(cleanupCache());
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skip waiting triggered');
    self.skipWaiting();
  }
});

// 更新 fetch 事件处理器以使用带过期检查的策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 只拦截 S3 请求
  if (!isS3Request(request.url)) {
    return;
  }
  
  console.log('[Service Worker] Intercepting S3 request:', request.url);
  
  // 选择并应用缓存策略（带过期检查）
  const fileType = getFileType(request.url);
  const strategy = (fileType === 'image' || fileType === 'video')
    ? cacheFirstStrategyWithExpiration
    : networkFirstStrategyWithExpiration;
  
  event.respondWith(strategy(request));
});
