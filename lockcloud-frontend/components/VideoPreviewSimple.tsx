'use client';

import { useState, useMemo } from 'react';
import { useSignedUrl } from '@/lib/hooks/useSignedUrl';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { thumbHashToDataURL } from 'thumbhash';

interface VideoPreviewSimpleProps {
  url: string;
  filename: string;
  fileId?: number;
  className?: string;
  defaultQuality?: number;
  thumbhash?: string;
}

// HLS style：hls: 前缀告诉后端生成 !style:medium/auto_medium.m3u8 格式
const HLS_STYLE = 'hls:medium/auto_medium.m3u8';

/**
 * VideoPreviewSimple - 视频预览容器
 * 使用 HLS 流媒体播放，支持清晰度选择
 */
export function VideoPreviewSimple({ 
  url, 
  filename, 
  fileId,
  className = '',
  defaultQuality = 1080,
  thumbhash
}: VideoPreviewSimpleProps) {
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // 获取 HLS 签名 URL
  const { url: hlsSignedUrl, isLoading, refetch } = useSignedUrl(
    fileId,
    HLS_STYLE as any,
    !!fileId
  );

  // 解码 thumbhash 生成占位图
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

  const handleRetry = () => {
    setHasError(false);
    setRetryKey(prev => prev + 1);
    if (fileId) refetch();
  };

  // 错误状态
  if (hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white p-8 max-w-md">
          <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-base font-semibold mb-1">播放失败</h3>
          <p className="text-gray-400 text-sm mb-4">{filename}</p>
          <button onClick={handleRetry} className="px-4 py-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm cursor-pointer">
            重试
          </button>
        </div>
      </div>
    );
  }

  // HLS URL 加载中 - 显示占位图和加载指示器
  if (isLoading || (!hlsSignedUrl && fileId)) {
    return (
      <div className={`w-full h-full relative bg-black ${className}`}>
        {/* ThumbHash 占位图 */}
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
            <p className="text-white/80 text-sm">加载视频...</p>
          </div>
        </div>
      </div>
    );
  }

  // 使用 HLS URL，如果没有 fileId 则回退到原始 URL
  const videoUrl = hlsSignedUrl || url;

  return (
    <div className={`w-full h-full ${className}`}>
      <ModernVideoPlayer
        key={retryKey}
        src={videoUrl}
        fileId={fileId}
        className="w-full h-full"
        onError={() => setHasError(true)}
        defaultQuality={defaultQuality}
        poster={placeholderUrl || undefined}
      />
    </div>
  );
}
