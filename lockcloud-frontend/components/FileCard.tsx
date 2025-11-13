'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFileStore } from '@/stores/fileStore';
import { Button } from './Button';
import { Card } from './Card';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { LegacyFileTagEditor } from './LegacyFileTagEditor';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';
import { buildOptimizedImageUrl, buildS3ImageUrl, getOptimalImageSize } from '@/lib/utils/responsiveImage';

interface FileCardProps {
  file: File;
  onFileUpdate?: () => void;
  observeElement?: (element: HTMLElement | null, file: File) => void;
  unobserveElement?: (element: HTMLElement | null) => void;
}

export function FileCard({ file, onFileUpdate, observeElement, unobserveElement }: FileCardProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [videoPreloaded, setVideoPreloaded] = useState(false);
  const user = useAuthStore((state) => state.user);
  const deleteFile = useFileStore((state) => state.deleteFile);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOwner = user?.id === file.uploader_id;
  const isImage = file.content_type.startsWith('image/');
  const isVideo = file.content_type.startsWith('video/');

  // Setup Intersection Observer for intelligent preloading
  useEffect(() => {
    if (!observeElement || !unobserveElement) return;
    
    const element = cardRef.current;
    if (element) {
      observeElement(element, file);
    }

    return () => {
      if (element) {
        unobserveElement(element);
      }
    };
  }, [file, observeElement, unobserveElement]);

  // Preload video on first hover to enable 304 caching
  useEffect(() => {
    if (!isVideo || !isHovering || videoPreloaded) return;

    const video = videoRef.current;
    if (!video) return;

    // Load video metadata and first few seconds
    video.load();
    
    // Mark as preloaded once metadata is loaded
    const handleLoadedMetadata = () => {
      setVideoPreloaded(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [isVideo, isHovering, videoPreloaded]);

  // Control video playback based on hover state
  useEffect(() => {
    if (!isVideo) return;

    const video = videoRef.current;
    if (!video) return;

    if (isHovering && videoPreloaded) {
      video.play().catch(err => {
        console.log('Video play failed:', err);
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isVideo, isHovering, videoPreloaded]);

  // Generate optimized image URL for thumbnails
  const getOptimizedThumbnailUrl = (s3Key: string): string => {
    // For thumbnails in cards, use smaller size (max 800px width)
    return buildS3ImageUrl(s3Key, {
      width: 800,
      quality: 80,
      format: 'webp',
    });
  };

  // Generate video thumbnail URL (first frame)
  const getVideoThumbnail = (s3Key: string): string => {
    // Use S3 image processing for video frames
    const baseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud.s3.bitiful.net';
    return `${baseUrl}/${s3Key}?frame=0&w=800&cs=srgb`;
  };

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

  // Format activity date (YYYY年MM月DD日)
  const formatActivityDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
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

  const handleTagUpdateSuccess = () => {
    setIsTagEditorOpen(false);
    if (onFileUpdate) {
      onFileUpdate();
    }
  };

  const handleCardClick = () => {
    router.push(`/files/${file.id}`);
  };

  return (
    <>
      <div ref={cardRef}>
        <Card 
          padding="none" 
          hoverable 
          className="overflow-hidden group"
        >
        {/* Thumbnail/Icon */}
        <div
          className="relative h-48 bg-accent-gray/10 flex items-center justify-center cursor-pointer overflow-hidden rounded-t-xl"
          onClick={handleCardClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {isImage ? (
            <img
              src={getOptimizedThumbnailUrl(file.s3_key)}
              alt={file.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : isVideo ? (
            <>
              {/* Video thumbnail (first frame) - shown when not hovering */}
              <img
                src={getVideoThumbnail(file.s3_key)}
                alt={file.filename}
                className={`w-full h-full object-cover transition-opacity duration-200 ${isHovering && videoPreloaded ? 'opacity-0' : 'opacity-100'}`}
              />
              
              {/* Video preview - always mounted but hidden when not hovering */}
              <video
                ref={videoRef}
                src={file.public_url}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${isHovering && videoPreloaded ? 'opacity-100' : 'opacity-0'}`}
                loop
                muted
                playsInline
                preload="metadata"
              />
              
              {/* Video play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-primary-black/50 rounded-full p-3 group-hover:bg-primary-black/70 transition-colors">
                  <svg className="w-8 h-8 text-primary-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <span className="text-6xl">{getFileIcon()}</span>
          )}
          
          {/* Hover overlay for non-video files */}
          {!isVideo && (
            <div className="absolute inset-0 bg-primary-black/0 group-hover:bg-primary-black/20 transition-colors duration-200 flex items-center justify-center">
              <span className="text-primary-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
                预览
              </span>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="p-4 space-y-3">
          {/* Filename */}
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

          {/* Legacy file badge */}
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

          {/* Metadata Grid */}
          <div className="space-y-2.5">
            {/* Activity Date */}
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
            
            {/* Activity Type */}
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
            
            {/* Instructor */}
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
            
            {/* Divider */}
            <div className="border-t border-accent-gray/20 pt-2.5">
              {/* File Size */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-accent-gray">{zhCN.files.fileSize}</span>
                <span className="font-medium text-primary-black">{formatSize(file.size)}</span>
              </div>
              
              {/* Upload Date */}
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-accent-gray">{zhCN.files.uploadDate}</span>
                <span className="font-medium text-primary-black">{formatDate(file.uploaded_at)}</span>
              </div>
              
              {/* Uploader */}
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-accent-gray">{zhCN.files.uploader}</span>
                <span className="font-medium text-primary-black">{file.uploader?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            {/* Add Tags button for legacy files */}
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
            
            {/* Delete button for owners */}
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
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        file={file}
        isDeleting={isDeleting}
      />

      {/* Legacy File Tag Editor Modal */}
      <LegacyFileTagEditor
        file={file}
        isOpen={isTagEditorOpen}
        onClose={() => setIsTagEditorOpen(false)}
        onSuccess={handleTagUpdateSuccess}
      />
    </>
  );
}
