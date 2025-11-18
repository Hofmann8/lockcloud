'use client';

import { use, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useFileDetails } from '@/lib/hooks/useFileDetails';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorCard } from '@/components/ErrorCard';
import { PathBreadcrumb } from '@/components/PathBreadcrumb';
import { PreviewContainer, PreviewArea } from '@/components/PreviewContainer';
import { FilePreviewErrorBoundary } from '@/components/FilePreviewErrorBoundary';
import { zhCN } from '@/locales/zh-CN';

// Lazy load preview components for code splitting
const ImagePreview = lazy(() => import('@/components/ImagePreview').then(mod => ({ default: mod.ImagePreview })));
const VideoPreviewSimple = lazy(() => import('@/components/VideoPreviewSimple').then(mod => ({ default: mod.VideoPreviewSimple })));
const GenericPreview = lazy(() => import('@/components/GenericPreview').then(mod => ({ default: mod.GenericPreview })));

interface PageProps {
  params: Promise<{ fileId: string }>;
}

function FilePreviewPageContent({ params }: PageProps) {
  const router = useRouter();
  const { fileId } = use(params);
  const fileIdNum = parseInt(fileId, 10);

  // Use the custom hook with enhanced error handling and caching
  const { data: file, isLoading, error } = useFileDetails(
    !isNaN(fileIdNum) ? fileIdNum : null
  );

  const handleBack = () => {
    router.push('/files');
  };

  // Update page title when file is loaded
  useEffect(() => {
    if (file) {
      const filename = file.original_filename || file.filename;
      document.title = `${filename} - ${zhCN.files.title}`;
    }

    // Cleanup: restore default title when component unmounts
    return () => {
      document.title = zhCN.files.title;
    };
  }, [file]);

  // Invalid file ID
  if (isNaN(fileIdNum)) {
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={handleBack}
            aria-label={zhCN.common.back}
            icon={
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
          >
            <span className="hidden xs:inline">{zhCN.common.back}</span>
          </Button>
        </div>
        <ErrorCard
          title="无效的文件ID"
          message="请检查URL是否正确"
          variant="error"
          action={{
            label: zhCN.common.back,
            onClick: handleBack,
          }}
          role="alert"
        />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={handleBack}
            aria-label={zhCN.common.back}
            icon={
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
          >
            <span className="hidden xs:inline">{zhCN.common.back}</span>
          </Button>
        </div>
        <Card variant="bordered" padding="lg" role="status" aria-live="polite" aria-label="加载中">
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-accent-blue mb-3 sm:mb-4" aria-hidden="true"></div>
              <p className="text-accent-gray text-base sm:text-lg">{zhCN.common.loading}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Error state with enhanced error handling
  if (error) {
    const errorMessage = error instanceof Error ? error.message : zhCN.errors.serverError;
    const isNotFound = errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('File not found');
    const isPermissionDenied = errorMessage.includes('403') || errorMessage.includes('Access denied') || errorMessage.includes('Forbidden');
    const isNetworkError = errorMessage.includes('Network') || errorMessage.includes('NETWORK_ERROR') || errorMessage.includes('网络');
    
    // Determine error type and appropriate messaging
    let errorTitle: string;
    let errorMsg: string;
    let errorVariant: 'error' | 'warning' | 'info' = 'error';
    let showRetry = false;

    if (isNotFound) {
      errorTitle = zhCN.errors.fileNotFound;
      errorMsg = "该文件不存在或已被删除，请检查链接是否正确";
      errorVariant = 'warning';
    } else if (isPermissionDenied) {
      errorTitle = zhCN.errors.forbidden;
      errorMsg = "您没有权限访问此文件，请联系文件所有者或管理员";
      errorVariant = 'warning';
    } else if (isNetworkError) {
      errorTitle = zhCN.errors.networkError;
      errorMsg = "网络连接失败，请检查您的网络连接后重试";
      showRetry = true;
    } else {
      errorTitle = "加载失败";
      errorMsg = errorMessage || "无法加载文件信息，请稍后重试";
      showRetry = true;
    }
    
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={handleBack}
            aria-label={zhCN.common.back}
            icon={
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
          >
            <span className="hidden xs:inline">{zhCN.common.back}</span>
          </Button>
        </div>
        <ErrorCard
          title={errorTitle}
          message={errorMsg}
          variant={errorVariant}
          action={{
            label: showRetry ? "重试" : zhCN.common.back,
            onClick: showRetry ? () => window.location.reload() : handleBack,
          }}
          role="alert"
          aria-live="assertive"
        />
      </div>
    );
  }

  // File loaded successfully
  if (!file) {
    return null;
  }

  // Determine file type with null safety
  const contentType = file.content_type || '';
  const isImage = contentType.startsWith('image/');
  const isVideo = contentType.startsWith('video/');

  // Render preview based on file type with lazy loading
  const renderPreview = () => {
    // Loading fallback for lazy-loaded components
    const PreviewLoadingFallback = () => (
      <div className="w-full min-h-[400px] flex items-center justify-center" role="status" aria-live="polite" aria-label="加载预览中">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-accent-blue mb-3 sm:mb-4" aria-hidden="true"></div>
          <p className="text-accent-gray text-base sm:text-lg">{zhCN.common.loading}</p>
        </div>
      </div>
    );

    if (isImage) {
      return (
        <Suspense fallback={<PreviewLoadingFallback />}>
          <ImagePreview
            url={file.public_url}
            alt={file.original_filename || file.filename}
            s3Key={file.s3_key}
          />
        </Suspense>
      );
    }

    if (isVideo) {
      return (
        <Suspense fallback={<PreviewLoadingFallback />}>
          <VideoPreviewSimple
            url={file.public_url}
            filename={file.original_filename || file.filename}
          />
        </Suspense>
      );
    }

    // Generic preview for other file types
    return (
      <Suspense fallback={<PreviewLoadingFallback />}>
        <GenericPreview file={file} />
      </Suspense>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={handleBack}
          aria-label={zhCN.common.back}
          icon={
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          }
        >
          <span className="hidden xs:inline">{zhCN.common.back}</span>
        </Button>
      </div>

      {/* Path Breadcrumb Navigation */}
      <PathBreadcrumb
        activityType={file.activity_type}
        activityTypeDisplay={file.activity_type_display}
        activityDate={file.activity_date}
        filename={file.original_filename || file.filename}
      />
      
      {/* Preview Container with responsive layout */}
      <PreviewContainer file={file}>
        <PreviewArea>
          {renderPreview()}
        </PreviewArea>
      </PreviewContainer>
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
