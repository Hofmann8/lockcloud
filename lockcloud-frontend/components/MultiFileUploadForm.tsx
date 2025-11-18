'use client';

import { useState, useEffect } from 'react';
import { InlineCalendar } from './InlineCalendar';
import { FlexibleTagInput } from './FlexibleTagInput';
import { Button } from './Button';
import { useActivityTypes, useInstructors } from '@/lib/hooks/useTagPresets';
import { addTagPreset } from '@/lib/api/tag-presets';
import { checkFilenames } from '@/lib/api/files';
import { showToast } from '@/lib/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadQueueStore } from '@/stores/uploadQueueStore';

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

const UPLOAD_PREFS_KEY = 'lockcloud_upload_prefs';

interface UploadPreferences {
  lastActivityType?: string;
  lastInstructor?: string;
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
  const addTask = useUploadQueueStore(state => state.addTask);
  
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [activityDate, setActivityDate] = useState<string>(getCurrentDate());
  const [activityType, setActivityType] = useState<string>('');
  const [instructor, setInstructor] = useState<string>('');
  
  const [errors, setErrors] = useState<{
    activityDate?: string;
    activityType?: string;
    instructor?: string;
  }>({});

  const [isCheckingFilenames, setIsCheckingFilenames] = useState(false);

  const { data: activityTypes = [], isLoading: loadingActivityTypes } = useActivityTypes();
  const { data: instructors = [], isLoading: loadingInstructors } = useInstructors();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(UPLOAD_PREFS_KEY);
        if (saved) {
          const prefs: UploadPreferences = JSON.parse(saved);
          setActivityType(prefs.lastActivityType || '');
          setInstructor(prefs.lastInstructor || '');
        }
      } catch (error) {
        console.error('Failed to load upload preferences:', error);
      }
    }
  }, []);

  const savePreferences = () => {
    if (typeof window !== 'undefined') {
      try {
        const prefs: UploadPreferences = {
          lastActivityType: activityType,
          lastInstructor: instructor,
        };
        localStorage.setItem(UPLOAD_PREFS_KEY, JSON.stringify(prefs));
      } catch (error) {
        console.error('Failed to save upload preferences:', error);
      }
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
    if (!instructor) newErrors.instructor = '请选择带训老师';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkQueueDuplicates = (): { hasDuplicates: boolean; duplicateFiles: string[] } => {
    const queueTasks = useUploadQueueStore.getState().tasks;
    
    // Get all filenames from current form
    const currentFilenames = filesWithNames.map(item => {
      const customName = item.customFilename.trim();
      const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
      return customName ? `${customName}${extension}` : item.file.name;
    });
    
    const duplicates: string[] = [];
    
    // Check against pending and uploading tasks in the same directory
    queueTasks.forEach(task => {
      // Only check tasks in the same directory (same activity_type, year, month)
      if (task.activityType === activityType && 
          task.activityDate.startsWith(activityDate.substring(0, 7))) { // Same year-month
        
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
      duplicateFiles: [...new Set(duplicates)] // Remove duplicates
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

    // Check against queue
    const queueCheck = checkQueueDuplicates();
    if (queueCheck.hasDuplicates) {
      showToast.error(`检测到 ${queueCheck.duplicateFiles.length} 个文件名与队列中的任务重复`);
      // Show which files are duplicated
      alert(
        `以下文件名与队列中的任务重复：\n\n${queueCheck.duplicateFiles.join('\n')}\n\n` +
        `请修改这些文件的自定义名称后再提交。`
      );
      return;
    }

    // Check against database
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

      // Clear existing files check
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
      instructor,
    });

    savePreferences();
    showToast.success(`已添加 ${filesWithNames.length} 个文件到上传队列`);
    
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['directories'] });
    
    onUploadComplete();
  };

  const isFormValid = activityDate && activityType && instructor && filesWithNames.length > 0;

  const getFileDisplayName = (item: FileWithCustomName) => {
    const customName = item.customFilename.trim();
    const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
    return customName ? `${customName}${extension}` : item.file.name;
  };

  if (filesWithNames.length === 0) return null;

  return (
    <div className="card-functional overflow-hidden">
      <div className="px-6 py-4 border-b border-accent-gray/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-green/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary-black">
              已选择 {filesWithNames.length} 个文件
            </p>
            <p className="text-xs text-accent-gray">
              总大小: {formatFileSize(filesWithNames.reduce((sum, f) => sum + f.file.size, 0))}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
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

          <div className="space-y-4">
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
                  if (errors.activityDate) setErrors({ ...errors, activityDate: undefined });
                }}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg transition-colors
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

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                活动类型
                <span className="text-semantic-error">*</span>
              </div>
              
              <FlexibleTagInput
                label=""
                value={activityType}
                onChange={(value) => {
                  setActivityType(value);
                  if (errors.activityType) setErrors({ ...errors, activityType: undefined });
                }}
                options={activityTypes}
                placeholder="选择或添加活动类型"
                required
                error={errors.activityType}
                disabled={loadingActivityTypes}
                allowCustom={true}
                onAddNew={async (value, displayName) => {
                  try {
                    await addTagPreset({
                      category: 'activity_type',
                      value,
                      display_name: displayName,
                    });
                    queryClient.invalidateQueries({ queryKey: ['tag-presets', 'activity_type'] });
                    showToast.success(`已添加新活动类型：${displayName}`);
                  } catch (error) {
                    console.error('Failed to add activity type:', error);
                    showToast.error('添加活动类型失败');
                    throw error;
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                带训老师
                <span className="text-semantic-error">*</span>
              </div>
              
              <FlexibleTagInput
                label=""
                value={instructor}
                onChange={(value) => {
                  setInstructor(value);
                  if (errors.instructor) setErrors({ ...errors, instructor: undefined });
                }}
                options={instructors}
                placeholder="选择或添加带训老师"
                required
                error={errors.instructor}
                disabled={loadingInstructors}
                allowCustom={true}
                onAddNew={async (value, displayName) => {
                  try {
                    await addTagPreset({
                      category: 'instructor',
                      value,
                      display_name: displayName,
                    });
                    queryClient.invalidateQueries({ queryKey: ['tag-presets', 'instructor'] });
                    showToast.success(`已添加新带训老师：${displayName}`);
                  } catch (error) {
                    console.error('Failed to add instructor:', error);
                    showToast.error('添加带训老师失败');
                    throw error;
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Database existing files warning */}
      {existingFiles.size > 0 && (
        <div className="px-6 pb-4">
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-semantic-error">以下文件名已存在于数据库中</p>
                <ul className="text-xs text-semantic-error/80 mt-1 space-y-0.5">
                  {Array.from(existingFiles).map((filename, index) => (
                    <li key={index}>• {filename}</li>
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

      <div className="px-6 py-4 border-t border-accent-gray/10 flex justify-end gap-3">
        {isCheckingFilenames && (
          <div className="flex items-center gap-2 text-sm text-accent-gray">
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
          className="min-w-[160px]"
        >
          {isCheckingFilenames ? '检查中...' : '添加到队列'}
        </Button>
      </div>
    </div>
  );
}
