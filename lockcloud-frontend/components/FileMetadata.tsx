'use client';

import { useState } from 'react';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { useTransferQueueStore } from '@/stores/transferQueueStore';
import { Button } from './Button';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EditFileDialog } from './EditFileDialog';
import { UserAvatarInline } from './UserAvatar';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface FileMetadataProps {
  file: File;
  onFileUpdate?: () => void;
}

export function FileMetadata({ file, onFileUpdate }: FileMetadataProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);
  const addDownloadTask = useTransferQueueStore((state) => state.addDownloadTask);

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
    // 添加到下载队列
    addDownloadTask({
      files: [{
        fileId: file.id,
        filename: file.original_filename || file.filename,
        size: file.size || 0,
        contentType: file.content_type,
      }],
    });
    toast.success('已添加到下载队列');
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
      <div className="bg-primary-white rounded-xl border border-accent-gray/20 p-4 sm:p-5 lg:p-6" role="complementary" aria-label="文件信息">
        {/* 横向布局：左侧信息 + 右侧操作按钮 */}
        <div className="flex flex-col lg:flex-row lg:gap-8">
          {/* 左侧：文件信息区域 */}
          <div className="flex-1 min-w-0">
            {/* 文件名 + 原始文件名 */}
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-primary-black mb-1">
                {file.filename}
              </h2>
              {file.original_filename && file.filename !== file.original_filename && (
                <p className="text-xs text-accent-gray truncate" title={file.original_filename}>
                  源文件: {file.original_filename}
                </p>
              )}
            </div>

            {/* 信息网格：活动信息 + 文件详情 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              {/* 活动日期 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-accent-gray">活动日期</p>
                </div>
                <p className="text-sm font-medium text-primary-black">
                  {file.activity_date ? formatActivityDate(file.activity_date) : '-'}
                </p>
              </div>
              
              {/* 活动类型 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <p className="text-xs text-accent-gray">活动类型</p>
                </div>
                <p className="text-sm font-medium text-primary-black truncate">
                  {file.activity_type_display || '-'}
                </p>
              </div>
              
              {/* 活动名称 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-xs text-accent-gray">活动名称</p>
                </div>
                <p className="text-sm font-medium text-primary-black truncate">
                  {file.activity_name || '-'}
                </p>
              </div>

              {/* 文件大小 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs text-accent-gray">文件大小</p>
                </div>
                <p className="text-sm font-medium text-primary-black">
                  {formatSize(file.size)}
                </p>
              </div>
              
              {/* 内容类型 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-accent-gray">类型</p>
                </div>
                <p className="text-sm font-medium text-primary-black truncate" title={file.content_type || '未知'}>
                  {file.content_type?.split('/')[1]?.toUpperCase() || '未知'}
                </p>
              </div>
              
              {/* 上传日期 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-xs text-accent-gray">上传日期</p>
                </div>
                <p className="text-sm font-medium text-primary-black">
                  {formatDate(file.uploaded_at)}
                </p>
              </div>
              
              {/* 上传者 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="text-xs text-accent-gray">上传者</p>
                </div>
                <div className="text-sm font-medium text-primary-black">
                  <UserAvatarInline user={file.uploader} size="sm" />
                </div>
              </div>
            </div>

            {/* 自由标签 */}
            {file.free_tags && file.free_tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-accent-gray/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <svg className="w-3.5 h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {file.free_tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2.5 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full text-xs"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：操作按钮区域 */}
          <div className="mt-4 pt-4 border-t border-accent-gray/20 lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-6 lg:w-auto shrink-0">
            <div className="flex flex-row lg:flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleDownload}
                aria-label={`下载文件 ${file.filename}`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                }
              >
                {zhCN.common.download}
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsEditDialogOpen(true)}
                aria-label={`编辑文件 ${file.filename}`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
              >
                编辑
              </Button>
              
              {isOwner && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  aria-label={`删除文件 ${file.filename}`}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                >
                  删除
                </Button>
              )}
            </div>
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

      {/* Edit File Dialog */}
      <EditFileDialog
        file={file}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={() => onFileUpdate?.()}
      />
    </>
  );
}
