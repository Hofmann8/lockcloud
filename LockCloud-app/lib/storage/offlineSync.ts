/**
 * Offline Sync Service
 * 
 * Handles caching of file lists and synchronization when connectivity is restored.
 * Integrates with TanStack Query for seamless offline/online transitions.
 * 
 * Requirements: 11.1 - THE Mobile_App SHALL cache file list responses locally
 * Requirements: 11.4 - WHEN connectivity is restored, THE Mobile_App SHALL sync pending operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { FileFilters, FileListResponse } from '@/types';
import * as cacheStore from './cacheStore';

// Storage keys for offline sync
const OFFLINE_KEYS = {
  PENDING_OPERATIONS: 'offline_pending_operations',
  LAST_SYNC_TIME: 'offline_last_sync_time',
  CACHED_FILE_LISTS: 'offline_cached_file_lists_index',
} as const;

/**
 * Types of operations that can be queued for offline sync
 */
export type OfflineOperationType = 
  | 'delete_file'
  | 'update_file'
  | 'add_tag'
  | 'remove_tag'
  | 'batch_delete'
  | 'batch_update';

/**
 * Pending operation structure
 */
export interface PendingOperation {
  id: string;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

/**
 * Sync status information
 */
export interface SyncStatus {
  lastSyncTime: number | null;
  pendingOperationsCount: number;
  isOnline: boolean;
}

// ============================================================
// File List Caching
// ============================================================

/**
 * Generate a unique cache key from file filters
 * @param filters - File filters
 * @returns Cache key string
 */
export function generateFilterKey(filters?: FileFilters): string {
  if (!filters) return 'default';
  
  const parts: string[] = [];
  
  if (filters.media_type) parts.push(`mt:${filters.media_type}`);
  if (filters.year) parts.push(`y:${filters.year}`);
  if (filters.month) parts.push(`m:${filters.month}`);
  if (filters.tags && filters.tags.length > 0) {
    parts.push(`t:${filters.tags.sort().join(',')}`);
  }
  if (filters.activity_type) parts.push(`at:${filters.activity_type}`);
  if (filters.activity_name) parts.push(`an:${filters.activity_name}`);
  if (filters.search) parts.push(`s:${filters.search}`);
  if (filters.page) parts.push(`p:${filters.page}`);
  if (filters.per_page) parts.push(`pp:${filters.per_page}`);
  if (filters.uploader_id) parts.push(`u:${filters.uploader_id}`);
  if (filters.date_from) parts.push(`df:${filters.date_from}`);
  if (filters.date_to) parts.push(`dt:${filters.date_to}`);
  
  return parts.length > 0 ? parts.join('_') : 'default';
}

/**
 * Cache a file list response
 * @param filters - Filters used to fetch the list
 * @param response - File list response to cache
 */
export async function cacheFileList(
  filters: FileFilters | undefined,
  response: FileListResponse
): Promise<void> {
  const filterKey = generateFilterKey(filters);
  await cacheStore.setFileList(filterKey, response);
  
  // Update the index of cached file lists
  await updateCachedFileListsIndex(filterKey);
}

/**
 * Get cached file list
 * @param filters - Filters to look up
 * @returns Cached file list or null
 */
export async function getCachedFileList(
  filters?: FileFilters
): Promise<FileListResponse | null> {
  const filterKey = generateFilterKey(filters);
  return cacheStore.getFileList<FileListResponse>(filterKey);
}

/**
 * Update the index of cached file lists
 * @param filterKey - Key to add to the index
 */
async function updateCachedFileListsIndex(filterKey: string): Promise<void> {
  try {
    const indexJson = await AsyncStorage.getItem(OFFLINE_KEYS.CACHED_FILE_LISTS);
    const index: string[] = indexJson ? JSON.parse(indexJson) : [];
    
    if (!index.includes(filterKey)) {
      index.push(filterKey);
      await AsyncStorage.setItem(OFFLINE_KEYS.CACHED_FILE_LISTS, JSON.stringify(index));
    }
  } catch (error) {
    console.warn('Failed to update cached file lists index:', error);
  }
}

/**
 * Clear all cached file lists
 */
export async function clearCachedFileLists(): Promise<void> {
  await cacheStore.clearByPrefix(cacheStore.CACHE_KEYS.FILE_LIST);
  await AsyncStorage.removeItem(OFFLINE_KEYS.CACHED_FILE_LISTS);
}

// ============================================================
// Pending Operations Queue
// ============================================================

/**
 * Add an operation to the pending queue
 * @param type - Operation type
 * @param payload - Operation payload
 */
export async function queueOperation(
  type: OfflineOperationType,
  payload: Record<string, unknown>
): Promise<string> {
  const operation: PendingOperation = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };
  
  const operations = await getPendingOperations();
  operations.push(operation);
  await savePendingOperations(operations);
  
  return operation.id;
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  try {
    const json = await AsyncStorage.getItem(OFFLINE_KEYS.PENDING_OPERATIONS);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.warn('Failed to get pending operations:', error);
    return [];
  }
}

/**
 * Save pending operations to storage
 */
async function savePendingOperations(operations: PendingOperation[]): Promise<void> {
  await AsyncStorage.setItem(
    OFFLINE_KEYS.PENDING_OPERATIONS,
    JSON.stringify(operations)
  );
}

/**
 * Remove a pending operation by ID
 */
export async function removePendingOperation(operationId: string): Promise<void> {
  const operations = await getPendingOperations();
  const filtered = operations.filter(op => op.id !== operationId);
  await savePendingOperations(filtered);
}

/**
 * Clear all pending operations
 */
export async function clearPendingOperations(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_KEYS.PENDING_OPERATIONS);
}

/**
 * Increment retry count for an operation
 */
export async function incrementRetryCount(operationId: string): Promise<void> {
  const operations = await getPendingOperations();
  const operation = operations.find(op => op.id === operationId);
  if (operation) {
    operation.retryCount += 1;
    await savePendingOperations(operations);
  }
}

// ============================================================
// Sync Status
// ============================================================

/**
 * Get the last sync time
 */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const time = await AsyncStorage.getItem(OFFLINE_KEYS.LAST_SYNC_TIME);
    return time ? parseInt(time, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Update the last sync time to now
 */
export async function updateLastSyncTime(): Promise<void> {
  await AsyncStorage.setItem(
    OFFLINE_KEYS.LAST_SYNC_TIME,
    Date.now().toString()
  );
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const [lastSyncTime, operations, netState] = await Promise.all([
    getLastSyncTime(),
    getPendingOperations(),
    NetInfo.fetch(),
  ]);
  
  return {
    lastSyncTime,
    pendingOperationsCount: operations.length,
    isOnline: netState.isConnected ?? false,
  };
}

// ============================================================
// Sync Execution
// ============================================================

/**
 * Callback type for executing a pending operation
 */
export type OperationExecutor = (
  operation: PendingOperation
) => Promise<boolean>;

/**
 * Process all pending operations
 * @param executor - Function to execute each operation
 * @returns Number of successfully processed operations
 */
export async function processPendingOperations(
  executor: OperationExecutor
): Promise<{ succeeded: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { succeeded: 0, failed: 0 };
  }
  
  const operations = await getPendingOperations();
  let succeeded = 0;
  let failed = 0;
  
  for (const operation of operations) {
    try {
      const success = await executor(operation);
      if (success) {
        await removePendingOperation(operation.id);
        succeeded++;
      } else {
        await incrementRetryCount(operation.id);
        failed++;
      }
    } catch (error) {
      console.warn(`Failed to process operation ${operation.id}:`, error);
      await incrementRetryCount(operation.id);
      failed++;
    }
  }
  
  if (succeeded > 0) {
    await updateLastSyncTime();
  }
  
  return { succeeded, failed };
}

// ============================================================
// Network Change Listener
// ============================================================

/**
 * Callback type for network status changes
 */
export type NetworkChangeCallback = (isOnline: boolean) => void;

/**
 * Subscribe to network status changes
 * @param callback - Function to call when network status changes
 * @returns Unsubscribe function
 */
export function subscribeToNetworkChanges(
  callback: NetworkChangeCallback
): () => void {
  let wasOnline: boolean | null = null;
  
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected ?? false;
    
    // Only call callback when status actually changes
    if (wasOnline !== null && wasOnline !== isOnline) {
      callback(isOnline);
    }
    
    wasOnline = isOnline;
  });
  
  return unsubscribe;
}

/**
 * Check if currently online
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}

export default {
  // File list caching
  generateFilterKey,
  cacheFileList,
  getCachedFileList,
  clearCachedFileLists,
  
  // Pending operations
  queueOperation,
  getPendingOperations,
  removePendingOperation,
  clearPendingOperations,
  processPendingOperations,
  
  // Sync status
  getLastSyncTime,
  updateLastSyncTime,
  getSyncStatus,
  
  // Network
  subscribeToNetworkChanges,
  isOnline,
};
