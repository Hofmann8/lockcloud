'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { File } from '@/types';
import { FileMetadata } from './FileMetadata';
import { useSignedUrlsBatch } from '@/lib/hooks/useSignedUrl';
import { StylePreset } from '@/lib/api/files';

interface AdjacentFile {
  id: number;
  filename: string;
  original_filename?: string;
  content_type?: string;
  public_url?: string;
  thumbhash?: string;
}

interface AdjacentFilesData {
  previous: AdjacentFile | null;
  next: AdjacentFile | null;
  previous_files?: AdjacentFile[];
  next_files?: AdjacentFile[];
}

interface PreviewContainerProps {
  file: File;
  className?: string;
  children?: React.ReactNode;
  onFileUpdate?: () => void;
}

// 每个侧边栏项目的高度（90px 缩略图 + 12px 间距）
const SIDEBAR_ITEM_HEIGHT = 102;
// 侧边栏头部和底部的固定高度（标题 + padding + 快捷键提示）
const SIDEBAR_FIXED_HEIGHT = 100;

/**
 * 计算可显示的相邻文件数量
 */
function calculateVisibleCount(containerHeight: number): number {
  const availableHeight = containerHeight - SIDEBAR_FIXED_HEIGHT;
  const count = Math.floor(availableHeight / SIDEBAR_ITEM_HEIGHT);
  return Math.max(1, Math.min(count, 20));
}

/**
 * AdjacentFilesSidebar Component
 * 
 * 右侧边栏：显示相邻文件列表（类似 YouTube 推荐视频）
 * 根据左侧容器高度动态调整显示数量
 */
interface AdjacentFilesSidebarProps {
  adjacentFiles: AdjacentFilesData;
  leftContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function AdjacentFilesSidebar({ adjacentFiles, leftContainerRef }: AdjacentFilesSidebarProps) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(5);

  // 监听左侧容器高度变化
  useEffect(() => {
    if (!leftContainerRef?.current) return;

    const updateVisibleCount = () => {
      if (leftContainerRef.current) {
        const height = leftContainerRef.current.offsetHeight;
        setVisibleCount(calculateVisibleCount(height));
      }
    };

    // 初始计算
    updateVisibleCount();

    // 使用 ResizeObserver 监听高度变化
    const resizeObserver = new ResizeObserver(updateVisibleCount);
    resizeObserver.observe(leftContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [leftContainerRef]);

  const handleNavigate = (fileId: number) => {
    router.push(`/files/${fileId}`);
  };

  // 构建相邻文件列表
  const allSidebarFiles: AdjacentFile[] = useMemo(() => {
    const files: AdjacentFile[] = [];
    
    // 添加前面的文件（倒序，最近的在前）
    if (adjacentFiles?.previous_files) {
      files.push(...[...adjacentFiles.previous_files].reverse());
    } else if (adjacentFiles?.previous) {
      files.push(adjacentFiles.previous);
    }
    
    // 添加后面的文件
    if (adjacentFiles?.next_files) {
      files.push(...adjacentFiles.next_files);
    } else if (adjacentFiles?.next) {
      files.push(adjacentFiles.next);
    }
    
    return files;
  }, [adjacentFiles]);

  // 根据可见数量截取显示的文件
  const sidebarFiles = useMemo(() => {
    return allSidebarFiles.slice(0, visibleCount);
  }, [allSidebarFiles, visibleCount]);

  // 获取侧边栏缩略图的签名 URL
  const sidebarFileIds = useMemo(() => 
    sidebarFiles.filter(f => {
      const isMedia = f.content_type?.startsWith('image/') || f.content_type?.startsWith('video/');
      return isMedia;
    }).map(f => f.id),
    [sidebarFiles]
  );

  const sidebarThumbnailStyle: StylePreset = 'thumbnavdesktop';
  
  const { urls: sidebarThumbnailUrls } = useSignedUrlsBatch(
    sidebarFileIds,
    sidebarThumbnailStyle,
    sidebarFileIds.length > 0
  );

  if (sidebarFiles.length === 0) {
    return null;
  }

  return (
    <div className="bg-primary-white rounded-lg p-3 lg:p-4">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        相邻文件
      </h3>
      <div className="space-y-3">
        {sidebarFiles.map((navFile) => {
          const isVideo = navFile.content_type?.startsWith('video/');
          const isImage = navFile.content_type?.startsWith('image/');
          const isPrev = adjacentFiles?.previous_files?.some(f => f.id === navFile.id) || 
                         adjacentFiles?.previous?.id === navFile.id;
          
          return (
            <button
              key={navFile.id}
              onClick={() => handleNavigate(navFile.id)}
              className="w-full flex gap-3 p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group text-left"
            >
              {/* 缩略图 */}
              <div className="relative w-[160px] h-[90px] shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                {(isVideo || isImage) && sidebarThumbnailUrls[navFile.id] ? (
                  <Image 
                    src={sidebarThumbnailUrls[navFile.id]}
                    alt={navFile.original_filename || navFile.filename}
                    fill
                    className="object-cover"
                    sizes="160px"
                    unoptimized
                  />
                ) : (isVideo || isImage) ? (
                  <div className="w-full h-full skeleton" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                
                {/* 视频图标 */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 文件信息 */}
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {navFile.original_filename || navFile.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  {isPrev ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>上一个</span>
                    </>
                  ) : (
                    <>
                      <span>下一个</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* 键盘快捷键提示 */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">→</kbd>
          <span>键盘快速切换</span>
        </p>
      </div>
    </div>
  );
}

/**
 * SidebarSkeleton Component
 * 
 * 右侧边栏骨架屏，根据左侧容器高度动态调整数量
 */
interface SidebarSkeletonProps {
  leftContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function SidebarSkeleton({ leftContainerRef }: SidebarSkeletonProps) {
  const [skeletonCount, setSkeletonCount] = useState(5);

  useEffect(() => {
    if (!leftContainerRef?.current) return;

    const updateCount = () => {
      if (leftContainerRef.current) {
        const height = leftContainerRef.current.offsetHeight;
        setSkeletonCount(calculateVisibleCount(height));
      }
    };

    updateCount();

    const resizeObserver = new ResizeObserver(updateCount);
    resizeObserver.observe(leftContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [leftContainerRef]);

  return (
    <div className="bg-primary-white rounded-lg p-3 lg:p-4">
      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
      <div className="space-y-3">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-[160px] h-[90px] shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PreviewContainer Component
 * 
 * 左侧主内容区：媒体预览 + 文件信息（上下排列）
 */
export function PreviewContainer({
  file,
  className = '',
  children,
  onFileUpdate,
}: PreviewContainerProps) {
  return (
    <div
      className={`w-full space-y-4 ${className}`}
      role="region"
      aria-label="文件预览容器"
    >
      {/* 媒体预览区 */}
      <div className="bg-primary-white rounded-lg overflow-hidden w-full">
        {children}
      </div>
      
      {/* 文件信息区（在媒体下方） */}
      <FileMetadata file={file} onFileUpdate={onFileUpdate} />
    </div>
  );
}

/**
 * PreviewArea Component
 * 
 * Fixed 16:9 aspect ratio container for media preview.
 */
interface PreviewAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function PreviewArea({ children, className = '' }: PreviewAreaProps) {
  return (
    <div
      className={`w-full aspect-video bg-black rounded-lg relative ${className}`}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  );
}
