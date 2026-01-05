/**
 * Upload Queue State Management
 * 
 * Uses Zustand for managing file upload queue.
 * Follows the Web frontend implementation pattern but adapted for React Native.
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.7, 5.8, 5.9
 */

import { create } from 'zustand';
import axios, { isAxiosError } from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { UploadQueueItem, UploadMetadata, UploadStatus } from '../types';
import { getUploadUrl, confirmUpload } from '../lib/api/files';

interface UploadQueueState {
  items: UploadQueueItem[];
  isProcessing: boolean;
  onTaskComplete?: () => void;
  
  // Actions
  addItem: (
    uri: string,
    filename: string,
    mimeType: string,
    size: number,
    metadata: UploadMetadata
  ) => string;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  clearCompleted: () => void;
  processQueue: () => Promise<void>;
  setOnTaskComplete: (callback: () => void) => void;
  updateItemProgress: (id: string, progress: number) => void;
  updateItemStatus: (id: string, status: UploadStatus, error?: string) => void;
}

/**
 * Generate unique ID for queue items
 */
const generateId = (): string => 
  `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

export const useUploadQueueStore = create<UploadQueueState>((set, get) => ({
  items: [],
  isProcessing: false,
  onTaskComplete: undefined,

  /**
   * Add a new item to the upload queue
   * 
   * @param uri - Local file URI
   * @param filename - Original filename
   * @param mimeType - MIME type of the file
   * @param size - File size in bytes
   * @param metadata - Upload metadata (activity_date, activity_type, etc.)
   * @returns Generated item ID
   * 
   * Requirements: 5.7, 5.9
   */
  addItem: (
    uri: string,
    filename: string,
    mimeType: string,
    size: number,
    metadata: UploadMetadata
  ): string => {
    const id = generateId();
    
    const item: UploadQueueItem = {
      id,
      uri,
      filename,
      mimeType,
      size,
      metadata,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };
    
    set((state) => ({
      items: [...state.items, item],
    }));
    
    // Auto-start processing if not already processing
    if (!get().isProcessing) {
      get().processQueue();
    }
    
    return id;
  },

  /**
   * Remove an item from the queue
   * 
   * @param id - Item ID to remove
   */
  removeItem: (id: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  /**
   * Retry a failed upload
   * 
   * @param id - Item ID to retry
   * 
   * Requirements: 5.8
   */
  retryItem: (id: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, status: 'pending' as UploadStatus, progress: 0, error: undefined }
          : item
      ),
    }));
    
    // Start processing if not already
    if (!get().isProcessing) {
      get().processQueue();
    }
  },

  /**
   * Clear all completed items from the queue
   */
  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'success'),
    }));
  },

  /**
   * Update item progress
   * 
   * @param id - Item ID
   * @param progress - Progress percentage (0-100)
   * 
   * Requirements: 5.7
   */
  updateItemProgress: (id: string, progress: number) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, progress } : item
      ),
    }));
  },

  /**
   * Update item status
   * 
   * @param id - Item ID
   * @param status - New status
   * @param error - Optional error message
   */
  updateItemStatus: (id: string, status: UploadStatus, error?: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status, error } : item
      ),
    }));
  },

  /**
   * Set callback for task completion
   * Used to refresh file list after successful uploads
   */
  setOnTaskComplete: (callback: () => void) => {
    set({ onTaskComplete: callback });
  },

  /**
   * Process the upload queue
   * Uploads files one by one in FIFO order
   * 
   * Upload flow:
   * 1. Request signed URL from /api/files/upload-url
   * 2. Upload file directly to S3 using signed URL
   * 3. Confirm upload via /api/files/confirm
   * 
   * Requirements: 5.2, 5.3, 5.4, 5.9
   */
  processQueue: async () => {
    const { isProcessing } = get();
    
    if (isProcessing) return;
    
    set({ isProcessing: true });
    
    try {
      while (true) {
        // Get next pending item
        const currentItems = get().items;
        const nextItem = currentItems.find((item) => item.status === 'pending');
        
        if (!nextItem) break; // No more pending items
        
        // Update status to uploading
        get().updateItemStatus(nextItem.id, 'uploading');
        
        try {
          // Step 1: Request signed upload URL
          const uploadUrlData = await getUploadUrl({
            original_filename: nextItem.filename,
            content_type: nextItem.mimeType,
            size: nextItem.size,
            activity_date: nextItem.metadata.activity_date,
            activity_type: nextItem.metadata.activity_type,
            activity_name: nextItem.metadata.activity_name,
            custom_filename: nextItem.metadata.custom_filename?.trim() || undefined,
          });
          
          // Step 2: Upload to S3
          // Use legacy FileSystem API for upload with progress tracking
          const uploadTask = FileSystem.createUploadTask(
            uploadUrlData.upload_url,
            nextItem.uri,
            {
              httpMethod: 'PUT',
              headers: {
                'Content-Type': nextItem.mimeType,
              },
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            },
            (progressData) => {
              const progress = Math.round(
                (progressData.totalBytesSent / progressData.totalBytesExpectedToSend) * 100
              );
              get().updateItemProgress(nextItem.id, progress);
            }
          );
          
          const uploadResult = await uploadTask.uploadAsync();
          
          if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
            throw new Error(`S3 upload failed with status ${uploadResult?.status || 'unknown'}`);
          }
          
          // Step 3: Confirm upload
          await confirmUpload({
            s3_key: uploadUrlData.s3_key,
            size: nextItem.size,
            content_type: nextItem.mimeType,
            original_filename: nextItem.filename,
            activity_date: nextItem.metadata.activity_date,
            activity_type: nextItem.metadata.activity_type,
            activity_name: nextItem.metadata.activity_name,
          });
          
          // Update status to success
          get().updateItemStatus(nextItem.id, 'success');
          get().updateItemProgress(nextItem.id, 100);
          
          // Trigger callback to refresh file list
          const callback = get().onTaskComplete;
          if (callback) callback();
          
        } catch (error) {
          console.error('Upload error:', error);
          
          let errorMessage = '上传失败';
          
          if (isAxiosError(error)) {
            if (error.response?.data?.error) {
              const errorData = error.response.data.error;
              errorMessage = errorData.message || errorData.code || '上传失败';
            } else if (error.response?.data?.message) {
              errorMessage = error.response.data.message;
            } else {
              errorMessage = error.message || '上传失败';
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          // Update status to error
          get().updateItemStatus(nextItem.id, 'error', errorMessage);
        }
      }
    } finally {
      set({ isProcessing: false });
    }
  },
}));

export default useUploadQueueStore;
