/**
 * useIntelligentPreload Hook
 * 
 * Implements intelligent preloading using Intersection Observer API
 * to detect when files enter the viewport and trigger preloading.
 * 
 * Features:
 * - Intersection Observer for viewport detection
 * - Preload queue management with concurrency limits
 * - Network-aware preloading (disabled on slow connections)
 * - Automatic cleanup on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { File } from '@/types';
import { useCacheStore } from '@/stores/cacheStore';

/**
 * Network connection type detection
 */
type NetworkType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

/**
 * Check if network is slow
 */
function isSlowNetwork(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: NetworkType;
      saveData?: boolean;
    };
  }).connection;

  if (!connection) {
    return false;
  }

  // Disable preload on slow networks or data saver mode
  const slowTypes: NetworkType[] = ['2g', 'slow-2g'];
  const effectiveType = connection.effectiveType || 'unknown';
  
  return slowTypes.includes(effectiveType) || connection.saveData === true;
}

/**
 * Preload queue item
 */
interface PreloadItem {
  fileId: number;
  s3Key: string;
  publicUrl: string;
  contentType: string;
  priority: number;
}

/**
 * Hook options
 */
interface UseIntelligentPreloadOptions {
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
  maxConcurrent?: number;
}

/**
 * Hook return value
 */
interface UseIntelligentPreloadReturn {
  observeElement: (element: HTMLElement | null, file: File) => void;
  unobserveElement: (element: HTMLElement | null) => void;
  isPreloading: boolean;
  preloadQueue: number[];
}

/**
 * useIntelligentPreload Hook
 * 
 * @param files - Array of files to potentially preload
 * @param options - Configuration options
 * @returns Hook utilities and state
 */
export function useIntelligentPreload(
  files: File[],
  options: UseIntelligentPreloadOptions = {}
): UseIntelligentPreloadReturn {
  const {
    enabled = true,
    rootMargin = '200px',
    threshold = 0.1,
    maxConcurrent = 3,
  } = options;

  const cacheStore = useCacheStore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [preloadQueue, setPreloadQueue] = useState<PreloadItem[]>([]);
  const [activePreloads, setActivePreloads] = useState<Set<number>>(new Set());
  const fileMapRef = useRef<Map<HTMLElement, File>>(new Map());

  /**
   * Check if file should be preloaded
   */
  const shouldPreload = useCallback((file: File): boolean => {
    // Don't preload if disabled
    if (!enabled) return false;

    // Don't preload on slow networks
    if (isSlowNetwork()) return false;

    // Don't preload if already in queue or being preloaded
    if (activePreloads.has(file.id)) return false;
    if (preloadQueue.some(item => item.fileId === file.id)) return false;

    // Only preload images and video thumbnails
    const isImage = file.content_type.startsWith('image/');
    const isVideo = file.content_type.startsWith('video/');
    
    return isImage || isVideo;
  }, [enabled, preloadQueue, activePreloads]);

  /**
   * Add file to preload queue
   */
  const addToQueue = useCallback((file: File, priority: number = 0) => {
    if (!shouldPreload(file)) return;

    const item: PreloadItem = {
      fileId: file.id,
      s3Key: file.s3_key,
      publicUrl: file.public_url,
      contentType: file.content_type,
      priority,
    };

    setPreloadQueue(prev => {
      // Check if already in queue
      if (prev.some(p => p.fileId === file.id)) return prev;
      
      // Add and sort by priority (higher priority first)
      return [...prev, item].sort((a, b) => b.priority - a.priority);
    });
  }, [shouldPreload]);

  /**
   * Preload a single file
   */
  const preloadFile = useCallback(async (item: PreloadItem): Promise<void> => {
    try {
      // Mark as active
      setActivePreloads(prev => new Set(prev).add(item.fileId));

      // Check if already cached
      const cached = await cacheStore.getFile(item.fileId.toString(), item.s3Key);
      if (cached) {
        // Already cached, no need to fetch
        return;
      }

      // Fetch the file
      let url = item.publicUrl;
      
      // For videos, fetch the first frame as thumbnail
      if (item.contentType.startsWith('video/')) {
        url = `${item.publicUrl}?frame=0&w=800&cs=srgb`;
      }
      
      // For images, fetch optimized version
      if (item.contentType.startsWith('image/')) {
        // Add image optimization parameters if not already present
        if (!url.includes('?')) {
          url = `${url}?w=800&q=80`;
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Cache the file
      await cacheStore.cacheFile(item.fileId.toString(), item.s3Key, blob);
    } catch (error) {
      console.error(`Failed to preload file ${item.fileId}:`, error);
    } finally {
      // Remove from active preloads
      setActivePreloads(prev => {
        const next = new Set(prev);
        next.delete(item.fileId);
        return next;
      });
    }
  }, [cacheStore]);

  /**
   * Process preload queue
   */
  useEffect(() => {
    if (preloadQueue.length === 0) return;
    if (activePreloads.size >= maxConcurrent) return;

    // Process next items in queue
    const itemsToProcess = preloadQueue.slice(0, maxConcurrent - activePreloads.size);
    
    // Remove processed items from queue
    setPreloadQueue(prev => prev.slice(itemsToProcess.length));

    // Start preloading
    itemsToProcess.forEach(item => {
      preloadFile(item);
    });
  }, [preloadQueue, activePreloads, maxConcurrent, preloadFile]);

  /**
   * Intersection Observer callback
   */
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const file = fileMapRef.current.get(entry.target as HTMLElement);
        if (file) {
          // High priority for visible items
          addToQueue(file, 10);
        }
      }
    });
  }, [addToQueue]);

  /**
   * Initialize Intersection Observer
   */
  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold,
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [enabled, rootMargin, threshold, handleIntersection]);

  /**
   * Observe element
   */
  const observeElement = useCallback((element: HTMLElement | null, file: File) => {
    if (!element || !observerRef.current) return;

    fileMapRef.current.set(element, file);
    observerRef.current.observe(element);
  }, []);

  /**
   * Unobserve element
   */
  const unobserveElement = useCallback((element: HTMLElement | null) => {
    if (!element || !observerRef.current) return;

    fileMapRef.current.delete(element);
    observerRef.current.unobserve(element);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    const fileMap = fileMapRef.current;
    return () => {
      fileMap.clear();
    };
  }, []);

  return {
    observeElement,
    unobserveElement,
    isPreloading: activePreloads.size > 0,
    preloadQueue: preloadQueue.map(item => item.fileId),
  };
}
