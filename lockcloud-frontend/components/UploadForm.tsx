'use client';

import { useState, useEffect } from 'react';
import { InlineCalendar } from './InlineCalendar';
import { FlexibleTagInput } from './FlexibleTagInput';
import { Button } from './Button';
import { useActivityTypes, useInstructors } from '@/lib/hooks/useTagPresets';
import { getUploadUrl, confirmUpload } from '@/lib/api/files';
import { addTagPreset } from '@/lib/api/tag-presets';
import { showToast } from '@/lib/utils/toast';
import axios, { AxiosError } from 'axios';
import { ApiError } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

interface UploadFormProps {
  selectedFile: File | null;
  onUploadComplete: () => void;
}

// LocalStorage keys for remembering user preferences
const UPLOAD_PREFS_KEY = 'lockcloud_upload_prefs';

interface UploadPreferences {
  lastActivityType?: string;
  lastInstructor?: string;
}

// Error messages for specific error codes
const errorMessages: Record<string, string> = {
  FILE_007: '活动日期格式无效，应为YYYY-MM-DD格式',
  FILE_008: '活动类型无效，请从列表中选择',
  FILE_009: '带训老师标签无效，请从列表中选择',
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export function UploadForm({ selectedFile, onUploadComplete }: UploadFormProps) {
  const queryClient = useQueryClient();
  
  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Form state
  const [activityDate, setActivityDate] = useState<string>(getCurrentDate());
  const [activityType, setActivityType] = useState<string>('');
  const [instructor, setInstructor] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  
  // Error state
  const [errors, setErrors] = useState<{
    activityDate?: string;
    activityType?: string;
    instructor?: string;
    customFilename?: string;
  }>({});

  // Load tag presets
  const { data: activityTypes = [], isLoading: loadingActivityTypes } = useActivityTypes();
  const { data: instructors = [], isLoading: loadingInstructors } = useInstructors();

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(UPLOAD_PREFS_KEY);
        if (saved) {
          const prefs: UploadPreferences = JSON.parse(saved);
          if (prefs.lastActivityType) {
            setActivityType(prefs.lastActivityType);
          }
          if (prefs.lastInstructor) {
            setInstructor(prefs.lastInstructor);
          }
        }
      } catch (error) {
        console.error('Failed to load upload preferences:', error);
      }
    }
  }, []);

  // Save preferences to localStorage
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!activityDate) {
      newErrors.activityDate = '请选择活动日期';
    }
    
    if (!activityType) {
      newErrors.activityType = '请选择活动类型';
    }
    
    if (!instructor) {
      newErrors.instructor = '请选择带训老师';
    }
    
    // Validate custom filename if provided
    if (customFilename.trim()) {
      const filename = customFilename.trim();
      // Check for invalid characters
      if (/[<>:"/\\|?*\x00-\x1f]/.test(filename)) {
        newErrors.customFilename = '文件名包含非法字符';
      }
      // Check length
      if (filename.length > 200) {
        newErrors.customFilename = '文件名过长（最多200字符）';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    // Validate form
    if (!validateForm()) {
      showToast.error('请填写所有必填字段');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    
    try {
      // Step 1: Get upload URL
      const uploadUrlData = await getUploadUrl({
        original_filename: selectedFile.name,
        content_type: selectedFile.type,
        size: selectedFile.size,
        activity_date: activityDate,
        activity_type: activityType,
        instructor: instructor,
        custom_filename: customFilename.trim() || undefined,
      });

      // Step 2: Upload to S3 with progress tracking using axios
      await axios.put(uploadUrlData.upload_url, selectedFile, {
        headers: {
          'Content-Type': selectedFile.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percentComplete);
            setUploadedBytes(progressEvent.loaded);
            setTotalBytes(progressEvent.total);
          }
        },
      });

      // Step 3: Confirm upload
      await confirmUpload({
        s3_key: uploadUrlData.s3_key,
        size: selectedFile.size,
        content_type: selectedFile.type,
        original_filename: selectedFile.name,
        activity_date: activityDate,
        activity_type: activityType,
        instructor: instructor,
      });

      // Save preferences
      savePreferences();

      // Invalidate queries to refresh file list and directory tree
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['directories'] });

      // Show success message
      showToast.success('文件上传成功');

      // Reset form
      setActivityDate(getCurrentDate());
      setActivityType('');
      setInstructor('');
      setCustomFilename('');
      setErrors({});

      // Call completion callback
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      
      // Handle specific error codes
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<ApiError>;
        const errorCode = axiosError.response?.data?.code;
        
        if (errorCode && errorMessages[errorCode]) {
          // Set field-specific error
          if (errorCode === 'FILE_007') {
            setErrors({ ...errors, activityDate: errorMessages[errorCode] });
          } else if (errorCode === 'FILE_008') {
            setErrors({ ...errors, activityType: errorMessages[errorCode] });
          } else if (errorCode === 'FILE_009') {
            setErrors({ ...errors, instructor: errorMessages[errorCode] });
          }
          
          // Show toast
          showToast.error(errorMessages[errorCode]);
        } else {
          showToast.error(axiosError.response?.data?.message || '上传失败，请重试');
        }
      } else {
        showToast.error('上传失败，请重试');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
    }
  };

  // Check if form is valid
  const isFormValid = activityDate && activityType && instructor && selectedFile;

  if (!selectedFile) {
    return null;
  }

  return (
    <div className="card-functional overflow-hidden">
      {/* File Info Header */}
      <div className="px-6 py-4 border-b border-accent-gray/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-green/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary-black truncate" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <p className="text-xs text-accent-gray">
              {formatFileSize(selectedFile.size)} • {selectedFile.type || '未知类型'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Grid Layout */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Calendar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
              <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              活动日期
              <span className="text-semantic-error">*</span>
            </div>
            
            {/* Inline Calendar */}
            <InlineCalendar
              value={activityDate}
              onChange={(value) => {
                setActivityDate(value);
                if (errors.activityDate) {
                  setErrors({ ...errors, activityDate: undefined });
                }
              }}
              disabled={isUploading}
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

          {/* Right: Tags and Filename */}
          <div className="space-y-4">
            {/* Custom Filename */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-black">
                <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                自定义文件名
                <span className="text-xs text-accent-gray font-normal">（可选）</span>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => {
                    setCustomFilename(e.target.value);
                    if (errors.customFilename) {
                      setErrors({ ...errors, customFilename: undefined });
                    }
                  }}
                  placeholder={selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : '留空使用原文件名'}
                  disabled={isUploading}
                  className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors
                    ${errors.customFilename 
                      ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20' 
                      : 'border-accent-gray/30 focus:border-accent-green focus:ring-accent-green/20'
                    }
                    focus:outline-none focus:ring-2
                    disabled:bg-accent-gray/5 disabled:cursor-not-allowed
                    placeholder:text-accent-gray/50`}
                />
                {selectedFile && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent-gray pointer-events-none">
                    {selectedFile.name.match(/\.[^/.]+$/)?.[0] || ''}
                  </div>
                )}
              </div>
              
              {errors.customFilename && (
                <p className="text-xs text-semantic-error flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.customFilename}
                </p>
              )}
              
              {!errors.customFilename && customFilename.trim() && selectedFile && (
                <p className="text-xs text-accent-gray flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  将保存为: {customFilename.trim()}{selectedFile.name.match(/\.[^/.]+$/)?.[0] || ''}
                </p>
              )}
            </div>

            {/* Activity Type */}
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
                  if (errors.activityType) {
                    setErrors({ ...errors, activityType: undefined });
                  }
                }}
                options={activityTypes}
                placeholder="选择或添加活动类型"
                required
                error={errors.activityType}
                disabled={isUploading || loadingActivityTypes}
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

            {/* Instructor */}
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
                  if (errors.instructor) {
                    setErrors({ ...errors, instructor: undefined });
                  }
                }}
                options={instructors}
                placeholder="选择或添加带训老师"
                required
                error={errors.instructor}
                disabled={isUploading || loadingInstructors}
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

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-6 pt-6 border-t border-accent-gray/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-primary-black flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin text-accent-green" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                上传中...
              </span>
              <div className="text-right">
                <div className="text-sm font-bold text-accent-green">
                  {uploadProgress}%
                </div>
                <div className="text-xs text-accent-gray">
                  {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
                </div>
              </div>
            </div>
            <div className="w-full h-2 bg-accent-gray/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-green transition-all duration-150 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-accent-gray/10 flex justify-end">
        <Button
          type="button"
          variant="success"
          size="lg"
          onClick={handleUpload}
          disabled={!isFormValid || isUploading}
          loading={isUploading}
          className="min-w-[160px]"
        >
          {isUploading ? '上传中...' : '开始上传'}
        </Button>
      </div>
    </div>
  );
}
