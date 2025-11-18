'use client';

import { useState, lazy, Suspense } from 'react';

// 懒加载播放器
const DanceVideoPlayer = lazy(() => 
  import('./DanceVideoPlayer').then(mod => ({ default: mod.DanceVideoPlayer }))
);

interface VideoPreviewSimpleProps {
  url: string;
  filename: string;
  className?: string;
}

/**
 * VideoPreviewSimple - 简化版视频预览容器
 * 
 * 移除了复杂的缓存逻辑，直接使用浏览器原生缓存
 */
export function VideoPreviewSimple({ 
  url, 
  filename, 
  className = '' 
}: VideoPreviewSimpleProps) {
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = () => {
    setHasError(false);
    setRetryKey(prev => prev + 1);
  };

  const handleError = () => {
    setHasError(true);
  };

  // 错误状态
  if (hasError) {
    return (
      <div className={`w-full min-h-[400px] flex items-center justify-center bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center text-white p-8 max-w-md">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-400"
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
          <h3 className="text-lg font-semibold mb-2">视频播放失败</h3>
          <p className="text-gray-400 mb-6">
            无法播放视频文件 &quot;{filename}&quot;
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg transition-colors font-medium"
            >
              重试
            </button>
            <a
              href={url}
              download={filename}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              下载
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <Suspense
        fallback={
          <div className="w-full aspect-video flex items-center justify-center bg-gray-900 rounded-lg">
            <div className="text-center text-white">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p>加载播放器中...</p>
            </div>
          </div>
        }
      >
        <DanceVideoPlayer
          key={retryKey}
          src={url}
          className="rounded-lg overflow-hidden"
          onError={handleError}
        />
      </Suspense>
    </div>
  );
}
