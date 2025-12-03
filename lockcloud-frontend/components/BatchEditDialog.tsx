'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTagPresets } from '@/lib/api/tag-presets';
import { batchUpdateFiles, batchCreateRequests, BatchUpdateData, BatchUpdateResult } from '@/lib/api/files';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/Button';
import toast from 'react-hot-toast';

interface BatchEditDialogProps {
  files: File[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UpdateData {
  activity_date?: string;
  activity_type?: string;
  activity_name?: string;
}

interface ConfirmationSummary {
  directUpdates: File[];
  requestUpdates: File[];
  changes: UpdateData;
}

export function BatchEditDialog({ files, isOpen, onClose, onSuccess }: BatchEditDialogProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.is_admin || false;

  // Form states - use undefined to indicate "no change"
  const [activityDate, setActivityDate] = useState<string | undefined>(undefined);
  const [activityType, setActivityType] = useState<string | undefined>(undefined);
  const [activityName, setActivityName] = useState<string | undefined>(undefined);

  // Confirmation dialog state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationSummary, setConfirmationSummary] = useState<ConfirmationSummary | null>(null);

  // Categorize files by ownership
  const { ownFiles, otherFiles } = useMemo(() => {
    const own: File[] = [];
    const other: File[] = [];
    files.forEach(file => {
      if (file.uploader_id === user?.id || isAdmin) {
        own.push(file);
      } else {
        other.push(file);
      }
    });
    return { ownFiles: own, otherFiles: other };
  }, [files, user?.id, isAdmin]);

  const { data: activityTypePresets } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
  });

  // Batch update mutation for own files
  const batchUpdateMutation = useMutation({
    mutationFn: (data: { fileIds: number[]; updates: BatchUpdateData }) => 
      batchUpdateFiles(data.fileIds, data.updates),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`成功更新 ${result.results?.succeeded?.length || 0} 个文件`);
      } else if (result.results) {
        const successCount = result.results.succeeded?.length || 0;
        const failCount = result.results.failed?.length || 0;
        if (successCount > 0) toast.success(`成功更新 ${successCount} 个文件`);
        if (failCount > 0) toast.error(`${failCount} 个文件更新失败`);
      }
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '批量更新失败');
    },
  });

  // Batch request mutation for other's files
  const batchRequestMutation = useMutation({
    mutationFn: (data: { fileIds: number[]; proposedChanges: UpdateData }) =>
      batchCreateRequests(data.fileIds, data.proposedChanges),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`成功发送 ${result.results?.succeeded?.length || 0} 个修改请求`);
      } else if (result.results) {
        const successCount = result.results.succeeded?.length || 0;
        const failCount = result.results.failed?.length || 0;
        if (successCount > 0) toast.success(`成功发送 ${successCount} 个修改请求`);
        if (failCount > 0) toast.error(`${failCount} 个请求发送失败`);
      }
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '发送请求失败');
    },
  });

  const buildUpdates = (): UpdateData => {
    const updates: UpdateData = {};
    if (activityDate !== undefined) updates.activity_date = activityDate;
    if (activityType !== undefined) updates.activity_type = activityType;
    if (activityName !== undefined) updates.activity_name = activityName;
    return updates;
  };

  const handlePreviewChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const updates = buildUpdates();
    if (Object.keys(updates).length === 0) {
      toast.error('请至少选择一项要修改的内容');
      return;
    }
    setConfirmationSummary({ directUpdates: ownFiles, requestUpdates: otherFiles, changes: updates });
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmationSummary) return;
    const { directUpdates, requestUpdates, changes } = confirmationSummary;
    const promises: Promise<BatchUpdateResult>[] = [];

    if (directUpdates.length > 0) {
      promises.push(batchUpdateMutation.mutateAsync({ fileIds: directUpdates.map(f => f.id), updates: changes }));
    }
    if (requestUpdates.length > 0) {
      promises.push(batchRequestMutation.mutateAsync({ fileIds: requestUpdates.map(f => f.id), proposedChanges: changes }));
    }

    try {
      await Promise.all(promises);
      onSuccess();
      handleClose();
    } catch { /* Errors handled in mutation callbacks */ }
  };

  const handleClose = () => {
    setActivityDate(undefined);
    setActivityType(undefined);
    setActivityName(undefined);
    setShowConfirmation(false);
    setConfirmationSummary(null);
    onClose();
  };

  const isPending = batchUpdateMutation.isPending || batchRequestMutation.isPending;
  const activityTypeOptions = activityTypePresets || [];

  if (!isOpen) return null;

  // Confirmation Dialog
  if (showConfirmation && confirmationSummary) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">确认批量修改</h2>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-130px)] space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl space-y-2">
              <h3 className="text-sm font-medium text-gray-700">修改内容</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {confirmationSummary.changes.activity_date && <p>• 活动日期: {confirmationSummary.changes.activity_date}</p>}
                {confirmationSummary.changes.activity_type && <p>• 活动类型: {activityTypeOptions.find(o => o.value === confirmationSummary.changes.activity_type)?.display_name || confirmationSummary.changes.activity_type}</p>}
                {confirmationSummary.changes.activity_name !== undefined && <p>• 活动名称: {confirmationSummary.changes.activity_name || '(清空)'}</p>}
              </div>
            </div>
            {confirmationSummary.directUpdates.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  <h3 className="text-sm font-medium text-green-700">直接修改 ({confirmationSummary.directUpdates.length} 个文件)</h3>
                </div>
                <p className="text-xs text-green-600 mb-2">这些是您上传的文件，将立即生效</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {confirmationSummary.directUpdates.slice(0, 5).map(file => <p key={file.id} className="text-xs text-green-700 truncate">• {file.filename}</p>)}
                  {confirmationSummary.directUpdates.length > 5 && <p className="text-xs text-green-600">...还有 {confirmationSummary.directUpdates.length - 5} 个文件</p>}
                </div>
              </div>
            )}
            {confirmationSummary.requestUpdates.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <h3 className="text-sm font-medium text-amber-700">发送请求 ({confirmationSummary.requestUpdates.length} 个文件)</h3>
                </div>
                <p className="text-xs text-amber-600 mb-2">这些是他人上传的文件，修改请求将发送给上传者审批</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {confirmationSummary.requestUpdates.slice(0, 5).map(file => <p key={file.id} className="text-xs text-amber-700 truncate">• {file.filename} (上传者: {file.uploader?.name || '未知'})</p>)}
                  {confirmationSummary.requestUpdates.length > 5 && <p className="text-xs text-amber-600">...还有 {confirmationSummary.requestUpdates.length - 5} 个文件</p>}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <Button type="button" variant="secondary" onClick={() => setShowConfirmation(false)} disabled={isPending} className="flex-1">返回修改</Button>
            <Button type="button" variant="primary" onClick={handleConfirmSubmit} disabled={isPending} className="flex-1">{isPending ? '处理中...' : '确认提交'}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Main Edit Form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">批量编辑 ({files.length} 个文件)</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-130px)]">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-5">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <div className="text-xs text-blue-700">
              <p>已选择 {files.length} 个文件</p>
              {ownFiles.length > 0 && <p>• {ownFiles.length} 个您上传的文件 (直接修改)</p>}
              {otherFiles.length > 0 && <p>• {otherFiles.length} 个他人上传的文件 (发送请求)</p>}
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">留空的字段将保持原值不变，只有填写的字段会被修改</p>
          <form id="batch-edit-form" onSubmit={handlePreviewChanges} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">活动日期</label>
                <input type="date" value={activityDate || ''} onChange={(e) => setActivityDate(e.target.value || undefined)} className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">活动类型</label>
                <select value={activityType || ''} onChange={(e) => setActivityType(e.target.value || undefined)} className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all">
                  <option value="">不修改</option>
                  {activityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.display_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">活动名称</label>
              <input type="text" value={activityName || ''} onChange={(e) => setActivityName(e.target.value)} placeholder="留空表示不修改，输入空格后删除可清空" className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all placeholder:text-gray-400" />
            </div>
          </form>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending} className="flex-1">取消</Button>
          <Button type="submit" form="batch-edit-form" variant="primary" disabled={isPending} className="flex-1">预览修改</Button>
        </div>
      </div>
    </div>
  );
}
