'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { updateFile } from '@/lib/api/files';
import { getTagPresets } from '@/lib/api/tag-presets';
import { File } from '@/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

interface EditFileDialogProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditFileDialog({ file, isOpen, onClose, onSuccess }: EditFileDialogProps) {
  const [activityDate, setActivityDate] = useState(file.activity_date || '');
  const [activityType, setActivityType] = useState(file.activity_type || '');
  const [instructor, setInstructor] = useState(file.instructor || '');

  // Load tag presets
  const { data: activityTypePresets } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
  });

  const { data: instructorPresets } = useQuery({
    queryKey: ['tagPresets', 'instructor'],
    queryFn: () => getTagPresets('instructor'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { activity_date?: string; activity_type?: string; instructor?: string }) =>
      updateFile(file.id, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: { activity_date?: string; activity_type?: string; instructor?: string } = {};
    
    if (activityDate !== file.activity_date) {
      updates.activity_date = activityDate;
    }
    if (activityType !== file.activity_type) {
      updates.activity_type = activityType;
    }
    if (instructor !== file.instructor) {
      updates.instructor = instructor;
    }

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const activityTypeOptions = activityTypePresets || [];
  const instructorOptions = instructorPresets || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card variant="bordered" padding="lg" className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-primary-black">编辑文件信息</h2>
            <button
              onClick={onClose}
              className="text-accent-gray hover:text-primary-black transition-colors"
              aria-label="关闭"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-sm text-accent-gray">
            <p className="font-medium">{file.filename}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Activity Date */}
            <div>
              <label htmlFor="activityDate" className="block text-sm font-medium text-primary-black mb-1">
                活动日期 *
              </label>
              <input
                type="date"
                id="activityDate"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
              />
            </div>

            {/* Activity Type */}
            <div>
              <label htmlFor="activityType" className="block text-sm font-medium text-primary-black mb-1">
                活动标签 *
              </label>
              <select
                id="activityType"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                required
                className="w-full px-3 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
              >
                <option value="">请选择活动标签</option>
                {activityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Instructor */}
            <div>
              <label htmlFor="instructor" className="block text-sm font-medium text-primary-black mb-1">
                带训人 *
              </label>
              <select
                id="instructor"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                required
                className="w-full px-3 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
              >
                <option value="">请选择带训人</option>
                {instructorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Message */}
            {updateMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  {(updateMutation.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || '更新失败，请重试'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={updateMutation.isPending}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={updateMutation.isPending}
                className="flex-1"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
