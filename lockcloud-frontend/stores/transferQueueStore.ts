import { create } from 'zustand';
import {
  AnyTransferTask,
  UploadTask,
  DownloadTask,
  UploadFileItem,
  DownloadFileItem,
  CreateUploadTaskRequest,
  CreateDownloadTaskRequest,
  TransferStatus,
} from '@/types/transfer-queue';
import { getUploadUrl, confirmUpload, getSignedUrl } from '@/lib/api/files';
import axios, { AxiosError } from 'axios';
import JSZip from 'jszip';
import { showToast } from '@/lib/utils/toast';
import { ApiError } from '@/types';

// Store abort controllers for cancellation
const abortControllers = new Map<string, AbortController>();

interface TransferQueueState {
  tasks: AnyTransferTask[];
  isProcessing: boolean;
  pausedTasks: Set<string>; // Task IDs that are paused
  onUploadComplete?: () => void;

  // Actions
  addUploadTask: (request: CreateUploadTaskRequest) => string;
  addDownloadTask: (request: CreateDownloadTaskRequest) => string;
  removeTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  clearCompleted: () => void;
  startProcessing: () => Promise<void>;
  setOnUploadComplete: (callback: () => void) => void;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const useTransferQueueStore = create<TransferQueueState>((set, get) => ({
  tasks: [],
  isProcessing: false,
  pausedTasks: new Set(),
  onUploadComplete: undefined,

  addUploadTask: (request: CreateUploadTaskRequest) => {
    const taskId = generateId();

    const task: UploadTask = {
      id: taskId,
      type: 'upload',
      files: request.files.map((f) => ({
        id: generateId(),
        file: f.file,
        filename: f.customFilename || f.file.name,
        customFilename: f.customFilename,
        status: 'pending',
        progress: 0,
        transferredBytes: 0,
        totalBytes: f.file.size,
      })),
      activityDate: request.activityDate,
      activityType: request.activityType,
      activityName: request.activityName,
      status: 'pending',
      createdAt: new Date(),
    };

    set((state) => ({
      tasks: [...state.tasks, task],
    }));

    // Auto-start processing
    if (!get().isProcessing) {
      get().startProcessing();
    }

    return taskId;
  },

  addDownloadTask: (request: CreateDownloadTaskRequest) => {
    const taskId = generateId();

    const task: DownloadTask = {
      id: taskId,
      type: 'download',
      files: request.files.map((f) => ({
        id: generateId(),
        fileId: f.fileId,
        filename: f.filename,
        contentType: f.contentType,
        status: 'pending',
        progress: 0,
        transferredBytes: 0,
        totalBytes: f.size,
      })),
      status: 'pending',
      createdAt: new Date(),
    };

    set((state) => ({
      tasks: [...state.tasks, task],
    }));

    // Auto-start processing
    if (!get().isProcessing) {
      get().startProcessing();
    }

    return taskId;
  },

  removeTask: (taskId: string) => {
    // Cancel if running
    const controller = abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      abortControllers.delete(taskId);
    }
    
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      pausedTasks: new Set([...state.pausedTasks].filter(id => id !== taskId)),
    }));
  },

  cancelTask: (taskId: string) => {
    // Abort the request
    const controller = abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      abortControllers.delete(taskId);
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'failed' as TransferStatus, error: '已取消', completedAt: new Date() }
          : t
      ),
      pausedTasks: new Set([...state.pausedTasks].filter(id => id !== taskId)),
    }));
  },

  pauseTask: (taskId: string) => {
    // Abort current request but keep task in queue
    const controller = abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      abortControllers.delete(taskId);
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'pending' as TransferStatus } : t
      ),
      pausedTasks: new Set([...state.pausedTasks, taskId]),
    }));
  },

  resumeTask: (taskId: string) => {
    set((state) => ({
      pausedTasks: new Set([...state.pausedTasks].filter(id => id !== taskId)),
    }));

    // Restart processing if not already running
    if (!get().isProcessing) {
      get().startProcessing();
    }
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== 'completed'),
    }));
  },

  startProcessing: async () => {
    const { isProcessing } = get();
    if (isProcessing) return;

    set({ isProcessing: true });

    try {
      while (true) {
        const { tasks, pausedTasks } = get();
        // Find next pending task that is not paused
        const nextTask = tasks.find((t) => t.status === 'pending' && !pausedTasks.has(t.id));

        if (!nextTask) break;

        // Create abort controller for this task
        const abortController = new AbortController();
        abortControllers.set(nextTask.id, abortController);

        // Update task status
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === nextTask.id ? { ...t, status: 'processing' } : t
          ),
        }));

        try {
          if (nextTask.type === 'upload') {
            await processUploadTask(nextTask as UploadTask, set, get, abortController.signal);
          } else {
            await processDownloadTask(nextTask as DownloadTask, set, get, abortController.signal);
          }
        } catch (error) {
          // Check if it was cancelled/paused
          if (axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')) {
            // Task was cancelled or paused, don't mark as failed
            continue;
          }

          console.error('Task error:', error);
          const errorMessage = getErrorMessage(error);

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === nextTask.id
                ? { ...t, status: 'failed', completedAt: new Date(), error: errorMessage }
                : t
            ),
          }));

          showToast.error(`任务失败：${errorMessage}`);
        } finally {
          abortControllers.delete(nextTask.id);
        }
      }
    } finally {
      set({ isProcessing: false });
    }
  },

  setOnUploadComplete: (callback: () => void) => {
    set({ onUploadComplete: callback });
  },
}));

// Process upload task
async function processUploadTask(
  task: UploadTask,
  set: (fn: (state: TransferQueueState) => Partial<TransferQueueState>) => void,
  get: () => TransferQueueState,
  signal: AbortSignal
) {
  for (const fileItem of task.files) {
    if (fileItem.status !== 'pending') continue;

    // Check if cancelled
    if (signal.aborted) throw new Error('AbortError');

    // Update file status
    updateFileStatus(set, task.id, fileItem.id, { status: 'processing' });

    try {
      // Step 1: Get upload URL
      const uploadUrlData = await getUploadUrl({
        original_filename: fileItem.file.name,
        content_type: fileItem.file.type,
        size: fileItem.file.size,
        activity_date: task.activityDate,
        activity_type: task.activityType,
        activity_name: task.activityName,
        custom_filename: fileItem.customFilename?.trim() || undefined,
      });

      // Check if cancelled
      if (signal.aborted) throw new Error('AbortError');

      // Step 2: Upload to S3
      await axios.put(uploadUrlData.upload_url, fileItem.file, {
        headers: { 'Content-Type': fileItem.file.type },
        signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            updateFileStatus(set, task.id, fileItem.id, {
              progress,
              transferredBytes: progressEvent.loaded,
              totalBytes: progressEvent.total,
            });
          }
        },
      });

      // Check if cancelled
      if (signal.aborted) throw new Error('AbortError');

      // Step 3: Confirm upload
      await confirmUpload({
        s3_key: uploadUrlData.s3_key,
        size: fileItem.file.size,
        content_type: fileItem.file.type,
        original_filename: fileItem.file.name,
        activity_date: task.activityDate,
        activity_type: task.activityType,
        activity_name: task.activityName,
      });

      updateFileStatus(set, task.id, fileItem.id, {
        status: 'completed',
        progress: 100,
        s3Key: uploadUrlData.s3_key,
      });
    } catch (error) {
      if (axios.isCancel(error) || (error instanceof Error && error.message === 'AbortError')) {
        throw error; // Re-throw to be handled by caller
      }
      const errorMessage = getErrorMessage(error);
      updateFileStatus(set, task.id, fileItem.id, {
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  // Check task completion
  const currentTask = get().tasks.find((t) => t.id === task.id) as UploadTask | undefined;
  const allCompleted = currentTask?.files.every((f) => f.status === 'completed');
  const anyFailed = currentTask?.files.some((f) => f.status === 'failed');

  set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: anyFailed ? 'failed' : allCompleted ? 'completed' : 'processing',
            completedAt: allCompleted || anyFailed ? new Date() : undefined,
          }
        : t
    ),
  }));

  if (allCompleted) {
    showToast.success(`上传完成：${task.files.length} 个文件`);
    const callback = get().onUploadComplete;
    if (callback) callback();
  } else if (anyFailed) {
    showToast.error(`上传失败：部分文件上传失败`);
  }
}

// Process download task
async function processDownloadTask(
  task: DownloadTask,
  set: (fn: (state: TransferQueueState) => Partial<TransferQueueState>) => void,
  get: () => TransferQueueState,
  signal: AbortSignal
) {
  const isMultiFile = task.files.length > 1;
  const downloadedBlobs: { filename: string; blob: Blob }[] = [];

  for (const fileItem of task.files) {
    if (fileItem.status !== 'pending') continue;

    // Check if cancelled
    if (signal.aborted) throw new Error('AbortError');

    updateFileStatus(set, task.id, fileItem.id, { status: 'processing' });

    try {
      // Step 1: Get signed URL
      const signedUrlData = await getSignedUrl(fileItem.fileId, 'original');
      const downloadUrl = signedUrlData.signed_url;

      // Check if cancelled
      if (signal.aborted) throw new Error('AbortError');

      // Step 2: Download file to memory with progress
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        signal,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            updateFileStatus(set, task.id, fileItem.id, {
              progress,
              transferredBytes: progressEvent.loaded,
              totalBytes: progressEvent.total,
            });
          }
        },
      });

      // Check if cancelled
      if (signal.aborted) throw new Error('AbortError');

      const blob = response.data as Blob;

      if (isMultiFile) {
        // Multi-file: collect blobs for ZIP
        downloadedBlobs.push({ filename: fileItem.filename, blob });
      } else {
        // Single file: trigger download immediately
        triggerBrowserDownload(blob, fileItem.filename);
      }

      updateFileStatus(set, task.id, fileItem.id, {
        status: 'completed',
        progress: 100,
        blob,
      });
    } catch (error) {
      if (axios.isCancel(error) || (error instanceof Error && error.message === 'AbortError')) {
        throw error; // Re-throw to be handled by caller
      }
      const errorMessage = getErrorMessage(error);
      updateFileStatus(set, task.id, fileItem.id, {
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  // Check task completion
  const currentTask = get().tasks.find((t) => t.id === task.id) as DownloadTask | undefined;
  const allCompleted = currentTask?.files.every((f) => f.status === 'completed');
  const anyFailed = currentTask?.files.some((f) => f.status === 'failed');

  // If multi-file and all completed, create ZIP
  if (isMultiFile && allCompleted && downloadedBlobs.length > 0) {
    try {
      showToast.loading('正在打包 ZIP...');
      const zip = new JSZip();
      
      for (const { filename, blob } of downloadedBlobs) {
        zip.file(filename, blob);
      }

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Generate ZIP filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const zipFilename = `LockCloud_${timestamp}_${downloadedBlobs.length}files.zip`;
      
      triggerBrowserDownload(zipBlob, zipFilename);
      showToast.dismiss();
    } catch (zipError) {
      console.error('ZIP creation failed:', zipError);
      showToast.error('ZIP 打包失败');
    }
  }

  set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: anyFailed ? 'failed' : allCompleted ? 'completed' : 'processing',
            completedAt: allCompleted || anyFailed ? new Date() : undefined,
          }
        : t
    ),
  }));

  if (allCompleted) {
    showToast.success(`下载完成：${task.files.length} 个文件`);
  } else if (anyFailed) {
    showToast.error(`下载失败：部分文件下载失败`);
  }
}

// Helper: Update file status
function updateFileStatus(
  set: (fn: (state: TransferQueueState) => Partial<TransferQueueState>) => void,
  taskId: string,
  fileId: string,
  updates: Partial<UploadFileItem | DownloadFileItem>
) {
  set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            files: (t.files as (UploadFileItem | DownloadFileItem)[]).map((f) =>
              f.id === fileId ? { ...f, ...updates } : f
            ),
          }
        : t
    ) as AnyTransferTask[],
  }));
}

// Helper: Get error message
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: ApiError; message?: string }>;
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error.message || axiosError.response.data.error.code || '操作失败';
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    return axiosError.message || '操作失败';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败';
}

// Helper: Trigger browser download from blob
function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
