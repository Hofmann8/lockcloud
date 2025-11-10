'use client';

import { useState } from 'react';
import { File } from '@/types';
import { Modal } from './Modal';
import { Button } from './Button';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface FilePreviewModalProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ file, isOpen, onClose }: FilePreviewModalProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);

  const isOwner = user?.id === file.uploader_id;
  const isImage = file.content_type.startsWith('image/');
  const isVideo = file.content_type.startsWith('video/');

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ${zhCN.units.gb}`;
  };

  // Format upload date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}${zhCN.units.year}${month}${zhCN.units.month}${day}${zhCN.units.day}`;
  };

  const handleDownload = () => {
    window.open(file.public_url, '_blank');
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteFile(file.id);
      toast.success(zhCN.files.deleteSuccess);
      setIsDeleteModalOpen(false);
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      
      // Handle specific error cases
      const err = error as { code?: string; message?: string };
      if (err?.code === 'FILE_002' || err?.message?.includes('无权')) {
        toast.error(zhCN.files.noPermission);
      } else {
        toast.error(err?.message || zhCN.files.deleteFailed);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.filename}
      size="xl"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={handleDownload} className="flex-1">
            {zhCN.common.download}
          </Button>
          {isOwner && (
            <Button
              variant="danger"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="flex-1"
            >
              {zhCN.common.delete}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {zhCN.common.close}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Preview */}
        <div className="bg-accent-gray/10 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
          {isImage && (
            <img
              src={file.public_url}
              alt={file.filename}
              className="max-w-full max-h-[600px] object-contain"
            />
          )}
          {isVideo && (
            <video
              src={file.public_url}
              controls
              className="max-w-full max-h-[600px]"
            >
              您的浏览器不支持视频播放
            </video>
          )}
          {!isImage && !isVideo && (
            <div className="text-center p-8">
              <p className="text-6xl mb-4">📄</p>
              <p className="text-accent-gray">
                此文件类型不支持预览，请下载查看
              </p>
            </div>
          )}
        </div>

        {/* File Metadata */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">{zhCN.files.fileName}:</span>
            <span className="text-accent-gray">{file.filename}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">{zhCN.files.fileSize}:</span>
            <span className="text-accent-gray">{formatSize(file.size)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">{zhCN.files.uploadDate}:</span>
            <span className="text-accent-gray">{formatDate(file.uploaded_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">{zhCN.files.uploader}:</span>
            <span className="text-accent-gray">{file.uploader?.name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">{zhCN.files.directory}:</span>
            <span className="text-accent-gray">{file.directory}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-primary-black">类型:</span>
            <span className="text-accent-gray">{file.content_type}</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        file={file}
        isDeleting={isDeleting}
      />
    </Modal>
  );
}
