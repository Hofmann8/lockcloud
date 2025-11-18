'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getOptimalImageSize, buildS3ImageUrl, buildOptimizedImageUrl } from '@/lib/utils/responsiveImage';

interface ImagePreviewProps {
  url: string;
  alt: string;
  s3Key?: string; // Optional S3 key for optimized loading
}

/**
 * ImagePreview Component
 * 
 * Displays image files with zoom functionality and responsive scaling.
 * 
 * Features:
 * - Centered display with adaptive scaling
 * - Click to zoom in/out
 * - Loading state with spinner
 * - Error handling with retry option
 * - Responsive design
 * - Automatic image optimization based on device capabilities
 * 
 * Requirements: 3.2, 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function ImagePreview({ url, alt, s3Key }: ImagePreviewProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [optimizedUrl, setOptimizedUrl] = useState<string>(url);

  // Calculate optimized URL on mount and when s3Key changes
  useEffect(() => {
    if (s3Key) {
      // If s3Key is provided, use optimized loading
      const optimized = buildOptimizedImageUrl(s3Key);
      setOptimizedUrl(optimized);
    } else if (url) {
      // Fallback to original URL if no s3Key
      setOptimizedUrl(url);
    } else {
      // If no URL at all, set error state
      setHasError(true);
      setIsLoading(false);
    }
  }, [s3Key, url]);

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
  };

  const toggleZoom = () => {
    if (!hasError && !isLoading) {
      setIsZoomed(prev => !prev);
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] flex items-center justify-center p-3 sm:p-4 lg:p-6" role="region" aria-label="图片预览">
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50" role="status" aria-live="polite" aria-label="加载图片中">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mb-4" aria-hidden="true"></div>
            <p className="text-accent-gray text-sm">加载图片中...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="text-center py-12 px-4" role="alert" aria-live="assertive">
          <div className="mb-4" aria-hidden="true">
            <svg
              className="w-16 h-16 mx-auto text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-primary-black mb-2">
            图片加载失败
          </h3>
          <p className="text-accent-gray mb-1">
            无法加载图片 &ldquo;{alt}&rdquo;
          </p>
          <p className="text-accent-gray/70 text-sm mb-4">
            可能的原因：图片格式不支持、文件损坏或网络连接问题
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-primary-white rounded-lg hover:bg-accent-blue/90 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 transition-colors font-medium"
              aria-label="重试加载图片"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              重试
            </button>
            <a
              href={optimizedUrl}
              download={alt}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gray/20 text-primary-black rounded-lg hover:bg-accent-gray/30 focus:outline-none focus:ring-2 focus:ring-accent-gray focus:ring-offset-2 transition-colors font-medium"
              aria-label={`下载图片 ${alt}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              下载
            </a>
          </div>
        </div>
      )}

      {/* Image Display */}
      {!hasError && (
        <div
          className={`relative max-w-full max-h-full transition-all duration-300 ${
            isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onClick={toggleZoom}
          role="button"
          tabIndex={0}
          aria-label={isZoomed ? '点击缩小图片' : '点击放大图片'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleZoom();
            }
          }}
        >
          <div
            className={`relative transition-transform duration-300 ${
              isZoomed ? 'scale-150' : 'scale-100'
            }`}
            style={{
              maxWidth: isZoomed ? 'none' : '100%',
              maxHeight: isZoomed ? 'none' : 'calc(100vh - 300px)',
            }}
          >
            {optimizedUrl && (
              <Image
                key={`${optimizedUrl}-${retryCount}`}
                src={optimizedUrl}
                alt={alt}
                width={1200}
                height={800}
                className="object-contain w-auto h-auto max-w-full max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-250px)] lg:max-h-[calc(100vh-300px)]"
                onLoad={handleImageLoad}
                onError={handleImageError}
                priority={false}
                loading="lazy"
                quality={85}
                unoptimized
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
            )}
          </div>

          {/* Zoom Hint */}
          {!isLoading && (
            <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-primary-black/70 text-primary-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2" aria-hidden="true">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isZoomed ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                )}
              </svg>
              <span className="hidden xs:inline">{isZoomed ? '点击缩小' : '点击放大'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
