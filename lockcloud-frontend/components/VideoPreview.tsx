'use client';

import { useState, useEffect, lazy, Suspense } from 'react';

// Lazy load the CustomVideoPlayer for better performance
const CustomVideoPlayer = lazy(() => import('./CustomVideoPlayer').then(mod => ({ default: mod.CustomVideoPlayer })));

interface VideoPreviewProps {
  url: string;
  filename: string;
  className?: string;
  aspectRatio?: string; // 例如 "16/9" 或 "4/3"，可选，会自动从缩略图获取
}

/**
 * VideoPreview Component
 * 
 * Container component for video file preview that integrates CustomVideoPlayer
 * with loading states, error handling, and retry mechanism.
 * 
 * Requirements: 3.3
 */
export function VideoPreview({ url, filename, className = '', aspectRatio }: VideoPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string | undefined>(aspectRatio);

  // 从视频第一帧加载原始尺寸
  useEffect(() => {
    if (videoAspectRatio) return; // 已经有比例了
    
    const getVideoFrameUrl = (videoUrl: string): string => {
      // 只获取第一帧，不指定宽度以获取原始尺寸
      return `${videoUrl}?frame=0`;
    };
    
    const img = new Image();
    img.onload = () => {
      const ratio = `${img.width}/${img.height}`;
      setVideoAspectRatio(ratio);
    };
    img.onerror = () => {
      // 如果加载失败，使用默认 16:9
      setVideoAspectRatio('16/9');
    };
    img.src = getVideoFrameUrl(url);
  }, [url, videoAspectRatio]);

  const handleRetry = () => {
    setIsRetrying(true);
    setHasError(false);
    setRetryKey(prev => prev + 1);
    
    setTimeout(() => {
      setIsRetrying(false);
    }, 500);
  };

  const handleVideoError = (event?: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setHasError(true);
    setIsRetrying(false);
    
    if (event?.currentTarget?.error) {
      const mediaError = event.currentTarget.error;
      console.error('Video playback error:', {
        code: mediaError.code,
        message: mediaError.message,
      });
    }
  };

  if (hasError && !isRetrying) {
    return (
      <div className={`w-full min-h-[400px] flex items-center justify-center bg-gray-900 rounded-lg ${className}`} role="alert" aria-live="assertive">
        <div className="text-center text-white p-8 max-w-md">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">视频播放失败</h3>
          <p className="text-gray-400 mb-2">
            无法播放视频文件 &quot;{filename}&quot;
          </p>
          <p className="text-gray-500 text-sm mb-6">
            可能的原因：视频格式不支持、文件损坏或网络连接问题
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-6 py-2 bg-accent-blue hover:bg-accent-blue/90 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-gray-900 text-white rounded-lg transition-colors font-medium"
              aria-label="重试加载视频"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重试
            </button>
            <a
              href={url}
              download={filename}
              className="inline-flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white rounded-lg transition-colors font-medium"
              aria-label={`下载视频文件 ${filename}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isRetrying) {
    return (
      <div className={`w-full min-h-[400px] flex items-center justify-center bg-gray-900 rounded-lg ${className}`} role="status" aria-live="polite" aria-label="重新加载视频中">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" aria-hidden="true"></div>
          <p>重新加载视频中...</p>
        </div>
      </div>
    );
  }

  // 在获取到宽高比之前显示 loading
  if (!videoAspectRatio) {
    return (
      <div className={`w-full aspect-video flex items-center justify-center bg-gray-900 rounded-lg ${className}`} role="status" aria-live="polite" aria-label="加载视频信息中">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" aria-hidden="true"></div>
          <p>加载视频信息中...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full ${className}`}
      style={{ aspectRatio: videoAspectRatio }}
    >
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg" role="status" aria-live="polite" aria-label="加载播放器中">
            <div className="text-center text-white">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" aria-hidden="true"></div>
              <p>加载播放器中...</p>
            </div>
          </div>
        }
      >
        <CustomVideoPlayer
          key={retryKey}
          src={url}
          className="rounded-lg overflow-hidden"
          onError={handleVideoError}
          aspectRatio={videoAspectRatio}
        />
      </Suspense>
    </div>
  );
}
