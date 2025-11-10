'use client';

import { Modal, ModalFooter } from './Modal';
import { File } from '@/types';

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
  if (!file) return null;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="确认删除此文件？"
      size="md"
      closeOnBackdrop={!isDeleting}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          cancelText="取消"
          confirmText="确认删除"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-accent-gray">
          删除后将无法恢复，请确认是否继续。
        </p>

        {/* File Details */}
        <div className="hand-drawn-border bg-accent-gray/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[80px]">文件名：</span>
            <span className="text-primary-black break-all">{file.filename}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[80px]">文件大小：</span>
            <span className="text-primary-black">{formatSize(file.size)}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[80px]">上传日期：</span>
            <span className="text-primary-black">{formatDate(file.uploaded_at)}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="font-medium text-primary-black min-w-[80px]">目录：</span>
            <span className="text-primary-black break-all">{file.directory}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
