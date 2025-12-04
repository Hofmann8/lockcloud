'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateFile } from '@/lib/api/files';
import { createRequest } from '@/lib/api/requests';
import { getTagPresets } from '@/lib/api/tag-presets';
import { searchTags } from '@/lib/api/tags';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/Button';
import { useIsMobile } from '@/lib/hooks/useMediaQuery';
import toast from 'react-hot-toast';

interface EditFileDialogProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UpdateData {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
  filename?: string;
  free_tags?: string[];
}

export function EditFileDialog({ file, isOpen, onClose, onSuccess }: EditFileDialogProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isOwner = user?.id === file.uploader_id;
  const isAdmin = user?.is_admin || false;
  const canDirectEdit = isOwner || isAdmin;

  const [filename, setFilename] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityName, setActivityName] = useState('');
  const [freeTags, setFreeTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [lastFileId, setLastFileId] = useState<number | null>(null);

  // Reset form when dialog opens with a different file
  if (isOpen && file.id !== lastFileId) {
    setLastFileId(file.id);
    setFilename(file.filename || '');
    setActivityDate(file.activity_date || '');
    setActivityType(file.activity_type || '');
    setActivityName(file.activity_name || '');
    setFreeTags(file.free_tags?.map(t => t.name) || []);
    setTagInput('');
  }

  const { data: activityTypePresets } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
  });

  const { data: tagSuggestions } = useQuery({
    queryKey: ['tags', 'search', tagInput],
    queryFn: () => searchTags(tagInput, 5),
    enabled: tagInput.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateData) => updateFile(file.id, data),
    onSuccess: () => {
      toast.success('文件信息已更新');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      onSuccess();
      onClose();
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '更新失败');
    },
  });

  const requestMutation = useMutation({
    mutationFn: (data: UpdateData) =>
      createRequest({
        file_id: file.id,
        request_type: 'edit',
        proposed_changes: data,
      }),
    onSuccess: () => {
      toast.success('修改请求已发送给文件上传者');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '发送请求失败');
    },
  });

  const handleAddTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !freeTags.includes(trimmed)) {
      setFreeTags([...freeTags, trimmed]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleRemoveTag = (tagName: string) => {
    setFreeTags(freeTags.filter(t => t !== tagName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: UpdateData = {};
    
    if (filename && filename !== file.filename) {
      updates.filename = filename;
    }
    if (activityDate && activityDate !== file.activity_date) {
      updates.activity_date = activityDate;
    }
    if (activityType && activityType !== file.activity_type) {
      updates.activity_type = activityType;
    }
    if (activityName !== file.activity_name) {
      updates.activity_name = activityName || undefined;
    }
    
    const originalTags = file.free_tags?.map(t => t.name) || [];
    const tagsChanged = freeTags.length !== originalTags.length || 
      freeTags.some(t => !originalTags.includes(t)) ||
      originalTags.some(t => !freeTags.includes(t));
    if (tagsChanged) {
      updates.free_tags = freeTags;
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
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  // Mobile: full screen from bottom, Desktop: centered modal
  const containerStyles = isMobile
    ? 'items-end p-0'
    : 'items-center justify-center p-4';
  
  const modalStyles = isMobile
    ? 'rounded-t-2xl rounded-b-none max-h-[95vh] inset-x-0 bottom-0'
    : 'rounded-2xl max-w-lg max-h-[85vh]';

  return (
    <div className={`fixed inset-0 z-50 flex ${containerStyles} bg-black/40 backdrop-blur-sm`} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-xl border border-gray-200 w-full ${modalStyles} overflow-hidden flex flex-col`}
        style={{
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
        )}
        
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-100 shrink-0 ${isMobile ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-base'}`}>
            {canDirectEdit ? '编辑文件' : '请求修改'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - scrollable area */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'px-4 py-3' : 'px-5 py-4'}`}>
          {/* File info banner */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-5">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
              <p className="text-xs text-gray-500">上传者: {file.uploader?.name || '未知'}</p>
            </div>
          </div>

          {!canDirectEdit && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl mb-5">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-amber-700">您不是此文件的上传者，修改将发送给上传者审批</p>
            </div>
          )}

          <form id="edit-file-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Filename */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">文件名</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all min-h-[44px]"
              />
            </div>

            {/* Date and Type row - Always stack on mobile for single column layout */}
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">活动日期</label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">活动类型</label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all min-h-[44px]"
                >
                  <option value="">请选择</option>
                  {activityTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Activity name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">活动名称</label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="例如：周末团建、新年晚会"
                className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-gray-400 min-h-[44px]"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">自由标签</label>
              <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                {freeTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {freeTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white text-gray-700 rounded-lg shadow-sm">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (tagInput.trim()) handleAddTag(tagInput); } }}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder={freeTags.length === 0 ? "输入标签后按回车添加" : "添加更多标签..."}
                    className="w-full px-3 py-2.5 text-base bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 transition-all placeholder:text-gray-400 min-h-[44px]"
                  />
                  {showTagSuggestions && tagSuggestions && tagSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {tagSuggestions.map((tag) => (
                        <button key={tag.id} type="button" onClick={() => handleAddTag(tag.name)} className="w-full px-3 py-3 text-left text-base hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]">
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - fixed at bottom */}
        <div className={`flex gap-3 border-t border-gray-100 bg-gray-50/50 shrink-0 ${isMobile ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending} className={`flex-1 ${isMobile ? 'min-h-[48px]' : ''}`}>
            取消
          </Button>
          <Button type="submit" form="edit-file-form" variant="primary" disabled={isPending} className={`flex-1 ${isMobile ? 'min-h-[48px]' : ''}`}>
            {isPending ? '处理中...' : (canDirectEdit ? '保存修改' : '发送请求')}
          </Button>
        </div>
      </div>
    </div>
  );
}
