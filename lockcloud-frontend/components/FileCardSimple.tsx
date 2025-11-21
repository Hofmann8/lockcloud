'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { Button } from './Button';
import { Card } from './Card';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { LegacyFileTagEditor } from './LegacyFileTagEditor';
import { EditFileDialog } from './EditFileDialog';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface FileCardSimpleProps {
  file: File;
  onFileUpdate?: () => void;
}

/**
 * FileCardSimple - 简化版文件卡片
 * 
 * 只显示静态缩略图，不进行hover预览
 * 大幅降低流量消耗
 */
export function FileCardSimple({ file, onFileUpdate }: FileCardSimpleProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);

  const isOwner = user?.id === file.uploader_id;
  const isImage = file.content_type.startsWith('image/');
  const isVideo = file.content_type.startsWith('video/');

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ${zhCN.units.gb}`;
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}${zhCN.units.year}${month}${zhCN.units.month}${day}${zhCN.units.day}`;
  };

  const formatActivityDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return `${year}${zhCN.units.year}${month}${zhCN.units.month}${day}${zhCN.units.day}`;
  };

  // 获取文件图标
  const getFileIcon = (): string => {
    if (isImage) return '🖼️';
    if (isVideo) return '🎬';
    if (file.content_type.includes('pdf')) return '📄';
    if (file.content_type.includes('audio')) return '🎵';
    if (file.content_type.includes('zip') || file.content_type.includes('rar')) return '📦';
    return '📁';
  };

  // 获取缩略图 URL
  const getThumbnailUrl = (): string | null => {
    if (!file.s3_key) return null;
    
    const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud.s3.bitiful.net';
    
    // 视频：使用 S3 提供的视频第一帧服务
    if (isVideo) {
      return `${baseUrl}/${file.s3_key}#t=0.1`;
    }
    
    // 图片：使用压缩的图片URL
    if (isImage) {
      return `${baseUrl}/${file.s3_key}?w=400&q=75`;
    }
    
    return null;
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
      
      if (onFileUpdate) {
        onFileUpdate();
      }
    } catch (error) {
      console.error('Delete error:', error);
      
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

  const handleTagUpdateSuccess = () => {
    setIsTagEditorOpen(false);
    if (onFileUpdate) {
      onFileUpdate();
    }
  };

  const handleEditSuccess = () => {
    toast.success('文件信息更新成功');
    if (onFileUpdate) {
      onFileUpdate();
    }
  };

  const handleCardClick = () => {
    router.push(`/files/${file.id}`);
  };

  const thumbnailUrl = getThumbnailUrl();

  return (
    <>
      <Card padding="none" hoverable className="overflow-hidden group">
        {/* 缩略图/图标 */}
        <div
          className="relative h-48 bg-accent-gray/10 flex items-center justify-center cursor-pointer overflow-hidden rounded-t-xl"
          onClick={handleCardClick}
        >
          {isVideo && file.public_url ? (
            // 视频：使用 video 标签显示第一帧
            <video
              src={file.public_url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
          ) : thumbnailUrl ? (
            // 图片缩略图
            <img
              src={thumbnailUrl}
              alt={file.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          ) : (
            // 文件图标（文档等）
            <span className="text-6xl">{getFileIcon()}</span>
          )}
          
          {/* 视频播放图标叠加 */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-primary-black/60 rounded-full p-4 group-hover:bg-primary-black/80 transition-colors">
                <svg className="w-10 h-10 text-primary-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          )}
          
          {/* 悬停叠加层 */}
          <div className="absolute inset-0 bg-primary-black/0 group-hover:bg-primary-black/20 transition-colors duration-200 flex items-center justify-center">
            <span className="text-primary-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
              {isVideo ? '点击播放' : '预览'}
            </span>
          </div>
        </div>

        {/* 文件信息 */}
        <div className="p-4 space-y-3">
          {/* 文件名 */}
          <div>
            <h3 className="font-semibold text-base text-primary-black truncate" title={file.filename}>
              {file.filename}
            </h3>
            {file.original_filename && (
              <p className="text-xs text-accent-gray mt-1 truncate" title={file.original_filename}>
                原始文件名: {file.original_filename}
              </p>
            )}
          </div>

          {/* Legacy 标记 */}
          {file.is_legacy && (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {zhCN.files.legacyFile}
              </span>
            </div>
          )}

          {/* 元数据 */}
          <div className="space-y-2.5">
            {/* 活动日期 */}
            {file.activity_date && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-accent-gray">{zhCN.files.activityDate}</p>
                  <p className="text-sm font-medium text-primary-black">{formatActivityDate(file.activity_date)}</p>
                </div>
              </div>
            )}
            
            {/* 活动类型 */}
            {file.activity_type_display && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-accent-gray">{zhCN.files.activityType}</p>
                  <p className="text-sm font-medium text-primary-black">{file.activity_type_display}</p>
                </div>
              </div>
            )}
            
            {/* 带训老师 */}
            {file.instructor_display && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-accent-gray shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-accent-gray">{zhCN.files.instructor}</p>
                  <p className="text-sm font-medium text-primary-black">{file.instructor_display}</p>
                </div>
              </div>
            )}
            
            {/* 分隔线 */}
            <div className="border-t border-accent-gray/20 pt-2.5">
              {/* 文件大小 */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-accent-gray">{zhCN.files.fileSize}</span>
                <span className="font-medium text-primary-black">{formatSize(file.size)}</span>
              </div>
              
              {/* 上传日期 */}
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-accent-gray">{zhCN.files.uploadDate}</span>
                <span className="font-medium text-primary-black">{formatDate(file.uploaded_at)}</span>
              </div>
              
              {/* 上传者 */}
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-accent-gray">{zhCN.files.uploader}</span>
                <span className="font-medium text-primary-black">{file.uploader?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="pt-2 space-y-2">
            {/* Legacy 文件添加标签 */}
            {file.is_legacy && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsTagEditorOpen(true)}
                fullWidth
              >
                {zhCN.files.addTags}
              </Button>
            )}
            
            {/* 编辑按钮 - 只有上传者可以编辑非legacy文件 */}
            {isOwner && !file.is_legacy && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                fullWidth
              >
                编辑信息
              </Button>
            )}
            
            {/* 删除按钮 */}
            {isOwner && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                fullWidth
              >
                {zhCN.common.delete}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        file={file}
        isDeleting={isDeleting}
      />

      {/* Legacy 文件标签编辑器 */}
      <LegacyFileTagEditor
        file={file}
        isOpen={isTagEditorOpen}
        onClose={() => setIsTagEditorOpen(false)}
        onSuccess={handleTagUpdateSuccess}
      />

      {/* 编辑文件信息对话框 */}
      <EditFileDialog
        file={file}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
