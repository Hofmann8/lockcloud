'use client';

import { useState, useEffect, useCallback } from 'react';
import { InlineCalendar } from './InlineCalendar';
import { Button } from './Button';
import { useActivityTypes } from '@/lib/hooks/useTagPresets';
import { checkFilenames, getActivityNamesByDate, ActivityNameInfo } from '@/lib/api/files';
import { showToast } from '@/lib/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTransferQueueStore } from '@/stores/transferQueueStore';

interface FileWithCustomName {
  id: string;
  file: File;
  customFilename: string;
}

interface MultiFileUploadFormProps {
  filesWithNames: FileWithCustomName[];
  onUploadComplete: () => void;
  existingFiles: Set<string>;
  onExistingFilesChange: (files: Set<string>) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export function MultiFileUploadForm({ 
  filesWithNames, 
  onUploadComplete, 
  existingFiles, 
  onExistingFilesChange 
}: MultiFileUploadFormProps) {
  const queryClient = useQueryClient();
  const addTask = useTransferQueueStore(state => state.addUploadTask);
  
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [activityDate, setActivityDate] = useState<string>(getCurrentDate());
  const [activityType, setActivityType] = useState<string>('');
  const [activityName, setActivityName] = useState<string>('');
  const [isNewActivity, setIsNewActivity] = useState<boolean>(false);
  const [existingActivityNames, setExistingActivityNames] = useState<ActivityNameInfo[]>([]);
  const [loadingActivityNames, setLoadingActivityNames] = useState<boolean>(false);
  
  const [errors, setErrors] = useState<{
    activityDate?: string;
    activityType?: string;
    activityName?: string;
  }>({});

  const [isCheckingFilenames, setIsCheckingFilenames] = useState(false);

  const { data: activityTypes = [], isLoading: loadingActivityTypes } = useActivityTypes();

  // Fetch activity names when date changes
  const fetchActivityNames = useCallback(async (date: string) => {
    if (!date) return;
    
    setLoadingActivityNames(true);
    try {
      const result = await getActivityNamesByDate(date);
      setExistingActivityNames(result.activity_names);
    } catch (error) {
      console.error('Failed to fetch activity names:', error);
      setExistingActivityNames([]);
    } finally {
      setLoadingActivityNames(false);
    }
  }, []);

  useEffect(() => {
    fetchActivityNames(activityDate);
  }, [activityDate, fetchActivityNames]);

  // When selecting an existing activity name, auto-fill the activity type
  const handleActivityNameSelect = (name: string) => {
    setActivityName(name);
    setIsNewActivity(false);
    
    // Find the activity type for this name
    const existingActivity = existingActivityNames.find(a => a.name === name);
    if (existingActivity) {
      setActivityType(existingActivity.activity_type);
    }
    
    if (errors.activityName) {
      setErrors({ ...errors, activityName: undefined });
    }
  };

  const handleNewActivityName = (name: string) => {
    setActivityName(name);
    setIsNewActivity(true);
    // Clear activity type when creating new activity
    setActivityType('');
    
    if (errors.activityName) {
      setErrors({ ...errors, activityName: undefined });
    }
  };

  const checkDuplicateFilenames = (): boolean => {
    const filenameMap = new Map<string, number>();
    
    filesWithNames.forEach(item => {
      const customName = item.customFilename.trim();
      const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
      const finalName = customName ? `${customName}${extension}` : item.file.name;
      
      filenameMap.set(finalName, (filenameMap.get(finalName) || 0) + 1);
    });
    
    return Array.from(filenameMap.values()).some(count => count > 1);
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!activityDate) newErrors.activityDate = '请选择活动日期';
    if (!activityType) newErrors.activityType = '请选择活动类型';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkQueueDuplicates = (): { hasDuplicates: boolean; duplicateFiles: string[] } => {
    const queueTasks = useTransferQueueStore.getState().tasks.filter(t => t.type === 'upload') as import('@/types/transfer-queue').UploadTask[];
    
    const currentFilenames = filesWithNames.map(item => {
      const customName = item.customFilename.trim();
      const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
      return customName ? `${customName}${extension}` : item.file.name;
    });
    
    const duplicates: string[] = [];
    
    queueTasks.forEach(task => {
      if (task.activityType === activityType && 
          task.activityDate.startsWith(activityDate.substring(0, 7))) {
        
        task.files.forEach(fileItem => {
          const customName = fileItem.customFilename?.trim();
          const extension = fileItem.file.name.match(/\.[^/.]+$/)?.[0] || '';
          const queueFilename = customName ? `${customName}${extension}` : fileItem.file.name;
          
          if (currentFilenames.includes(queueFilename)) {
            duplicates.push(queueFilename);
          }
        });
      }
    });
    
    return {
      hasDuplicates: duplicates.length > 0,
      duplicateFiles: [...new Set(duplicates)]
    };
  };

  const handleAddToQueue = async () => {
    if (!validateForm()) {
      showToast.error('请填写所有必填字段');
      return;
    }

    if (filesWithNames.length === 0) {
      showToast.error('请至少选择一个文件');
      return;
    }

    if (checkDuplicateFilenames()) {
      showToast.error('检测到任务内重复的文件名，请修改后再提交');
      return;
    }

    const queueCheck = checkQueueDuplicates();
    if (queueCheck.hasDuplicates) {
      showToast.error(`检测到 ${queueCheck.duplicateFiles.length} 个文件名与队列中的任务重复`);
      alert(
        `以下文件名与队列中的任务重复：\n\n${queueCheck.duplicateFiles.join('\n')}\n\n` +
        `请修改这些文件的自定义名称后再提交。`
      );
      return;
    }

    setIsCheckingFilenames(true);
    try {
      const finalFilenames = filesWithNames.map(item => {
        const customName = item.customFilename.trim();
        const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
        return customName ? `${customName}${extension}` : item.file.name;
      });

      const result = await checkFilenames({
        filenames: finalFilenames,
        activity_date: activityDate,
        activity_type: activityType,
      });

      if (result.existing_files.length > 0) {
        onExistingFilesChange(new Set(result.existing_files));
        showToast.error(`检测到 ${result.existing_files.length} 个文件名已存在于数据库中`);
        return;
      }

      onExistingFilesChange(new Set());
    } catch (error) {
      console.error('Failed to check filenames:', error);
      showToast.error('检查文件名失败，请重试');
      return;
    } finally {
      setIsCheckingFilenames(false);
    }

    addTask({
      files: filesWithNames.map(f => ({
        file: f.file,
        customFilename: f.customFilename.trim() || undefined,
      })),
      activityDate,
      activityType,
      activityName: activityName.trim() || undefined,
    });

    showToast.success(`已添加 ${filesWithNames.length} 个文件到上传队列`);
    
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['directories'] });
    
    onUploadComplete();
  };

  const isFormValid = activityDate && activityType && filesWithNames.length > 0;

  if (filesWithNames.length === 0) return null;

  return (
    <div className="card-functional overflow-hidden">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-accent-gray/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-accent-green/10 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary-black">
              已选择 {filesWithNames.length} 个文件
            </p>
            <p className="text-xs text-accent-gray truncate">
              总大小: {formatFileSize(filesWithNames.reduce((sum, f) => sum + f.file.size, 0))}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Mobile: Single column vertical layout, Desktop: Two column grid */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
          {/* Left column - Calendar (desktop only) */}
          <div className="hidden md:block space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
              <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              活动日期
              <span className="text-semantic-error">*</span>
            </div>
            
            <InlineCalendar
              value={activityDate}
              onChange={(value) => {
                setActivityDate(value);
                setActivityName('');
                setActivityType('');
                setIsNewActivity(false);
                if (errors.activityDate) setErrors({ ...errors, activityDate: undefined });
              }}
              disabled={false}
            />
            
            {errors.activityDate && (
              <p className="text-xs text-semantic-error flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.activityDate}
              </p>
            )}
          </div>

          {/* Right column - Activity Name and Type (full width on mobile) */}
          <div className="space-y-4">
            {/* Mobile date picker - optimized for touch with larger touch targets */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                活动日期
                <span className="text-semantic-error">*</span>
              </div>
              
              <input
                type="date"
                value={activityDate}
                onChange={(e) => {
                  setActivityDate(e.target.value);
                  setActivityName('');
                  setActivityType('');
                  setIsNewActivity(false);
                  if (errors.activityDate) setErrors({ ...errors, activityDate: undefined });
                }}
                className={`w-full px-4 py-3 text-base border rounded-lg transition-colors
                  min-h-[48px]
                  ${errors.activityDate 
                    ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20' 
                    : 'border-accent-gray/30 focus:border-accent-green focus:ring-accent-green/20'
                  }
                  focus:outline-none focus:ring-2`}
              />
              
              {errors.activityDate && (
                <p className="text-xs text-semantic-error flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.activityDate}
                </p>
              )}
            </div>

            {/* Activity Name - First */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                活动名称
                <span className="text-xs text-accent-gray ml-1">(可选)</span>
              </div>
              
              {loadingActivityNames ? (
                <div className="flex items-center gap-2 text-sm text-accent-gray py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-green border-t-transparent"></div>
                  <span>加载当日活动...</span>
                </div>
              ) : existingActivityNames.length > 0 ? (
                <div className="space-y-3">
                  {/* Activity name buttons - optimized for mobile touch */}
                  <div className="flex flex-wrap gap-2">
                    {existingActivityNames.map((activity) => (
                      <button
                        key={activity.name}
                        type="button"
                        onClick={() => handleActivityNameSelect(activity.name)}
                        className={`px-3 py-2 md:py-1.5 text-sm rounded-lg border transition-colors
                          min-h-[44px] md:min-h-0
                          ${activityName === activity.name && !isNewActivity
                            ? 'bg-accent-green text-white border-accent-green'
                            : 'bg-white text-primary-black border-accent-gray/30 hover:border-accent-green active:bg-accent-green/10'
                          }`}
                      >
                        {activity.name}
                        <span className="ml-1 text-xs opacity-70">({activity.activity_type_display})</span>
                      </button>
                    ))}
                  </div>
                  {/* New activity input - mobile optimized */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                    <span className="text-xs text-accent-gray">或</span>
                    <input
                      type="text"
                      value={isNewActivity ? activityName : ''}
                      onChange={(e) => handleNewActivityName(e.target.value)}
                      placeholder="输入新活动名称"
                      className="w-full md:flex-1 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm border border-accent-gray/30 rounded-lg transition-colors
                        min-h-[48px] md:min-h-0
                        focus:outline-none focus:ring-2 focus:border-accent-green focus:ring-accent-green/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-accent-gray">当日暂无已上传的活动</p>
                  <input
                    type="text"
                    value={activityName}
                    onChange={(e) => handleNewActivityName(e.target.value)}
                    placeholder="输入活动名称（如：周末团建、新年晚会）"
                    className="w-full px-4 py-3 md:px-3 md:py-2.5 text-base md:text-sm border border-accent-gray/30 rounded-lg transition-colors
                      min-h-[48px] md:min-h-0
                      focus:outline-none focus:ring-2 focus:border-accent-green focus:ring-accent-green/20"
                  />
                </div>
              )}
              <p className="text-xs text-accent-gray">
                选择已有活动将自动使用其活动类型
              </p>
            </div>

            {/* Activity Type - Second */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                活动类型
                <span className="text-semantic-error">*</span>
              </div>
              
              {/* Select with mobile-optimized styling */}
              <select
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value);
                  if (errors.activityType) setErrors({ ...errors, activityType: undefined });
                }}
                disabled={loadingActivityTypes || (!isNewActivity && !!activityName && existingActivityNames.some(a => a.name === activityName))}
                className={`w-full px-4 py-3 md:px-3 md:py-2.5 text-base md:text-sm border rounded-lg transition-colors
                  min-h-[48px] md:min-h-0
                  appearance-none bg-white
                  ${errors.activityType 
                    ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20' 
                    : 'border-accent-gray/30 focus:border-accent-green focus:ring-accent-green/20'
                  }
                  focus:outline-none focus:ring-2
                  disabled:bg-accent-gray/10 disabled:cursor-not-allowed`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.25em 1.25em',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="">选择活动类型</option>
                {activityTypes.map((type) => (
                  <option key={type.id} value={type.value}>
                    {type.display_name}
                  </option>
                ))}
              </select>
              
              {!isNewActivity && activityName && existingActivityNames.some(a => a.name === activityName) && (
                <p className="text-xs text-accent-gray">
                  已自动选择该活动的类型
                </p>
              )}
              
              {errors.activityType && (
                <p className="text-xs text-semantic-error flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.activityType}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Database existing files warning */}
      {existingFiles.size > 0 && (
        <div className="px-4 md:px-6 pb-4">
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-semantic-error">以下文件名已存在于数据库中</p>
                <ul className="text-xs text-semantic-error/80 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {Array.from(existingFiles).map((filename, index) => (
                    <li key={index} className="truncate">• {filename}</li>
                  ))}
                </ul>
                <p className="text-xs text-semantic-error/80 mt-2">
                  请修改这些文件的自定义名称，或删除它们后再提交
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer with submit button - mobile optimized */}
      <div className="px-4 md:px-6 py-4 border-t border-accent-gray/10">
        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3">
          {isCheckingFilenames && (
            <div className="flex items-center justify-center gap-2 text-sm text-accent-gray">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-green border-t-transparent"></div>
              <span>检查文件名...</span>
            </div>
          )}
          <Button
            type="button"
            variant="success"
            size="lg"
            onClick={handleAddToQueue}
            disabled={!isFormValid || isCheckingFilenames}
            loading={isCheckingFilenames}
            className="w-full md:w-auto md:min-w-[160px] min-h-[48px] md:min-h-0"
          >
            {isCheckingFilenames ? '检查中...' : '添加到队列'}
          </Button>
        </div>
      </div>
    </div>
  );
}
