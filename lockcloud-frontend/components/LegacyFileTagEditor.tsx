'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from './Modal';
import { TagSelector } from './TagSelector';
import { File } from '@/types';
import { useActivityTypes, useInstructors } from '@/lib/hooks/useTagPresets';
import { updateFileTags } from '@/lib/api/files';
import { showToast } from '@/lib/utils/toast';
import { AxiosError } from 'axios';
import { ApiError } from '@/types';

interface LegacyFileTagEditorProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Error messages for specific error codes
const errorMessages: Record<string, string> = {
  FILE_007: '活动日期格式无效，应为YYYY-MM-DD格式',
  FILE_008: '活动类型无效，请从列表中选择',
  FILE_009: '带训老师标签无效，请从列表中选择',
};

export function LegacyFileTagEditor({
  file,
  isOpen,
  onClose,
  onSuccess,
}: LegacyFileTagEditorProps) {
  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Form state
  const [activityDate, setActivityDate] = useState<string>(getCurrentDate());
  const [activityType, setActivityType] = useState<string>('');
  const [instructor, setInstructor] = useState<string>('');
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Error state
  const [errors, setErrors] = useState<{
    activityDate?: string;
    activityType?: string;
    instructor?: string;
  }>({});

  // Load tag presets
  const { data: activityTypes = [], isLoading: loadingActivityTypes } = useActivityTypes();
  const { data: instructors = [], isLoading: loadingInstructors } = useInstructors();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivityDate(getCurrentDate());
      setActivityType('');
      setInstructor('');
      setErrors({});
    }
  }, [isOpen]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} 字节`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Format upload date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      showToast.error('请填写所有必填字段');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Call API to update file tags
      await updateFileTags(file.id, {
        activity_date: activityDate,
        activity_type: activityType,
        instructor: instructor,
      });

      // Show success message
      showToast.success('标签补充成功');

      // Call success callback to refresh file list
      onSuccess();
    } catch (error) {
      console.error('Update tags error:', error);
      
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
          showToast.error(axiosError.response?.data?.message || '标签补充失败，请重试');
        }
      } else {
        showToast.error('标签补充失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="补充文件标签"
      size="md"
      closeOnBackdrop={!isSubmitting}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleSubmit}
          cancelText="取消"
          confirmText="保存标签"
          confirmVariant="success"
          isLoading={isSubmitting}
        />
      }
    >
      <div className="space-y-4 md:space-y-5">
        {/* File Information */}
        <div className="hand-drawn-border bg-accent-gray/5 p-4 space-y-2">
          <h3 className="font-semibold text-primary-black mb-2">文件信息</h3>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-accent-gray min-w-[80px]">文件名：</span>
            <span className="text-primary-black break-all">{file.filename}</span>
          </div>
          
          {file.original_filename && (
            <div className="flex items-start gap-2">
              <span className="font-medium text-accent-gray min-w-[80px]">原始文件名：</span>
              <span className="text-primary-black break-all">{file.original_filename}</span>
            </div>
          )}
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-accent-gray min-w-[80px]">文件大小：</span>
            <span className="text-primary-black">{formatSize(file.size)}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-accent-gray min-w-[80px]">上传日期：</span>
            <span className="text-primary-black">{formatDate(file.uploaded_at)}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-accent-gray min-w-[80px]">上传者：</span>
            <span className="text-primary-black">{file.uploader?.name || 'Unknown'}</span>
          </div>
        </div>

        {/* Tag Selection Form */}
        <div className="space-y-4">
          <h3 className="font-semibold text-primary-black">标签信息</h3>
          
          {/* Activity Date */}
          <div>
            <label
              htmlFor="legacy-activity-date"
              className="block text-sm md:text-sm font-medium text-primary-black mb-1.5 md:mb-1.5"
            >
              活动日期
              <span className="text-semantic-error ml-1">*</span>
            </label>
            <input
              id="legacy-activity-date"
              type="date"
              value={activityDate}
              onChange={(e) => {
                setActivityDate(e.target.value);
                if (errors.activityDate) {
                  setErrors({ ...errors, activityDate: undefined });
                }
              }}
              disabled={isSubmitting}
              className={`
                input-functional
                w-full
                px-4 md:px-4
                py-3 md:py-2
                text-base md:text-base
                text-primary-black
                min-h-[44px]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${errors.activityDate ? 'error' : ''}
              `}
            />
            {errors.activityDate && (
              <div className="mt-1.5 flex items-start gap-1.5">
                <svg
                  className="w-4 h-4 text-semantic-error shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm md:text-sm text-semantic-error leading-relaxed">
                  {errors.activityDate}
                </p>
              </div>
            )}
          </div>

          {/* Activity Type */}
          <TagSelector
            label="活动类型"
            value={activityType}
            onChange={(value) => {
              setActivityType(value);
              if (errors.activityType) {
                setErrors({ ...errors, activityType: undefined });
              }
            }}
            options={activityTypes}
            placeholder="请选择活动类型"
            required
            error={errors.activityType}
            disabled={isSubmitting || loadingActivityTypes}
          />

          {/* Instructor */}
          <TagSelector
            label="带训老师"
            value={instructor}
            onChange={(value) => {
              setInstructor(value);
              if (errors.instructor) {
                setErrors({ ...errors, instructor: undefined });
              }
            }}
            options={instructors}
            placeholder="请选择带训老师"
            required
            error={errors.instructor}
            disabled={isSubmitting || loadingInstructors}
          />
        </div>
      </div>
    </Modal>
  );
}
