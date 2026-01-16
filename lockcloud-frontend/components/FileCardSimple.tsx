'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { useTransferQueueStore } from '@/stores/transferQueueStore';
import { useDeviceDetect } from '@/lib/hooks/useDeviceDetect';
import { useSignedUrlFromContext } from '@/contexts/SignedUrlContext';
import { Card } from './Card';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EditFileDialog } from './EditFileDialog';
import { UserAvatar } from './UserAvatar';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';
import { thumbHashToDataURL } from 'thumbhash';

interface FileCardSimpleProps {
  file: File;
  onFileUpdate?: () => void;
}

/**
 * FileCardSimple - 简化版文件卡片
 * 
 * 从 SignedUrlContext 获取签名 URL（由 FileGrid 批量获取）
 */
export function FileCardSimple({ file, onFileUpdate }: FileCardSimpleProps) {
  const { isMobile, isTouchDevice } = useDeviceDetect();
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);
  const addDownloadTask = useTransferQueueStore((state) => state.addDownloadTask);

  const isOwner = user?.id === file.uploader_id;
  const isImage = file.content_type.startsWith('image/');
  const isVideo = file.content_type.startsWith('video/');

  // 从 context 获取签名 URL（已由 FileGrid 批量获取）
  const { url: thumbnailUrl, isLoading: isUrlLoading } = useSignedUrlFromContext(file.id);

  // 解码 thumbhash 生成占位图 data URL
  const placeholderUrl = useMemo(() => {
    if (!file.thumbhash) return null;
    try {
      const binary = atob(file.thumbhash);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return thumbHashToDataURL(bytes);
    } catch (e) {
      console.warn('Failed to decode thumbhash:', e);
      return null;
    }
  }, [file.thumbhash]);

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

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDownload = () => {
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

  const handleEditSuccess = () => {
    toast.success('文件信息更新成功');
    if (onFileUpdate) {
      onFileUpdate();
    }
  };

  const handleCardClick = () => {
    // 先缓存文件信息，让详情页可以立即显示
    useFileStore.getState().setSelectedFile(file);
    router.push(`/files/${file.id}`);
  };

  return (
    <>
      <Card padding="none" hoverable className="overflow-hidden group">
        {/* 缩略图/图标 - 移动端高度稍小 */}
        <div
          className="relative h-40 sm:h-44 md:h-48 bg-accent-gray/10 flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={handleCardClick}
        >
          {(isImage || isVideo) ? (
            // 图片/视频缩略图
            <>
              {/* 占位图：优先使用 ThumbHash 模糊图，否则显示 Skeleton */}
              {(!imageLoaded || isUrlLoading) && (
                placeholderUrl ? (
                  <img
                    src={placeholderUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="absolute inset-0 skeleton" aria-hidden="true" />
                )
              )}
              {/* 实际缩略图 */}
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={file.filename}
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${
                    imageLoaded && !isUrlLoading ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                />
              )}
            </>
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

        {/* 文件信息 - 移动端优化间距 */}
        <div className="p-2.5 sm:p-3 space-y-2 sm:space-y-2.5">
          {/* 文件名 - 移动端字体稍大以便阅读 */}
          <h3 className="font-semibold text-sm sm:text-sm text-primary-black truncate leading-tight sm:leading-normal" title={file.filename}>
            {file.filename}
          </h3>

          {/* 元数据 - 移动端紧凑间距 */}
          <div className="space-y-1 sm:space-y-1.5">
            {/* 活动日期 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-primary-black leading-tight">{file.activity_date ? formatActivityDate(file.activity_date) : '-'}</span>
            </div>
            
            {/* 活动类型 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-xs text-primary-black leading-tight">{file.activity_type_display || '-'}</span>
            </div>
            
            {/* 活动名称 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs text-primary-black truncate leading-tight" title={file.activity_name}>{file.activity_name || '-'}</span>
            </div>
          </div>

          {/* 自由标签 - 移动端显示更少标签 */}
          <div className="flex flex-wrap gap-1 min-h-[18px] sm:min-h-[20px]">
            {file.free_tags && file.free_tags.length > 0 ? (
              <>
                {file.free_tags.slice(0, isMobile ? 2 : 3).map(tag => (
                  <span key={tag.id} className="px-1 sm:px-1.5 py-0.5 text-xs bg-orange-50 text-orange-500 rounded leading-tight">
                    {tag.name}
                  </span>
                ))}
                {file.free_tags.length > (isMobile ? 2 : 3) && (
                  <span className="text-xs text-accent-gray">+{file.free_tags.length - (isMobile ? 2 : 3)}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-accent-gray">无标签</span>
            )}
          </div>

          {/* 底部信息 + 操作图标 */}
          <div className="flex items-center justify-between text-xs text-accent-gray pt-1.5 border-t border-accent-gray/15">
            <span>{formatSize(file.size)}</span>
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* 操作图标 - 移动端/触摸设备始终显示，桌面端 hover 时显示 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className={[
                  'p-1.5 sm:p-1 text-gray-400 hover:text-accent-blue hover:bg-blue-50 rounded transition-all',
                  isMobile || isTouchDevice 
                    ? 'opacity-100 min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0 flex items-center justify-center' 
                    : 'opacity-0 group-hover:opacity-100'
                ].join(' ')}
                title="下载"
              >
                <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditDialogOpen(true); }}
                className={[
                  'p-1.5 sm:p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-all',
                  // 移动端/触摸设备: 始终显示，增大触摸区域
                  // 桌面端: hover 时显示
                  isMobile || isTouchDevice 
                    ? 'opacity-100 min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0 flex items-center justify-center' 
                    : 'opacity-0 group-hover:opacity-100'
                ].join(' ')}
                title="编辑"
              >
                <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                disabled={isDeleting}
                className={[
                  'p-1.5 sm:p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-50',
                  // 移动端/触摸设备: 始终显示，增大触摸区域
                  // 桌面端: hover 时显示
                  isMobile || isTouchDevice 
                    ? 'opacity-100 min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0 flex items-center justify-center' 
                    : 'opacity-0 group-hover:opacity-100'
                ].join(' ')}
                title={isOwner ? "删除" : "请求删除"}
              >
                <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <UserAvatar user={file.uploader} size="xs" />
              <span className="ml-0.5 sm:ml-1 truncate max-w-[60px] sm:max-w-none">{file.uploader?.name || '-'}</span>
            </div>
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
