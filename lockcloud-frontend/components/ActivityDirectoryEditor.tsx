'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { Button } from './Button';
import { getActivityDirectoryInfo, updateActivityDirectory } from '@/lib/api/files';
import { createDirectoryRequest } from '@/lib/api/requests';
import { useActivityTypes } from '@/lib/hooks/useTagPresets';
import { showToast } from '@/lib/utils/toast';

interface ActivityDirectoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  activityDate: string;
  activityName: string;
  activityType: string;
  onUpdate?: () => void;
}

export function ActivityDirectoryEditor({
  isOpen,
  onClose,
  activityDate,
  activityName,
  activityType,
  onUpdate,
}: ActivityDirectoryEditorProps) {
  const queryClient = useQueryClient();
  const [newActivityName, setNewActivityName] = useState(activityName);
  const [newActivityType, setNewActivityType] = useState(activityType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: activityTypes = [] } = useActivityTypes();

  const { data: directoryData, isLoading } = useQuery({
    queryKey: ['activity-directory', activityDate, activityName, activityType],
    queryFn: () => getActivityDirectoryInfo({
      activity_date: activityDate,
      activity_name: activityName,
      activity_type: activityType,
    }),
    enabled: isOpen && !!activityDate && !!activityName && !!activityType,
  });

  const directory = directoryData?.directory;

  useEffect(() => {
    if (isOpen) {
      setNewActivityName(activityName);
      setNewActivityType(activityType);
    }
  }, [isOpen, activityName, activityType]);

  const handleSubmit = async () => {
    if (!directory) return;

    const hasChanges = newActivityName !== activityName || newActivityType !== activityType;
    if (!hasChanges) {
      showToast.info('没有修改内容');
      return;
    }

    if (!newActivityName.trim()) {
      showToast.error('活动名称不能为空');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateActivityDirectory({
        activity_date: activityDate,
        activity_name: activityName,
        activity_type: activityType,
        new_activity_name: newActivityName !== activityName ? newActivityName : undefined,
        new_activity_type: newActivityType !== activityType ? newActivityType : undefined,
      });

      showToast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['directories'] });
      queryClient.invalidateQueries({ queryKey: ['activity-directory'] });
      onUpdate?.();
      onClose();
    } catch (error: unknown) {
      console.error('Update directory error:', error);
      const axiosError = error as { response?: { data?: { need_request?: boolean; error?: { message?: string } } } };
      if (axiosError.response?.data?.need_request) {
        showToast.error('您不是该目录的所有者，需要提交修改申请');
      } else {
        showToast.error(axiosError.response?.data?.error?.message || '更新失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!directory) return;

    const hasChanges = newActivityName !== activityName || newActivityType !== activityType;
    if (!hasChanges) {
      showToast.info('没有修改内容');
      return;
    }

    if (!newActivityName.trim()) {
      showToast.error('活动名称不能为空');
      return;
    }

    setIsSubmitting(true);
    try {
      await createDirectoryRequest({
        activity_date: activityDate,
        activity_name: activityName,
        activity_type: activityType,
        proposed_changes: {
          new_activity_name: newActivityName !== activityName ? newActivityName : undefined,
          new_activity_type: newActivityType !== activityType ? newActivityType : undefined,
        },
      });

      showToast.success('修改申请已提交，等待目录所有者审批');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    } catch (error: unknown) {
      console.error('Submit request error:', error);
      const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
      showToast.error(axiosError.response?.data?.error?.message || '提交申请失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑活动目录">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : directory ? (
        <div className="space-y-4">
          {/* Directory Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">活动日期</span>
              <span className="font-medium">{activityDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">文件数量</span>
              <span className="font-medium">{directory.file_count} 个</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">目录所有者</span>
              <span className="font-medium">{directory.owner_name}</span>
            </div>
            {!directory.is_owner && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                您不是该目录的所有者，修改需要经过所有者同意
              </div>
            )}
          </div>

          {/* Edit Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                活动名称
              </label>
              <input
                type="text"
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                活动类型
              </label>
              <select
                value={newActivityType}
                onChange={(e) => setNewActivityType(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[44px]"
              >
                {activityTypes.map((type) => (
                  <option key={type.id} value={type.value}>
                    {type.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            {directory.is_owner ? (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting || (newActivityName === activityName && newActivityType === activityType)}
              >
                保存修改
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmitRequest}
                loading={isSubmitting}
                disabled={isSubmitting || (newActivityName === activityName && newActivityType === activityType)}
              >
                提交申请
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          目录信息加载失败
        </div>
      )}
    </Modal>
  );
}
