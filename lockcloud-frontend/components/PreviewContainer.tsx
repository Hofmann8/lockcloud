'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { File } from '@/types';
import { FileMetadata } from './FileMetadata';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

interface AdjacentFile {
  id: number;
  filename: string;
  original_filename?: string;
  content_type?: string;
  public_url?: string;
}

interface PreviewContainerProps {
  file: File;
  className?: string;
  children?: React.ReactNode;
  onFileUpdate?: () => void;
  adjacentFiles?: {
    previous: AdjacentFile | null;
    next: AdjacentFile | null;
    previous_files?: AdjacentFile[];
    next_files?: AdjacentFile[];
  };
}

/**
 * PreviewContainer Component
 * 
 * A responsive container for file preview with two-column layout on desktop
 * and single-column layout on mobile. Provides visual separation between
 * preview area and metadata area.
 * 
 * Layout:
 * - Desktop (≥1024px): Two columns - preview (8/12) | metadata (4/12)
 * - Tablet (768px-1023px): Two columns with adjusted proportions
 * - Mobile (<768px): Single column - preview full width, metadata stacked below
 */
export function PreviewContainer({
  file,
  className = '',
  children,
  onFileUpdate,
  adjacentFiles,
}: PreviewContainerProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleNavigate = (fileId: number) => {
    router.push(`/files/${fileId}`);
  };

  // 构建导航列表：移动端显示更少的缩略图
  const navFiles: (AdjacentFile & { isCurrent?: boolean })[] = useMemo(() => {
    const files: (AdjacentFile & { isCurrent?: boolean })[] = [];
    
    // 移动端只显示前1个 + 当前 + 后1个，桌面端显示前3个 + 当前 + 后3个
    const maxAdjacentCount = isMobile ? 1 : 3;
    
    // 添加前面的文件
    if (adjacentFiles?.previous_files) {
      files.push(...adjacentFiles.previous_files.slice(-maxAdjacentCount));
    } else if (adjacentFiles?.previous) {
      files.push(adjacentFiles.previous);
    }
    
    // 添加当前文件
    files.push({ ...file, isCurrent: true } as AdjacentFile & { isCurrent: boolean });
    
    // 添加后面的文件
    if (adjacentFiles?.next_files) {
      files.push(...adjacentFiles.next_files.slice(0, maxAdjacentCount));
    } else if (adjacentFiles?.next) {
      files.push(adjacentFiles.next);
    }
    
    return files;
  }, [adjacentFiles, file, isMobile]);

  // 移动端缩略图尺寸更小
  const thumbnailSize = isMobile 
    ? { width: '80px', height: '45px' } 
    : { width: '140px', height: '79px' };

  return (
    <div
      className={`w-full ${className}`}
      role="region"
      aria-label="文件预览容器"
    >
      {/* Responsive grid layout - single column on mobile, two columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 lg:gap-6">
        {/* Preview Area - Full width on mobile, 8/12 on desktop */}
        <div className="w-full lg:col-span-8 space-y-3">
          {/* Preview content - full width on mobile */}
          <div className="bg-primary-white rounded-lg overflow-hidden w-full">
            {children}
          </div>
          
          {/* Adjacent Files Navigation Bar - optimized for mobile */}
          {navFiles.length > 1 && (
            <div className="bg-gray-900 rounded-lg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-3">
                {/* Previous button - larger touch target on mobile */}
                <button
                  onClick={() => adjacentFiles?.previous && handleNavigate(adjacentFiles.previous.id)}
                  disabled={!adjacentFiles?.previous}
                  className={`shrink-0 p-2.5 md:p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    adjacentFiles?.previous 
                      ? 'hover:bg-white/10 active:bg-white/20 text-white cursor-pointer' 
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  aria-label="上一个文件"
                >
                  <svg className="w-5 h-5 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {/* File thumbnails - fewer and smaller on mobile */}
                <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-1 overflow-hidden py-1">
                  {navFiles.map((navFile) => {
                    const isCurrent = 'isCurrent' in navFile && navFile.isCurrent;
                    const isVideo = navFile.content_type?.startsWith('video/');
                    const isImage = navFile.content_type?.startsWith('image/');
                    
                    return (
                      <button
                        key={navFile.id}
                        onClick={() => !isCurrent && handleNavigate(navFile.id)}
                        disabled={isCurrent}
                        className={`
                          shrink-0 relative rounded-md md:rounded-lg overflow-hidden transition-all
                          ${isCurrent 
                            ? 'ring-2 ring-orange-500 ring-offset-1 md:ring-offset-2 ring-offset-gray-900 scale-105' 
                            : 'hover:ring-2 hover:ring-white/50 active:ring-white/70 cursor-pointer opacity-80 hover:opacity-100'
                          }
                        `}
                        title={navFile.original_filename || navFile.filename}
                        style={thumbnailSize}
                      >
                        {/* 图片/视频缩略图 - 使用缤纷云处理参数 */}
                        {(isVideo || isImage) && navFile.public_url ? (
                          <img 
                            src={`${navFile.public_url}${navFile.public_url.includes('?') ? '&' : '?'}${isVideo ? 'frame=100&' : ''}w=${isMobile ? 160 : 280}`}
                            alt={navFile.original_filename || navFile.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          /* Fallback placeholder */
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <svg className="w-4 h-4 md:w-6 md:h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        
                        {/* Current indicator - smaller on mobile */}
                        {isCurrent && (
                          <div className="absolute bottom-0.5 md:bottom-1 left-1/2 -translate-x-1/2 px-1.5 md:px-2 py-0.5 bg-orange-500 rounded text-[8px] md:text-[10px] text-white font-medium">
                            当前
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Next button - larger touch target on mobile */}
                <button
                  onClick={() => adjacentFiles?.next && handleNavigate(adjacentFiles.next.id)}
                  disabled={!adjacentFiles?.next}
                  className={`shrink-0 p-2.5 md:p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    adjacentFiles?.next 
                      ? 'hover:bg-white/10 active:bg-white/20 text-white cursor-pointer' 
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  aria-label="下一个文件"
                >
                  <svg className="w-5 h-5 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Area - Full width on mobile (stacked below), 4/12 on desktop */}
        <div className="w-full lg:col-span-4">
          <FileMetadata file={file} onFileUpdate={onFileUpdate} />
        </div>
      </div>
    </div>
  );
}



/**
 * PreviewArea Component
 * 
 * Fixed 16:9 aspect ratio container for media preview.
 * Non-standard aspect ratio content will be centered with black/blur background.
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
