'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTagPresets } from '@/lib/hooks/useTagPresets';
import { addTagPreset, deactivateTagPreset } from '@/lib/api/tag-presets';
import { Button } from './Button';
import { showToast } from '@/lib/utils/toast';
import { TagPreset, AddTagPresetRequest } from '@/types';
import { AxiosError } from 'axios';
import { ApiError } from '@/types';

// Error messages for specific error codes
const errorMessages: Record<string, string> = {
  TAG_002: '标签预设已存在',
  TAG_003: '无权限管理标签预设',
};

export function TagPresetManager() {
  const queryClient = useQueryClient();
  
  // Load all tag presets
  const { data: allPresets = [], isLoading } = useTagPresets();
  
  // Form state for adding new preset
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPreset, setNewPreset] = useState<AddTagPresetRequest>({
    category: 'activity_type',
    value: '',
    display_name: '',
  });
  
  // Form errors
  const [formErrors, setFormErrors] = useState<{
    value?: string;
    display_name?: string;
  }>({});
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  // Group presets by category
  const activityTypePresets = allPresets.filter(
    (preset) => preset.category === 'activity_type'
  );
  const instructorPresets = allPresets.filter(
    (preset) => preset.category === 'instructor'
  );

  // Validate add form
  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};
    
    if (!newPreset.value.trim()) {
      errors.value = '请输入标签值';
    }
    
    if (!newPreset.display_name.trim()) {
      errors.display_name = '请输入显示名称';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle add preset
  const handleAddPreset = async () => {
    if (!validateForm()) {
      showToast.error('请填写所有必填字段');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await addTagPreset(newPreset);
      
      // Refresh tag presets list
      await queryClient.invalidateQueries({ queryKey: ['tag-presets'] });
      
      // Show success message
      showToast.success('标签预设添加成功');
      
      // Reset form
      setNewPreset({
        category: 'activity_type',
        value: '',
        display_name: '',
      });
      setFormErrors({});
      setIsAddingPreset(false);
    } catch (error) {
      console.error('Add preset error:', error);
      
      // Handle specific error codes
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<ApiError>;
        const errorCode = axiosError.response?.data?.code;
        
        if (errorCode && errorMessages[errorCode]) {
          showToast.error(errorMessages[errorCode]);
        } else {
          showToast.error(axiosError.response?.data?.message || '添加失败，请重试');
        }
      } else {
        showToast.error('添加失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deactivate preset
  const handleDeactivatePreset = async (presetId: number, displayName: string) => {
    if (!confirm(`确定要停用标签预设"${displayName}"吗？`)) {
      return;
    }

    setDeactivatingId(presetId);
    
    try {
      await deactivateTagPreset(presetId);
      
      // Refresh tag presets list
      await queryClient.invalidateQueries({ queryKey: ['tag-presets'] });
      
      // Show success message
      showToast.success('标签预设已停用');
    } catch (error) {
      console.error('Deactivate preset error:', error);
      
      // Handle specific error codes
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<ApiError>;
        const errorCode = axiosError.response?.data?.code;
        
        if (errorCode && errorMessages[errorCode]) {
          showToast.error(errorMessages[errorCode]);
        } else {
          showToast.error(axiosError.response?.data?.message || '停用失败，请重试');
        }
      } else {
        showToast.error('停用失败，请重试');
      }
    } finally {
      setDeactivatingId(null);
    }
  };

  // Render preset list for a category
  const renderPresetList = (presets: TagPreset[], categoryName: string) => (
    <div className="space-y-3">
      <h3 className="text-base md:text-lg font-semibold text-primary-black">
        {categoryName}
      </h3>
      
      {presets.length === 0 ? (
        <div className="text-sm text-accent-gray py-4">
          暂无{categoryName}预设
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="card-functional p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm md:text-base font-medium text-primary-black">
                    {preset.display_name}
                  </span>
                  <span
                    className={`
                      px-2 py-0.5 text-xs rounded-md
                      ${
                        preset.is_active
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-gray/20 text-accent-gray'
                      }
                    `}
                  >
                    {preset.is_active ? '启用' : '已停用'}
                  </span>
                </div>
                <div className="text-sm text-accent-gray">
                  值: {preset.value}
                </div>
              </div>
              
              {preset.is_active && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeactivatePreset(preset.id, preset.display_name)}
                  disabled={deactivatingId === preset.id}
                  loading={deactivatingId === preset.id}
                >
                  停用
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-accent-gray">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Preset Section */}
      <div className="card-functional p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-primary-black">
            添加标签预设
          </h2>
          {!isAddingPreset && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddingPreset(true)}
            >
              + 添加预设
            </Button>
          )}
        </div>

        {isAddingPreset && (
          <div className="space-y-4 pt-4 border-t border-accent-gray/20">
            {/* Category */}
            <div>
              <label
                htmlFor="preset-category"
                className="block text-sm md:text-sm font-medium text-primary-black mb-1.5"
              >
                类别
                <span className="text-semantic-error ml-1">*</span>
              </label>
              <select
                id="preset-category"
                value={newPreset.category}
                onChange={(e) =>
                  setNewPreset({
                    ...newPreset,
                    category: e.target.value as 'activity_type' | 'instructor',
                  })
                }
                disabled={isSubmitting}
                className="
                  input-functional
                  w-full
                  px-4 md:px-4
                  py-3 md:py-2
                  text-base md:text-base
                  text-primary-black
                  min-h-[44px]
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <option value="activity_type">活动类型</option>
                <option value="instructor">带训老师</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label
                htmlFor="preset-value"
                className="block text-sm md:text-sm font-medium text-primary-black mb-1.5"
              >
                标签值
                <span className="text-semantic-error ml-1">*</span>
              </label>
              <input
                id="preset-value"
                type="text"
                value={newPreset.value}
                onChange={(e) => {
                  setNewPreset({ ...newPreset, value: e.target.value });
                  if (formErrors.value) {
                    setFormErrors({ ...formErrors, value: undefined });
                  }
                }}
                placeholder="例如: routine_training"
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
                  ${formErrors.value ? 'error' : ''}
                `}
              />
              {formErrors.value && (
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
                    {formErrors.value}
                  </p>
                </div>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label
                htmlFor="preset-display-name"
                className="block text-sm md:text-sm font-medium text-primary-black mb-1.5"
              >
                显示名称
                <span className="text-semantic-error ml-1">*</span>
              </label>
              <input
                id="preset-display-name"
                type="text"
                value={newPreset.display_name}
                onChange={(e) => {
                  setNewPreset({ ...newPreset, display_name: e.target.value });
                  if (formErrors.display_name) {
                    setFormErrors({ ...formErrors, display_name: undefined });
                  }
                }}
                placeholder="例如: 例训"
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
                  ${formErrors.display_name ? 'error' : ''}
                `}
              />
              {formErrors.display_name && (
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
                    {formErrors.display_name}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setIsAddingPreset(false);
                  setNewPreset({
                    category: 'activity_type',
                    value: '',
                    display_name: '',
                  });
                  setFormErrors({});
                }}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                variant="success"
                size="md"
                onClick={handleAddPreset}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                添加
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preset Lists */}
      <div className="space-y-6">
        {/* Activity Type Presets */}
        <div className="card-functional p-4 md:p-6">
          {renderPresetList(activityTypePresets, '活动类型')}
        </div>

        {/* Instructor Presets */}
        <div className="card-functional p-4 md:p-6">
          {renderPresetList(instructorPresets, '带训老师')}
        </div>
      </div>
    </div>
  );
}
