'use client';

import { useUploadQueueStore } from '@/stores/uploadQueueStore';
import { UploadTask, UploadFileItem } from '@/types/upload-queue';

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

// Status badge component - compact on mobile
function StatusBadge({ status, compact = false }: { status: UploadTask['status'] | UploadFileItem['status']; compact?: boolean }) {
  const config = {
    pending: { label: '等待中', shortLabel: '等待', color: 'bg-accent-gray/20 text-accent-gray' },
    uploading: { label: '上传中', shortLabel: '上传', color: 'bg-accent-blue/20 text-accent-blue' },
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

// File item component - compact layout for mobile
function FileItemView({ file }: { file: UploadFileItem }) {
  return (
    <div className="p-1.5 md:p-2 bg-accent-gray/5 rounded-lg space-y-1">
      {/* File info row - more compact on mobile */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary-black truncate" title={file.file.name}>
            {file.customFilename || file.file.name}
          </p>
          {/* Hide file size on mobile when uploading to save space */}
          <p className="text-xs text-accent-gray hidden md:block">
            {formatFileSize(file.file.size)}
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {file.status === 'uploading' && (
            <div className="text-xs text-accent-blue font-medium tabular-nums">
              {file.progress}%
            </div>
          )}
          <StatusBadge status={file.status} compact />
        </div>
      </div>
      
      {/* Progress bar row - slightly thicker on mobile for visibility */}
      {file.status === 'uploading' && (
        <div className="w-full">
          <div className="w-full h-1.5 md:h-1 bg-accent-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all duration-150"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Error message row */}
      {file.error && (
        <p className="text-xs text-semantic-error line-clamp-2">{file.error}</p>
      )}
    </div>
  );
}

// Task card component - compact layout for mobile
function TaskCard({ task }: { task: UploadTask }) {
  const removeTask = useUploadQueueStore(state => state.removeTask);
  
  const completedFiles = task.files.filter(f => f.status === 'completed').length;
  const totalFiles = task.files.length;
  
  // Calculate overall progress for mobile summary view
  const overallProgress = task.files.reduce((sum, f) => sum + (f.progress || 0), 0) / totalFiles;
  
  return (
    <div className="bg-white rounded-lg border border-accent-gray/20 p-2.5 md:p-3 space-y-2">
      {/* Task Header - more compact on mobile */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
            <StatusBadge status={task.status} />
            <span className="text-xs text-accent-gray tabular-nums">
              {completedFiles}/{totalFiles} 文件
            </span>
            {/* Show overall progress on mobile when uploading */}
            {task.status === 'uploading' && (
              <span className="md:hidden text-xs text-accent-blue font-medium tabular-nums">
                {Math.round(overallProgress)}%
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm font-medium text-primary-black truncate">
            {task.activityType}{task.activityName ? ` · ${task.activityName}` : ''}
          </p>
          <p className="text-xs text-accent-gray">
            {task.activityDate}
            <span className="hidden md:inline"> · {formatTime(task.createdAt)}</span>
          </p>
        </div>
        
        {/* Remove button - larger touch target on mobile */}
        {(task.status === 'completed' || task.status === 'failed') && (
          <button
            onClick={() => removeTask(task.id)}
            className="p-2 md:p-1 hover:bg-accent-gray/10 active:bg-accent-gray/20 rounded-lg transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            title="移除任务"
          >
            <svg className="w-4 h-4 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Overall progress bar for mobile when uploading */}
      {task.status === 'uploading' && (
        <div className="md:hidden w-full">
          <div className="w-full h-2 bg-accent-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all duration-150"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Files List - show individual files on desktop, summary on mobile */}
      <div className="space-y-1">
        {/* Desktop: show all files */}
        <div className="hidden md:block space-y-1">
          {task.files.map(file => (
            <FileItemView key={file.id} file={file} />
          ))}
        </div>
        
        {/* Mobile: show compact summary or first few files */}
        <div className="md:hidden">
          {task.files.length <= 2 ? (
            // Show all files if 2 or fewer
            <div className="space-y-1">
              {task.files.map(file => (
                <FileItemView key={file.id} file={file} />
              ))}
            </div>
          ) : (
            // Show summary for more than 2 files
            <div className="space-y-1">
              {/* Show first file */}
              <FileItemView file={task.files[0]} />
              {/* Show count of remaining files */}
              <div className="px-2 py-1.5 bg-accent-gray/5 rounded-lg">
                <p className="text-xs text-accent-gray text-center">
                  还有 {task.files.length - 1} 个文件
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {task.error && (
        <div className="flex items-start gap-2 p-2 bg-semantic-error/10 rounded-lg">
          <svg className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-semantic-error line-clamp-2">{task.error}</p>
        </div>
      )}
    </div>
  );
}

export function UploadQueue() {
  const tasks = useUploadQueueStore(state => state.tasks);
  const clearCompleted = useUploadQueueStore(state => state.clearCompleted);
  
  const hasTasks = tasks.length > 0;
  const hasCompleted = tasks.some(t => t.status === 'completed');
  
  // Calculate overall stats for mobile header
  const uploadingCount = tasks.filter(t => t.status === 'uploading').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  
  return (
    <div className="bg-primary-white rounded-xl border-2 border-accent-gray/30 p-3 md:p-4 h-full flex flex-col">
      {/* Header - more compact on mobile */}
      <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 md:pb-3 border-b border-accent-gray/20">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <h3 className="text-sm md:text-base font-semibold text-primary-black">
            上传队列
          </h3>
          {hasTasks && (
            <span className="px-1.5 md:px-2 py-0.5 bg-accent-blue/20 text-accent-blue text-xs font-medium rounded tabular-nums">
              {tasks.length}
            </span>
          )}
        </div>
        
        {/* Mobile: show status summary, Desktop: show clear button */}
        <div className="flex items-center gap-2">
          {/* Mobile status summary */}
          {hasTasks && (uploadingCount > 0 || pendingCount > 0) && (
            <div className="md:hidden flex items-center gap-1 text-xs text-accent-gray">
              {uploadingCount > 0 && (
                <span className="text-accent-blue">{uploadingCount} 上传中</span>
              )}
              {uploadingCount > 0 && pendingCount > 0 && <span>·</span>}
              {pendingCount > 0 && (
                <span>{pendingCount} 等待</span>
              )}
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
      
      {/* Tasks List - optimized spacing for mobile */}
      <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3">
        {!hasTasks ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 md:py-8">
            <svg className="w-10 h-10 md:w-12 md:h-12 text-accent-gray/40 mb-2 md:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-accent-gray">暂无上传任务</p>
            <p className="text-xs text-accent-gray mt-1 hidden md:block">添加文件后将显示在这里</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
