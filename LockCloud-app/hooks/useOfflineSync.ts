/**
 * useOfflineSync - Hook for managing offline data synchronization
 * 
 * Integrates offline caching with TanStack Query for seamless offline/online transitions.
 * Automatically caches file lists and syncs pending operations when connectivity is restored.
 * 
 * Requirements: 11.1 - THE Mobile_App SHALL cache file list responses locally
 * Requirements: 11.4 - WHEN connectivity is restored, THE Mobile_App SHALL sync pending operations
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useIsOffline } from './useNetworkStatus';
import {
  cacheFileList,
  getCachedFileList,
  queueOperation,
  processPendingOperations,
  getSyncStatus,
  subscribeToNetworkChanges,
  PendingOperation,
  OfflineOperationType,
  SyncStatus,
} from '@/lib/storage/offlineSync';
import {
  deleteFile,
  updateFile,
  batchDelete,
  batchUpdate,
  batchAddTag,
  batchRemoveTag,
} from '@/lib/api/files';
import { FileFilters, FileListResponse } from '@/types';
import { t } from '@/locales';

/**
 * Hook for managing offline file list caching
 * 
 * @param filters - Current file filters
 * @returns Object with cache functions and offline data
 */
export function useOfflineFileList(filters?: FileFilters) {
  const isOffline = useIsOffline();
  const [cachedData, setCachedData] = useState<FileListResponse | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);

  // Load cached data when offline
  useEffect(() => {
    if (isOffline) {
      setIsLoadingCache(true);
      getCachedFileList(filters)
        .then(setCachedData)
        .finally(() => setIsLoadingCache(false));
    } else {
      setCachedData(null);
    }
  }, [isOffline, filters]);

  /**
   * Cache a file list response
   */
  const cacheResponse = useCallback(
    async (response: FileListResponse) => {
      await cacheFileList(filters, response);
    },
    [filters]
  );

  return {
    isOffline,
    cachedData,
    isLoadingCache,
    cacheResponse,
    hasCachedData: cachedData !== null,
  };
}

/**
 * Execute a single pending operation
 * This function should be customized based on your API
 */
async function executeOperation(operation: PendingOperation): Promise<boolean> {
  try {
    switch (operation.type) {
      case 'delete_file': {
        const { fileId } = operation.payload as { fileId: number };
        await deleteFile(fileId);
        return true;
      }
      
      case 'update_file': {
        const { fileId, data } = operation.payload as {
          fileId: number;
          data: Record<string, unknown>;
        };
        await updateFile(fileId, data);
        return true;
      }
      
      case 'add_tag': {
        const { fileIds, tagName } = operation.payload as {
          fileIds: number[];
          tagName: string;
        };
        await batchAddTag(fileIds, tagName);
        return true;
      }
      
      case 'remove_tag': {
        const { fileIds, tagId } = operation.payload as {
          fileIds: number[];
          tagId: number;
        };
        await batchRemoveTag(fileIds, tagId);
        return true;
      }
      
      case 'batch_delete': {
        const { fileIds } = operation.payload as { fileIds: number[] };
        await batchDelete(fileIds);
        return true;
      }
      
      case 'batch_update': {
        const { fileIds, updates } = operation.payload as {
          fileIds: number[];
          updates: Record<string, unknown>;
        };
        await batchUpdate(fileIds, updates);
        return true;
      }
      
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
        return false;
    }
  } catch (error) {
    console.error(`Failed to execute operation ${operation.type}:`, error);
    return false;
  }
}

/**
 * Hook for managing pending operations and sync
 * 
 * @returns Object with sync functions and status
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const isOffline = useIsOffline();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(isOffline);
  const isSyncingRef = useRef(false);

  // Load sync status on mount
  useEffect(() => {
    getSyncStatus().then(setSyncStatus);
  }, []);

  /**
   * Execute pending operations - defined before useEffect that uses it
   */
  const doSync = useCallback(async () => {
    if (isSyncingRef.current) return { succeeded: 0, failed: 0 };
    
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await processPendingOperations(executeOperation);
      const status = await getSyncStatus();
      setSyncStatus(status);
      return result;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Listen for network changes and trigger sync when coming back online
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(async (isOnline) => {
      if (isOnline && wasOfflineRef.current) {
        // Just came back online, trigger sync
        await doSync();
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['files'] });
        
        // Show notification
        Alert.alert(
          t('empty.backOnline'),
          t('empty.offlineCached'),
          [{ text: t('common.ok') }]
        );
      }
      wasOfflineRef.current = !isOnline;
    });

    return unsubscribe;
  }, [queryClient, doSync]);

  /**
   * Queue an operation for later sync
   */
  const queueOfflineOperation = useCallback(
    async (type: OfflineOperationType, payload: Record<string, unknown>) => {
      const operationId = await queueOperation(type, payload);
      const status = await getSyncStatus();
      setSyncStatus(status);
      return operationId;
    },
    []
  );

  /**
   * Refresh sync status
   */
  const refreshStatus = useCallback(async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
    return status;
  }, []);

  return {
    isOffline,
    syncStatus,
    isSyncing,
    queueOfflineOperation,
    syncPendingOperations: doSync,
    refreshStatus,
    hasPendingOperations: (syncStatus?.pendingOperationsCount ?? 0) > 0,
  };
}

/**
 * Hook that provides offline-aware data fetching
 * Returns cached data when offline, fresh data when online
 * 
 * @param fetchFn - Function to fetch fresh data
 * @param filters - File filters for cache key
 */
export function useOfflineAwareQuery<T extends FileListResponse>(
  fetchFn: () => Promise<T>,
  filters?: FileFilters
) {
  const { isOffline, cachedData, cacheResponse } = useOfflineFileList(filters);

  /**
   * Fetch with caching
   */
  const fetchWithCache = useCallback(async (): Promise<T> => {
    if (isOffline && cachedData) {
      return cachedData as T;
    }
    
    const data = await fetchFn();
    
    // Cache the response for offline use
    await cacheResponse(data);
    
    return data;
  }, [isOffline, cachedData, fetchFn, cacheResponse]);

  return {
    fetchWithCache,
    isOffline,
    cachedData,
  };
}

export default useOfflineSync;
