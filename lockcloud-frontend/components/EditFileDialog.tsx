'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { updateFile } from '@/lib/api/files';
import { createRequest } from '@/lib/api/requests';
import { getTagPresets } from '@/lib/api/tag-presets';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import toast from 'react-hot-toast';

interface EditFileDialogProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 内部表单组件，通过 key 重置状态
function EditFileForm({ 
  file, 
  canDirectEdit, 
  onClose, 
  onSuccess 
}: { 
  file: File; 
  canDirectEdit: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [activityDate, setActivityDate] = useState(file.activity_date || '');
  const [activityType, setActivityType] = useState(file.activity_type || '');
  const [activityName, setActivityName] = useState(file.activity_name || '');

  const { data: activityTypePresets } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { activity_date?: string; activity_type?: string; activity_name?: string }) =>
      updateFile(file.id, data),
    onSuccess: () => {
      toast.success('文件信息已更新');
      onSuccess();
      onClose();
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '更新失败');
    },
  });

  const requestMutation = useMutation({
    mutationFn: (data: { activity_date?: string; activity_type?: string; activity_name?: string }) =>
      createRequest({
        file_id: file.id,
        request_type: 'edit',
        proposed_changes: data,
      }),
    onSuccess: () => {
      toast.success('修改请求已发送给文件上传者');
      onClose();
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '发送请求失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: { activity_date?: string; activity_type?: string; activity_name?: string } = {};
    
    if (activityDate && activityDate !== file.activity_date) {
      updates.activity_date = activityDate;
    }
    if (activityType && activityType !== file.activity_type) {
      updates.activity_type = activityType;
    }
    if (activityName !== file.activity_name) {
      updates.activity_name = activityName || undefined;
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    if (canDirectEdit) {
      updateMutation.mutate(updates);
    } else {
      requestMutation.mutate(updates);
    }
  };

  const isPending = updateMutation.isPending || requestMutation.isPending;

  const activityTypeOptions = activityTypePresets || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="activityDate" className="block text-sm font-medium text-primary-black mb-1">
          活动日期
        </label>
        <input
          type="date"
          id="activityDate"
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div>
        <label htmlFor="activityType" className="block text-sm font-medium text-primary-black mb-1">
          活动类型
        </label>
        <select
          id="activityType"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        >
          <option value="">请选择</option>
          {activityTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.display_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="activityName" className="block text-sm font-medium text-primary-black mb-1">
          活动名称
        </label>
        <input
          type="text"
          id="activityName"
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
          placeholder="例如：周末团建、新年晚会"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending} className="flex-1">
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
          {isPending ? '处理中...' : (canDirectEdit ? '保存' : '发送请求')}
        </Button>
      </div>
    </form>
  );
}

export function EditFileDialog({ file, isOpen, onClose, onSuccess }: EditFileDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isOwner = user?.id === file.uploader_id;
  const isAdmin = user?.is_admin || false;
  const canDirectEdit = isOwner || isAdmin;

  const formKey = useMemo(() => `${file.id}-${isOpen}`, [file.id, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Card 
          variant="bordered" 
          padding="lg" 
          className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary-black">
              {canDirectEdit ? '编辑文件信息' : '请求修改文件'}
            </h2>
            <button onClick={onClose} className="text-accent-gray hover:text-primary-black transition-colors" aria-label="关闭">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-sm text-accent-gray bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-primary-black truncate">{file.filename}</p>
            <p className="text-xs mt-1">上传者: {file.uploader?.name || '未知'}</p>
          </div>

          {!canDirectEdit && (
            <div className="text-xs text-orange-600 bg-orange-50 rounded-lg p-3">
              <p>您不是此文件的上传者，修改将以请求形式发送给上传者审批。</p>
            </div>
          )}

          <EditFileForm key={formKey} file={file} canDirectEdit={canDirectEdit} onClose={onClose} onSuccess={onSuccess} />
        </div>
      </Card>
      </div>
    </div>
  );
}
