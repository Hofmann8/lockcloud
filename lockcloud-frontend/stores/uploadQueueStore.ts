import { create } from 'zustand';
import { UploadTask, CreateUploadTaskRequest } from '@/types/upload-queue';
import { getUploadUrl, confirmUpload } from '@/lib/api/files';
import axios, { AxiosError } from 'axios';
import { showToast } from '@/lib/utils/toast';
import { ApiError } from '@/types';

interface UploadQueueState {
  tasks: UploadTask[];
  isProcessing: boolean;
  onTaskComplete?: () => void;
  
  // Actions
  addTask: (request: CreateUploadTaskRequest) => string;
  removeTask: (taskId: string) => void;
  clearCompleted: () => void;
  startProcessing: () => Promise<void>;
  setOnTaskComplete: (callback: () => void) => void;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useUploadQueueStore = create<UploadQueueState>((set, get) => ({
  tasks: [],
  isProcessing: false,
  onTaskComplete: undefined,
  
  addTask: (request: CreateUploadTaskRequest) => {
    const taskId = generateId();
    
    const task: UploadTask = {
      id: taskId,
      files: request.files.map(f => ({
        id: generateId(),
        file: f.file,
        customFilename: f.customFilename,
        status: 'pending',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: f.file.size,
      })),
      activityDate: request.activityDate,
      activityType: request.activityType,
      activityName: request.activityName,
      status: 'pending',
      createdAt: new Date(),
    };
    
    set(state => ({
      tasks: [...state.tasks, task],
    }));
    
    // Auto-start processing if not already processing
    if (!get().isProcessing) {
      get().startProcessing();
    }
    
    return taskId;
  },
  
  removeTask: (taskId: string) => {
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== taskId),
    }));
  },
  
  clearCompleted: () => {
    set(state => ({
      tasks: state.tasks.filter(t => t.status !== 'completed'),
    }));
  },
  
  startProcessing: async () => {
    const { isProcessing } = get();
    
    if (isProcessing) return;
    
    set({ isProcessing: true });
    
    try {
      // Process tasks one by one
      while (true) {
        // Get current state to find next pending task
        const currentTasks = get().tasks;
        const nextTask = currentTasks.find(t => t.status === 'pending');
        
        if (!nextTask) break; // No more pending tasks
        
        // Update task status to uploading
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === nextTask.id ? { ...t, status: 'uploading' } : t
          ),
        }));
        
        try {
          // Upload all files in the task
          for (const fileItem of nextTask.files) {
            if (fileItem.status !== 'pending') continue;
            
            // Update file status to uploading
            set(state => ({
              tasks: state.tasks.map(t =>
                t.id === nextTask.id
                  ? {
                      ...t,
                      files: t.files.map(f =>
                        f.id === fileItem.id ? { ...f, status: 'uploading' } : f
                      ),
                    }
                  : t
              ),
            }));
            
            try {
              // Step 1: Get upload URL
              const uploadUrlData = await getUploadUrl({
                original_filename: fileItem.file.name,
                content_type: fileItem.file.type,
                size: fileItem.file.size,
                activity_date: nextTask.activityDate,
                activity_type: nextTask.activityType,
                activity_name: nextTask.activityName,
                custom_filename: fileItem.customFilename?.trim() || undefined,
              });
              
              // Step 2: Upload to S3
              await axios.put(uploadUrlData.upload_url, fileItem.file, {
                headers: {
                  'Content-Type': fileItem.file.type,
                },
                onUploadProgress: (progressEvent) => {
                  if (progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    
                    set(state => ({
                      tasks: state.tasks.map(t =>
                        t.id === nextTask.id
                          ? {
                              ...t,
                              files: t.files.map(f =>
                                f.id === fileItem.id
                                  ? {
                                      ...f,
                                      progress,
                                      uploadedBytes: progressEvent.loaded,
                                      totalBytes: progressEvent.total || f.totalBytes,
                                    }
                                  : f
                              ),
                            }
                          : t
                      ),
                    }));
                  }
                },
              });
              
              // Step 3: Confirm upload
              await confirmUpload({
                s3_key: uploadUrlData.s3_key,
                size: fileItem.file.size,
                content_type: fileItem.file.type,
                original_filename: fileItem.file.name,
                activity_date: nextTask.activityDate,
                activity_type: nextTask.activityType,
                activity_name: nextTask.activityName,
              });
              
              // Update file status to completed
              set(state => ({
                tasks: state.tasks.map(t =>
                  t.id === nextTask.id
                    ? {
                        ...t,
                        files: t.files.map(f =>
                          f.id === fileItem.id
                            ? { ...f, status: 'completed', progress: 100, s3Key: uploadUrlData.s3_key }
                            : f
                        ),
                      }
                    : t
                ),
              }));
            } catch (error) {
              console.error('File upload error:', error);
              
              let errorMessage = '上传失败';
              
              if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{ error?: ApiError; message?: string }>;
                
                // Try to get error from response data
                if (axiosError.response?.data?.error) {
                  const errorData = axiosError.response.data.error;
                  errorMessage = errorData.message || errorData.code || '上传失败';
                } else if (axiosError.response?.data?.message) {
                  errorMessage = axiosError.response.data.message;
                } else {
                  errorMessage = axiosError.message || '上传失败';
                }
              } else if (error instanceof Error) {
                errorMessage = error.message;
              }
              
              // Update file status to failed
              set(state => ({
                tasks: state.tasks.map(t =>
                  t.id === nextTask.id
                    ? {
                        ...t,
                        files: t.files.map(f =>
                          f.id === fileItem.id
                            ? {
                                ...f,
                                status: 'failed',
                                error: errorMessage,
                              }
                            : f
                        ),
                      }
                    : t
                ),
              }));
            }
          }
          
          // Check if all files completed
          const currentTask = get().tasks.find(t => t.id === nextTask.id);
          const allCompleted = currentTask?.files.every(f => f.status === 'completed');
          const anyFailed = currentTask?.files.some(f => f.status === 'failed');
          
          // Update task status
          set(state => ({
            tasks: state.tasks.map(t =>
              t.id === nextTask.id
                ? {
                    ...t,
                    status: anyFailed ? 'failed' : allCompleted ? 'completed' : 'uploading',
                    completedAt: allCompleted || anyFailed ? new Date() : undefined,
                  }
                : t
            ),
          }));
          
          if (allCompleted) {
            showToast.success(`任务完成：${nextTask.files.length} 个文件上传成功`);
            // Trigger callback to refresh file list and directories
            const callback = get().onTaskComplete;
            if (callback) callback();
          } else if (anyFailed) {
            showToast.error(`任务失败：部分文件上传失败`);
          }
        } catch (error) {
          console.error('Task error:', error);
          
          let errorMessage = '任务失败';
          
          if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ error?: ApiError; message?: string }>;
            // Try to get error from response data
            if (axiosError.response?.data?.error) {
              const errorData = axiosError.response.data.error;
              errorMessage = errorData.message || errorData.code || '任务失败';
            } else if (axiosError.response?.data?.message) {
              errorMessage = axiosError.response.data.message;
            } else {
              errorMessage = axiosError.message || '任务失败';
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          // Update task status to failed
          set(state => ({
            tasks: state.tasks.map(t =>
              t.id === nextTask.id
                ? {
                    ...t,
                    status: 'failed',
                    completedAt: new Date(),
                    error: errorMessage,
                  }
                : t
            ),
          }));
          
          showToast.error(`任务失败：${errorMessage}`);
        }
      }
    } finally {
      set({ isProcessing: false });
    }
  },
  
  setOnTaskComplete: (callback: () => void) => {
    set({ onTaskComplete: callback });
  },
}));
