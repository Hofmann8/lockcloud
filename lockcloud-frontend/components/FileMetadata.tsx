'use client';

import { useState } from 'react';
import { File, FreeTag } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { Button } from './Button';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FileTagEditor } from './FileTagEditor';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface FileMetadataProps {
  file: File;
  onFileUpdate?: () => void;
}

export function FileMetadata({ file, onFileUpdate }: FileMetadataProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);

  const isOwner = user?.id === file.uploader_id;

  // Format file size with null safety
  const formatSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return '未知';
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ${zhCN.units.gb}`;
  };

  // Format upload date with null safety
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '未知';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '未知';
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}${zhCN.units.year}${month}${zhCN.units.month}${day}${zhCN.units.day}`;
    } catch {
      return '未知';
    }
  };

  // Format activity date (YYYY年MM月DD日) with null safety
  const formatActivityDate = (dateString?: string): string => {
    if (!dateString) return '未知';
    try {
      const [year, month, day] = dateString.split('-');
      if (!year || !month || !day) return '未知';
      return `${year}${zhCN.units.year}${month}${zhCN.units.month}${day}${zhCN.units.day}`;
    } catch {
      return '未知';
    }
  };

  const handleDownload = () => {
    // Open file URL in new tab to trigger download
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
      
      // Trigger parent refresh
      if (onFileUpdate) {
        onFileUpdate();
      }
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
      <div className="bg-primary-white rounded-xl border border-accent-gray/20 p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6" role="complementary" aria-label="文件信息">
        {/* File Name Section */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-primary-black mb-2" id="file-name-heading">
            {zhCN.files.fileName}
          </h2>
          <p className="text-sm text-primary-black break-all">
            {file.filename}
          </p>
          {file.original_filename && (
            <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-accent-gray/20">
              <p className="text-xs text-accent-gray mb-1">
                {zhCN.files.originalFileName}
              </p>
              <p className="text-sm text-primary-black break-all">
                {file.original_filename}
              </p>
            </div>
          )}
        </div>

        {/* Activity Information */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-sm font-semibold text-primary-black" id="activity-info-heading">
            活动信息
          </h3>
          
          {/* 活动日期 */}
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-accent-gray mb-1">
                {zhCN.files.activityDate}
              </p>
              <p className="text-sm font-medium text-primary-black">
                {file.activity_date ? formatActivityDate(file.activity_date) : '-'}
              </p>
            </div>
          </div>
          
          {/* 活动类型 */}
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-accent-gray mb-1">
                {zhCN.files.activityType}
              </p>
              <p className="text-sm font-medium text-primary-black">
                {file.activity_type_display || '-'}
              </p>
            </div>
          </div>
          
          {/* 活动名称 */}
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-accent-gray mb-1">
                活动名称
              </p>
              <p className="text-sm font-medium text-primary-black">
                {file.activity_name || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Free Tags Section - Requirements 3.4, 8.4 */}
        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-accent-gray/20">
          <FileTagEditor
            fileId={file.id}
            tags={file.free_tags || []}
            onTagsChange={(updatedTags: FreeTag[]) => {
              // Update will be handled by query invalidation in FileTagEditor
              onFileUpdate?.();
            }}
            showLabel={true}
            label="自由标签"
          />
        </div>

        {/* File Details */}
        <div className="space-y-2.5 sm:space-y-3 pt-3 sm:pt-4 border-t border-accent-gray/20">
          <h3 className="text-sm font-semibold text-primary-black" id="file-details-heading">
            文件详情
          </h3>
          
          <div className="space-y-2">
            {/* File Size */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-accent-gray">
                {zhCN.files.fileSize}
              </span>
              <span className="text-sm font-medium text-primary-black">
                {formatSize(file.size)}
              </span>
            </div>
            
            {/* Content Type */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-accent-gray">
                内容类型
              </span>
              <span className="text-sm font-medium text-primary-black">
                {file.content_type || '未知'}
              </span>
            </div>
            
            {/* Upload Date */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-accent-gray">
                {zhCN.files.uploadDate}
              </span>
              <span className="text-sm font-medium text-primary-black">
                {formatDate(file.uploaded_at)}
              </span>
            </div>
            
            {/* Uploader */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-accent-gray">
                {zhCN.files.uploader}
              </span>
              <span className="text-sm font-medium text-primary-black">
                {file.uploader?.name || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 sm:space-y-3 pt-3 sm:pt-4 border-t border-accent-gray/20" role="group" aria-label="文件操作">
          {/* Download Button - visible to all users */}
          <Button
            variant="primary"
            size="md"
            onClick={handleDownload}
            fullWidth
            aria-label={`下载文件 ${file.filename}`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            {zhCN.common.download}
          </Button>
          
          {/* Delete Button - only visible to file owner */}
          {isOwner && (
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              fullWidth
              aria-label={`删除文件 ${file.filename}`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
            >
              {zhCN.common.delete}
            </Button>
          )}
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
    </>
  );
}
