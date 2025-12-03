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
    
    const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud2.s3.bitiful.net';
    
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
        <div className="p-3 space-y-2.5">
          {/* 文件名 */}
          <h3 className="font-semibold text-sm text-primary-black truncate" title={file.filename}>
            {file.filename}
          </h3>

          {/* 元数据 */}
          <div className="space-y-1.5">
            {/* 活动日期 */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-primary-black">{file.activity_date ? formatActivityDate(file.activity_date) : '-'}</span>
            </div>
            
            {/* 活动类型 */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-xs text-primary-black">{file.activity_type_display || '-'}</span>
            </div>
            
            {/* 活动名称 */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs text-primary-black truncate" title={file.activity_name}>{file.activity_name || '-'}</span>
            </div>
          </div>

          {/* 自由标签 */}
          <div className="flex flex-wrap gap-1 min-h-[20px]">
            {file.free_tags && file.free_tags.length > 0 ? (
              <>
                {file.free_tags.slice(0, 3).map(tag => (
                  <span key={tag.id} className="px-1.5 py-0.5 text-xs bg-orange-50 text-orange-500 rounded">
                    {tag.name}
                  </span>
                ))}
                {file.free_tags.length > 3 && (
                  <span className="text-xs text-accent-gray">+{file.free_tags.length - 3}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-accent-gray">无标签</span>
            )}
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-xs text-accent-gray pt-1.5 border-t border-accent-gray/15">
            <span>{formatSize(file.size)}</span>
            <span>{file.uploader?.name || '-'}</span>
          </div>

          {/* 操作按钮 */}
          {isOwner && (
            <div className="flex gap-2 pt-1">
              {file.is_legacy ? (
                <Button variant="secondary" size="sm" onClick={() => setIsTagEditorOpen(true)} fullWidth>
                  {zhCN.files.addTags}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setIsEditDialogOpen(true)} fullWidth>
                  编辑
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={handleDeleteClick} disabled={isDeleting} fullWidth>
                删除
              </Button>
            </div>
          )}
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
