'use client';

import { useState } from 'react';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { Button } from './Button';
import { Card } from './Card';
import { FilePreviewModal } from './FilePreviewModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface FileCardProps {
  file: File;
}

export function FileCard({ file }: FileCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

  // Get file icon based on content type
  const getFileIcon = (): string => {
    if (isImage) return '🖼️';
    if (isVideo) return '🎬';
    if (file.content_type.includes('pdf')) return '📄';
    if (file.content_type.includes('audio')) return '🎵';
    if (file.content_type.includes('zip') || file.content_type.includes('rar')) return '📦';
    return '📁';
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
    <>
      <Card 
        padding="none" 
        hoverable 
        className="overflow-hidden group"
      >
        {/* Thumbnail/Icon */}
        <div
          className="relative h-48 bg-accent-gray/10 flex items-center justify-center cursor-pointer overflow-hidden rounded-t-xl"
          onClick={() => setIsPreviewOpen(true)}
        >
          {isImage ? (
            <img
              src={file.public_url}
              alt={file.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <span className="text-6xl">{getFileIcon()}</span>
          )}
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary-black/0 group-hover:bg-primary-black/20 transition-colors duration-200 flex items-center justify-center">
            <span className="text-primary-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
              预览
            </span>
          </div>
        </div>

        {/* File Info */}
        <div className="p-3 md:p-4 space-y-2 md:space-y-2">
          {/* Filename */}
          <h3 className="font-medium text-sm md:text-base text-primary-black truncate" title={file.filename}>
            {file.filename}
          </h3>

          {/* Metadata */}
          <div className="text-xs md:text-sm text-accent-gray space-y-1">
            <p>
              <span className="font-medium">{zhCN.files.fileSize}:</span> {formatSize(file.size)}
            </p>
            <p>
              <span className="font-medium">{zhCN.files.uploadDate}:</span> {formatDate(file.uploaded_at)}
            </p>
            <p>
              <span className="font-medium">{zhCN.files.uploader}:</span>{' '}
              {file.uploader?.name || 'Unknown'}
            </p>
          </div>

          {/* Actions */}
          {isOwner && (
            <div className="pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                fullWidth
              >
                {zhCN.common.delete}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Preview Modal */}
      <FilePreviewModal
        file={file}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        file={file}
        isDeleting={isDeleting}
      />
    </>
  );
}
