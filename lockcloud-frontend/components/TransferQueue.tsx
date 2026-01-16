'use client';

import { useTransferQueueStore } from '@/stores/transferQueueStore';
import {
  AnyTransferTask,
  UploadTask,
  UploadFileItem,
  DownloadFileItem,
  TransferStatus,
} from '@/types/transfer-queue';

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Helper function to format time
const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return date.toLocaleDateString('zh-CN');
};

// Status badge component
function StatusBadge({
  status,
  type,
  compact = false,
}: {
  status: TransferStatus;
  type: 'upload' | 'download';
  compact?: boolean;
}) {
  const config = {
    pending: { label: '等待中', shortLabel: '等待', color: 'bg-accent-gray/20 text-accent-gray' },
    processing: {
      label: type === 'upload' ? '上传中' : '下载中',
      shortLabel: type === 'upload' ? '上传' : '下载',
      color: 'bg-accent-blue/20 text-accent-blue',
    },
    completed: { label: '已完成', shortLabel: '完成', color: 'bg-accent-green/20 text-accent-green' },
    failed: { label: '失败', shortLabel: '失败', color: 'bg-semantic-error/20 text-semantic-error' },
  };

  const { label, shortLabel, color } = config[status];

  return (
    <span className={`px-1.5 md:px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <span className="md:hidden">{compact ? shortLabel : label}</span>
      <span className="hidden md:inline">{label}</span>
    </span>
  );
}

// Transfer type badge
function TypeBadge({ type }: { type: 'upload' | 'download' }) {
  const config = {
    upload: {
      label: '上传',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      color: 'bg-accent-blue/10 text-accent-blue',
    },
    download: {
      label: '下载',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      color: 'bg-accent-green/10 text-accent-green',
    },
  };

  const { label, icon, color } = config[type];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// File item component
function FileItemView({
  file,
  type,
}: {
  file: UploadFileItem | DownloadFileItem;
  type: 'upload' | 'download';
}) {
  const filename = type === 'upload' 
    ? (file as UploadFileItem).customFilename || (file as UploadFileItem).file.name
    : (file as DownloadFileItem).filename;
  const totalBytes = file.totalBytes;

  return (
    <div className="p-1.5 md:p-2 bg-accent-gray/5 rounded-lg space-y-1">
      <div className="flex items-center gap-1.5 md:gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary-black truncate" title={filename}>
            {filename}
          </p>
          <p className="text-xs text-accent-gray hidden md:block">{formatFileSize(totalBytes)}</p>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {file.status === 'processing' && (
            <div className="text-xs text-accent-blue font-medium tabular-nums">{file.progress}%</div>
          )}
          <StatusBadge status={file.status} type={type} compact />
        </div>
      </div>

      {file.status === 'processing' && (
        <div className="w-full">
          <div className="w-full h-1.5 md:h-1 bg-accent-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all duration-150"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        </div>
      )}

      {file.error && <p className="text-xs text-semantic-error line-clamp-2">{file.error}</p>}
    </div>
  );
}

// Task card component
function TaskCard({ task }: { task: AnyTransferTask }) {
  const removeTask = useTransferQueueStore((state) => state.removeTask);
  const cancelTask = useTransferQueueStore((state) => state.cancelTask);
  const pauseTask = useTransferQueueStore((state) => state.pauseTask);
  const resumeTask = useTransferQueueStore((state) => state.resumeTask);
  const pausedTasks = useTransferQueueStore((state) => state.pausedTasks);

  const isPaused = pausedTasks.has(task.id);
  const files = task.files as (UploadFileItem | DownloadFileItem)[];
  const completedFiles = files.filter((f) => f.status === 'completed').length;
  const totalFiles = files.length;
  const overallProgress = files.reduce((sum, f) => sum + (f.progress || 0), 0) / totalFiles;

  const isUpload = task.type === 'upload';
  const uploadTask = isUpload ? (task as UploadTask) : null;
  const isActive = task.status === 'processing' || (task.status === 'pending' && !isPaused);

  return (
    <div className="bg-white rounded-lg border border-accent-gray/20 p-2.5 md:p-3 space-y-2">
      {/* Task Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
            <TypeBadge type={task.type} />
            {isPaused ? (
              <span className="px-1.5 md:px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                已暂停
              </span>
            ) : (
              <StatusBadge status={task.status} type={task.type} />
            )}
            <span className="text-xs text-accent-gray tabular-nums">
              {completedFiles}/{totalFiles} 文件
            </span>
            {task.status === 'processing' && (
              <span className="md:hidden text-xs text-accent-blue font-medium tabular-nums">
                {Math.round(overallProgress)}%
              </span>
            )}
          </div>

          {isUpload && uploadTask && (
            <>
              <p className="text-xs md:text-sm font-medium text-primary-black truncate">
                {uploadTask.activityType}
                {uploadTask.activityName ? ` · ${uploadTask.activityName}` : ''}
              </p>
              <p className="text-xs text-accent-gray">
                {uploadTask.activityDate}
                <span className="hidden md:inline"> · {formatTime(task.createdAt)}</span>
              </p>
            </>
          )}

          {!isUpload && (
            <p className="text-xs text-accent-gray">{formatTime(task.createdAt)}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Pause/Resume button - only for active tasks */}
          {(task.status === 'processing' || (task.status === 'pending' && !isPaused)) && (
            <button
              onClick={() => pauseTask(task.id)}
              className="p-1.5 hover:bg-yellow-50 active:bg-yellow-100 rounded-lg transition-colors"
              title="暂停"
            >
              <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
          )}

          {/* Resume button - only for paused tasks */}
          {isPaused && task.status === 'pending' && (
            <button
              onClick={() => resumeTask(task.id)}
              className="p-1.5 hover:bg-green-50 active:bg-green-100 rounded-lg transition-colors"
              title="继续"
            >
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {/* Cancel button - only for active or paused tasks */}
          {isActive || isPaused ? (
            <button
              onClick={() => cancelTask(task.id)}
              className="p-1.5 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors"
              title="取消"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            /* Remove button - only for completed or failed tasks */
            <button
              onClick={() => removeTask(task.id)}
              className="p-1.5 hover:bg-accent-gray/10 active:bg-accent-gray/20 rounded-lg transition-colors"
              title="移除"
            >
              <svg className="w-4 h-4 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar for mobile */}
      {task.status === 'processing' && (
        <div className="md:hidden w-full">
          <div className="w-full h-2 bg-accent-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all duration-150"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="space-y-1">
        <div className="hidden md:block space-y-1">
          {files.map((file) => (
            <FileItemView key={file.id} file={file} type={task.type} />
          ))}
        </div>

        <div className="md:hidden">
          {files.length <= 2 ? (
            <div className="space-y-1">
              {files.map((file) => (
                <FileItemView key={file.id} file={file} type={task.type} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <FileItemView file={files[0]} type={task.type} />
              <div className="px-2 py-1.5 bg-accent-gray/5 rounded-lg">
                <p className="text-xs text-accent-gray text-center">还有 {files.length - 1} 个文件</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {task.error && (
        <div className="flex items-start gap-2 p-2 bg-semantic-error/10 rounded-lg">
          <svg
            className="w-4 h-4 text-semantic-error mt-0.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs text-semantic-error line-clamp-2">{task.error}</p>
        </div>
      )}
    </div>
  );
}

export function TransferQueue() {
  const tasks = useTransferQueueStore((state) => state.tasks);
  const clearCompleted = useTransferQueueStore((state) => state.clearCompleted);

  const hasTasks = tasks.length > 0;
  const hasCompleted = tasks.some((t) => t.status === 'completed');

  const uploadingCount = tasks.filter((t) => t.type === 'upload' && t.status === 'processing').length;
  const downloadingCount = tasks.filter((t) => t.type === 'download' && t.status === 'processing').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="bg-primary-white rounded-xl border-2 border-accent-gray/30 p-3 md:p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 md:pb-3 border-b border-accent-gray/20">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 md:w-5 md:h-5 text-accent-blue"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <h3 className="text-sm md:text-base font-semibold text-primary-black">传输队列</h3>
          {hasTasks && (
            <span className="px-1.5 md:px-2 py-0.5 bg-accent-blue/20 text-accent-blue text-xs font-medium rounded tabular-nums">
              {tasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasTasks && (uploadingCount > 0 || downloadingCount > 0 || pendingCount > 0) && (
            <div className="md:hidden flex items-center gap-1 text-xs text-accent-gray">
              {uploadingCount > 0 && <span className="text-accent-blue">{uploadingCount} 上传</span>}
              {downloadingCount > 0 && <span className="text-accent-green">{downloadingCount} 下载</span>}
              {pendingCount > 0 && <span>{pendingCount} 等待</span>}
            </div>
          )}

          {hasCompleted && (
            <button
              onClick={clearCompleted}
              className="px-2 py-1 text-xs text-accent-gray hover:text-primary-black hover:bg-accent-gray/10 rounded-lg transition-colors min-h-[32px] md:min-h-0"
            >
              <span className="hidden md:inline">清除已完成</span>
              <span className="md:hidden">清除</span>
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3">
        {!hasTasks ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 md:py-8">
            <svg
              className="w-10 h-10 md:w-12 md:h-12 text-accent-gray/40 mb-2 md:mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <p className="text-sm text-accent-gray">暂无传输任务</p>
            <p className="text-xs text-accent-gray mt-1 hidden md:block">上传或下载文件时将显示在这里</p>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
