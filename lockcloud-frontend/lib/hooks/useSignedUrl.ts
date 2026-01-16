/**
 * useSignedUrl - 签名 URL 管理 Hook
 * 
 * 用于获取和缓存私有桶文件的签名访问 URL
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSignedUrl, getSignedUrlsBatch, StylePreset } from '@/lib/api/files';

// URL 缓存（内存缓存，页面刷新后失效）
const urlCache = new Map<string, { url: string; expiresAt: number }>();

// 缓存 key 生成
const getCacheKey = (fileId: number, style?: StylePreset) => 
  `${fileId}:${style || 'original'}`;

// 检查缓存是否有效（提前 5 分钟过期，避免使用时刚好过期）
const isCacheValid = (expiresAt: number) => 
  Date.now() < expiresAt - 5 * 60 * 1000;

/**
 * 获取单个文件的签名 URL
 */
export function useSignedUrl(
  fileId: number | undefined,
  style?: StylePreset,
  enabled: boolean = true
) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUrl = useCallback(async () => {
    if (!fileId || !enabled) return;

    const cacheKey = getCacheKey(fileId, style);
    const cached = urlCache.get(cacheKey);
    
    // 使用缓存
    if (cached && isCacheValid(cached.expiresAt)) {
      setUrl(cached.url);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSignedUrl(fileId, style);
      const expiresAt = Date.now() + result.expires_in * 1000;
      
      // 更新缓存
      urlCache.set(cacheKey, { url: result.signed_url, expiresAt });
      setUrl(result.signed_url);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取签名 URL 失败'));
    } finally {
      setIsLoading(false);
    }
  }, [fileId, style, enabled]);

  useEffect(() => {
    fetchUrl();
  }, [fetchUrl]);

  return { url, isLoading, error, refetch: fetchUrl };
}

/**
 * 批量获取签名 URL
 */
export function useSignedUrlsBatch(
  fileIds: number[],
  style?: StylePreset,
  enabled: boolean = true
) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const prevFileIdsRef = useRef<string>('');

  const fetchUrls = useCallback(async () => {
    if (!fileIds.length || !enabled) return;

    // 检查哪些需要获取
    const needFetch: number[] = [];
    const cachedUrls: Record<number, string> = {};

    for (const fileId of fileIds) {
      const cacheKey = getCacheKey(fileId, style);
      const cached = urlCache.get(cacheKey);
      
      if (cached && isCacheValid(cached.expiresAt)) {
        cachedUrls[fileId] = cached.url;
      } else {
        needFetch.push(fileId);
      }
    }

    // 如果全部命中缓存
    if (needFetch.length === 0) {
      setUrls(cachedUrls);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSignedUrlsBatch(needFetch, style);
      const expiresAt = Date.now() + result.expires_in * 1000;
      
      // 更新缓存和结果
      const newUrls: Record<number, string> = { ...cachedUrls };
      for (const [fileIdStr, data] of Object.entries(result.urls)) {
        const fileId = parseInt(fileIdStr);
        const cacheKey = getCacheKey(fileId, style);
        urlCache.set(cacheKey, { url: data.signed_url, expiresAt });
        newUrls[fileId] = data.signed_url;
      }
      
      setUrls(newUrls);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('批量获取签名 URL 失败'));
    } finally {
      setIsLoading(false);
    }
  }, [fileIds, style, enabled]);

  useEffect(() => {
    // 只在 fileIds 实际变化时触发
    const fileIdsKey = fileIds.join(',');
    if (fileIdsKey !== prevFileIdsRef.current) {
      prevFileIdsRef.current = fileIdsKey;
      fetchUrls();
    }
  }, [fileIds, fetchUrls]);

  return { urls, isLoading, error, refetch: fetchUrls };
}

/**
 * 预取签名 URL（不返回状态，仅填充缓存）
 */
export async function prefetchSignedUrls(
  fileIds: number[],
  style?: StylePreset
): Promise<void> {
  // 过滤出需要获取的
  const needFetch = fileIds.filter(fileId => {
    const cacheKey = getCacheKey(fileId, style);
    const cached = urlCache.get(cacheKey);
    return !cached || !isCacheValid(cached.expiresAt);
  });

  if (needFetch.length === 0) return;

  try {
    const result = await getSignedUrlsBatch(needFetch, style);
    const expiresAt = Date.now() + result.expires_in * 1000;
    
    for (const [fileIdStr, data] of Object.entries(result.urls)) {
      const fileId = parseInt(fileIdStr);
      const cacheKey = getCacheKey(fileId, style);
      urlCache.set(cacheKey, { url: data.signed_url, expiresAt });
    }
  } catch (err) {
    console.warn('预取签名 URL 失败:', err);
  }
}

/**
 * 清除缓存
 */
export function clearSignedUrlCache(fileId?: number, style?: StylePreset) {
  if (fileId) {
    const cacheKey = getCacheKey(fileId, style);
    urlCache.delete(cacheKey);
  } else {
    urlCache.clear();
  }
}

/**
 * 同步获取缓存的 URL（如果有）
 */
export function getCachedSignedUrl(fileId: number, style?: StylePreset): string | null {
  const cacheKey = getCacheKey(fileId, style);
  const cached = urlCache.get(cacheKey);
  
  if (cached && isCacheValid(cached.expiresAt)) {
    return cached.url;
  }
  
  return null;
}
