'use client';

import { use, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useFileDetails } from '@/lib/hooks/useFileDetails';
import { useFileStore } from '@/stores/fileStore';
import { getAdjacentFiles } from '@/lib/api/files';
import { Button } from '@/components/Button';
import { ErrorCard } from '@/components/ErrorCard';
import { PathBreadcrumb } from '@/components/PathBreadcrumb';
import { PreviewContainer, PreviewArea, AdjacentFilesSidebar, SidebarSkeleton } from '@/components/PreviewContainer';
import { FilePreviewErrorBoundary } from '@/components/FilePreviewErrorBoundary';
import { zhCN } from '@/locales/zh-CN';
import { thumbHashToDataURL } from 'thumbhash';

// Lazy load preview components for code splitting
const ImagePreview = lazy(() => import('@/components/ImagePreview').then(mod => ({ default: mod.ImagePreview })));
const VideoPreviewSimple = lazy(() => import('@/components/VideoPreviewSimple').then(mod => ({ default: mod.VideoPreviewSimple })));
const GenericPreview = lazy(() => import('@/components/GenericPreview').then(mod => ({ default: mod.GenericPreview })));

interface PageProps {
  params: Promise<{ fileId: string }>;
}

// 预览区域加载骨架（支持 thumbhash 占位图）
function PreviewSkeleton({ thumbhash }: { thumbhash?: string }) {
  const placeholderUrl = useMemo(() => {
    if (!thumbhash) return null;
    try {
      const binary = atob(thumbhash);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return thumbHashToDataURL(bytes);
    } catch {
      return null;
    }
  }, [thumbhash]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg relative overflow-hidden">
      {/* ThumbHash 模糊占位图 - 用 background 铺满 */}
      {placeholderUrl && (
        <div 
          className="absolute inset-0"
          style={{ 
            backgroundImage: `url(${placeholderUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}
      {/* 加载指示器 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center z-10 bg-black/50 rounded-lg px-4 py-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2" />
          <p className="text-white/80 text-sm">加载中...</p>
        </div>
      </div>
    </div>
  );
}

// 面包屑骨架
function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2 h-6">
      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  );
}

// 左侧主内容骨架组件
function MainContentSkeleton({ thumbhash }: { thumbhash?: string }) {
  return (
    <div className="space-y-4">
      {/* 媒体预览骨架 */}
      <div className="bg-primary-white rounded-lg overflow-hidden">
        <PreviewSkeleton thumbhash={thumbhash} />
      </div>
      
      {/* 文件信息骨架 */}
      <div className="bg-primary-white rounded-lg p-4 space-y-4">
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="border-t pt-4 space-y-3">
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilePreviewPageContent({ params }: PageProps) {
  const router = useRouter();
  const { fileId } = use(params);
  const fileIdNum = parseInt(fileId, 10);
  
  // 左侧容器 ref，用于计算右侧边栏显示数量
  const leftContainerRef = useRef<HTMLDivElement>(null);

  // 从 store 获取缓存的文件信息（从列表页点击时设置）
  const cachedFile = useFileStore((state) => state.selectedFile);
  const clearSelectedFile = useFileStore((state) => state.setSelectedFile);
  
  // 检查缓存是否匹配当前文件
  const validCachedFile = useMemo(() => {
    return cachedFile?.id === fileIdNum ? cachedFile : null;
  }, [cachedFile, fileIdNum]);

  const { data: fetchedFile, error, refetch } = useFileDetails(
    !isNaN(fileIdNum) ? fileIdNum : null
  );

  // 优先使用 API 返回的数据，其次使用缓存
  const file = fetchedFile || validCachedFile;

  // 清理缓存（当 API 数据加载完成后）
  useEffect(() => {
    if (fetchedFile && cachedFile) {
      clearSelectedFile(null);
    }
  }, [fetchedFile, cachedFile, clearSelectedFile]);

  const handleFileUpdate = () => refetch();

  // 请求固定数量的相邻文件，前端根据左侧高度动态显示
  const { data: adjacentFiles } = useQuery({
    queryKey: ['adjacent-files', fileIdNum],
    queryFn: () => getAdjacentFiles(fileIdNum, 10), // 请求10个，前端按需显示
    enabled: !isNaN(fileIdNum) && !!file,
    staleTime: 5 * 60 * 1000,
  });

  const handleBack = () => router.back();

  // Update page title
  useEffect(() => {
    if (file) {
      document.title = `${file.original_filename || file.filename} - ${zhCN.files.title}`;
    }
    return () => { document.title = zhCN.files.title; };
  }, [file]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && adjacentFiles?.previous) {
        e.preventDefault();
        router.push(`/files/${adjacentFiles.previous.id}`);
      } else if (e.key === 'ArrowRight' && adjacentFiles?.next) {
        e.preventDefault();
        router.push(`/files/${adjacentFiles.next.id}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adjacentFiles, router]);

  // Invalid file ID - 立即返回错误
  if (isNaN(fileIdNum)) {
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="md" onClick={handleBack} aria-label={zhCN.common.back}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>}
          >
            <span className="hidden xs:inline">{zhCN.common.back}</span>
          </Button>
        </div>
        <ErrorCard title="无效的文件ID" message="请检查URL是否正确" variant="error"
          action={{ label: zhCN.common.back, onClick: handleBack }} role="alert"
        />
      </div>
    );
  }

  // 渲染预览内容（只在有 file 时调用）
  const renderPreviewContent = () => {
    if (!file) return null;

    const contentType = file.content_type || '';
    const isImage = contentType.startsWith('image/');
    const isVideo = contentType.startsWith('video/');

    if (isImage) {
      return (
        <Suspense fallback={<PreviewSkeleton thumbhash={file.thumbhash} />}>
          <ImagePreview 
            url={file.public_url} 
            alt={file.original_filename || file.filename} 
            fileId={file.id}
            thumbhash={file.thumbhash}
          />
        </Suspense>
      );
    }

    if (isVideo) {
      return (
        <Suspense fallback={<PreviewSkeleton thumbhash={file.thumbhash} />}>
          <VideoPreviewSimple 
            url={file.public_url} 
            filename={file.original_filename || file.filename} 
            fileId={file.id}
            thumbhash={file.thumbhash}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<PreviewSkeleton />}>
        <GenericPreview file={file} />
      </Suspense>
    );
  };

  // 页面框架立即渲染，内容区域按需加载
  // YouTube 风格布局：左侧（返回按钮+面包屑+主内容）+ 右侧（相邻文件列表从顶部开始）
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* 左侧主区域 */}
      <div ref={leftContainerRef} className="flex-1 min-w-0 lg:max-w-[calc(100%-384px)] xl:max-w-[calc(100%-424px)] space-y-3 sm:space-y-4">
        {/* Header - 立即渲染 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="md" onClick={handleBack} aria-label={zhCN.common.back}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>}
          >
            <span className="hidden xs:inline">{zhCN.common.back}</span>
          </Button>
        </div>

        {/* Breadcrumb - 有数据时渲染，否则骨架 */}
        {file ? (
          <PathBreadcrumb
            activityType={file.activity_type}
            activityTypeDisplay={file.activity_type_display}
            activityDate={file.activity_date}
            filename={file.filename || file.original_filename}
          />
        ) : !error && (
          <BreadcrumbSkeleton />
        )}
        
        {/* 错误状态 */}
        {error && (
          <ErrorCard 
            title={
              error.message?.includes('not found') ? zhCN.errors.fileNotFound :
              error.message?.includes('Access denied') ? zhCN.errors.forbidden :
              error.message?.includes('Network') ? zhCN.errors.networkError : "加载失败"
            }
            message={
              error.message?.includes('not found') ? "该文件不存在或已被删除" :
              error.message?.includes('Access denied') ? "您没有权限访问此文件" :
              error.message?.includes('Network') ? "网络连接失败，请重试" : 
              (error instanceof Error ? error.message : "无法加载文件信息")
            }
            variant={error.message?.includes('not found') || error.message?.includes('Access denied') ? 'warning' : 'error'}
            action={{ label: "重试", onClick: () => refetch() }}
            role="alert"
          />
        )}
        
        {/* 主内容区 - 有数据时完整渲染，否则显示骨架 */}
        {file ? (
          <PreviewContainer file={file} onFileUpdate={handleFileUpdate}>
            <PreviewArea>
              {renderPreviewContent()}
            </PreviewArea>
          </PreviewContainer>
        ) : !error && (
          <MainContentSkeleton thumbhash={cachedFile?.thumbhash} />
        )}
      </div>

      {/* 右侧边栏：相邻文件列表 - 从顶部开始 */}
      <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0">
        {file && adjacentFiles ? (
          <AdjacentFilesSidebar adjacentFiles={adjacentFiles} leftContainerRef={leftContainerRef} />
        ) : !error && (
          <SidebarSkeleton leftContainerRef={leftContainerRef} />
        )}
      </div>
    </div>
  );
}

export default function FilePreviewPage({ params }: PageProps) {
  return (
    <FilePreviewErrorBoundary>
      <FilePreviewPageContent params={params} />
    </FilePreviewErrorBoundary>
  );
}
