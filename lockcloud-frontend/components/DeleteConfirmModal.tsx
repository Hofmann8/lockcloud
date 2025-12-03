'use client';

import { useMutation } from '@tanstack/react-query';
import { Modal, ModalFooter } from './Modal';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { createRequest } from '@/lib/api/requests';
import toast from 'react-hot-toast';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  file: File | null;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  file,
  isDeleting,
}: DeleteConfirmModalProps) {
  const user = useAuthStore((state) => state.user);
  const isOwner = file ? user?.id === file.uploader_id : false;
  const isAdmin = user?.is_admin || false;
  const canDirectDelete = isOwner || isAdmin;

  const requestMutation = useMutation({
    mutationFn: () => createRequest({
      file_id: file!.id,
      request_type: 'delete',
    }),
    onSuccess: () => {
      toast.success('删除请求已发送给文件上传者');
      onClose();
    },
    onError: (error: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error?.response?.data?.error?.message || '发送请求失败');
    },
  });

  if (!file) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} 字节`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const handleConfirm = () => {
    if (canDirectDelete) {
      onConfirm();
    } else {
      requestMutation.mutate();
    }
  };

  const isPending = isDeleting || requestMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={canDirectDelete ? '确认删除此文件？' : '请求删除此文件？'}
      size="md"
      closeOnBackdrop={!isPending}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          cancelText="取消"
          confirmText={canDirectDelete ? '确认删除' : '发送请求'}
          confirmVariant="danger"
          isLoading={isPending}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-accent-gray">
          {canDirectDelete 
            ? '删除后将无法恢复，请确认是否继续。'
            : '您不是此文件的上传者，删除请求将发送给上传者审批。'
          }
        </p>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[70px]">文件名：</span>
            <span className="text-primary-black break-all">{file.filename}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[70px]">大小：</span>
            <span className="text-primary-black">{formatSize(file.size)}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[70px]">上传者：</span>
            <span className="text-primary-black">{file.uploader?.name || '未知'}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[70px]">上传日期：</span>
            <span className="text-primary-black">{formatDate(file.uploaded_at)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
