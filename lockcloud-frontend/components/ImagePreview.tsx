'use client';

import { useState, useMemo } from 'react';
import { useDeviceDetect } from '@/lib/hooks/useDeviceDetect';
import { useSignedUrl } from '@/lib/hooks/useSignedUrl';
import { StylePreset } from '@/lib/api/files';
import { thumbHashToDataURL } from 'thumbhash';

interface ImagePreviewProps {
  url: string;
  alt: string;
  s3Key?: string;
  fileId?: number;
  thumbhash?: string;
}

export function ImagePreview({ alt, fileId, thumbhash }: ImagePreviewProps) {
  const { isMobile, isTablet } = useDeviceDetect();
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // 解码 thumbhash
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

  const previewStyle: StylePreset = useMemo(() => {
    if (isMobile) return 'previewmobile';
    if (isTablet) return 'previewtablet';
    return 'previewdesktop';
  }, [isMobile, isTablet]);

  const { url: signedUrl, isLoading: isUrlLoading, error: urlError, refetch } = useSignedUrl(
    fileId,
    previewStyle,
    !!fileId
  );

  const optimizedUrl = signedUrl || '';
  const showLoading = isLoading || isUrlLoading;

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(prev => prev + 1);
    if (fileId) refetch();
  };

  const toggleZoom = () => {
    if (!hasError && !showLoading) {
      setIsZoomed(prev => !prev);
    }
  };

  // 错误状态
  if (hasError || urlError) {
    return (
      <div className="text-center py-12 px-4">
        <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-white mb-2">图片加载失败</h3>
        <p className="text-white/60 text-sm mb-4">无法加载图片</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 cursor-pointer"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ThumbHash 占位背景 - 加载时显示 */}
      {showLoading && placeholderUrl && (
        <div 
          className="absolute inset-0 z-0"
          style={{ 
            backgroundImage: `url(${placeholderUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}

      {/* 加载指示器 */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center bg-black/50 rounded-lg px-4 py-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2" />
            <p className="text-white/80 text-sm">加载图片中...</p>
          </div>
        </div>
      )}

      {/* 实际图片 */}
      <div
        className={`transition-opacity duration-300 ${showLoading ? 'opacity-0' : 'opacity-100'} ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onClick={toggleZoom}
      >
        {optimizedUrl && (
          <img
            key={`${optimizedUrl}-${retryCount}`}
            src={optimizedUrl}
            alt={alt}
            className={`max-w-full max-h-full object-contain transition-transform duration-300 ${isZoomed ? 'scale-150' : 'scale-100'}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>

      {/* 缩放提示 */}
      {!showLoading && (
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-black/70 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 z-20">
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isZoomed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            )}
          </svg>
          <span className="hidden xs:inline">{isZoomed ? '点击缩小' : '点击放大'}</span>
        </div>
      )}
    </>
  );
}
