'use client';

import { createContext, useContext, useMemo } from 'react';
import { File } from '@/types';
import { useSignedUrlsBatch, getCachedSignedUrl } from '@/lib/hooks/useSignedUrl';
import { StylePreset } from '@/lib/api/files';

interface SignedUrlContextValue {
  getUrl: (fileId: number) => string | null;
  isLoading: boolean;
}

const SignedUrlContext = createContext<SignedUrlContextValue | null>(null);

interface SignedUrlProviderProps {
  files: File[];
  style: StylePreset;
  children: React.ReactNode;
}

/**
 * 批量签名 URL Provider
 * 在列表层级批量获取所有文件的签名 URL，子组件通过 context 读取
 */
export function SignedUrlProvider({ files, style, children }: SignedUrlProviderProps) {
  // 根据文件类型分组，图片和视频使用不同的 style
  const { imageIds, videoIds, imageStyle, videoStyle } = useMemo(() => {
    const imageIds: number[] = [];
    const videoIds: number[] = [];
    
    for (const file of files) {
      if (file.content_type.startsWith('video/')) {
        videoIds.push(file.id);
      } else if (file.content_type.startsWith('image/')) {
        imageIds.push(file.id);
      }
    }
    
    // 映射视频样式
    const styleToVideoStyle: Record<string, StylePreset> = {
      'thumbmobile': 'videothumbmobile',
      'thumbdesktop': 'videothumbdesktop',
      'thumbnav': 'videothumbnav',
      'thumbnavdesktop': 'videothumbnavdesktop',
    };
    
    return {
      imageIds,
      videoIds,
      imageStyle: style,
      videoStyle: styleToVideoStyle[style] || style,
    };
  }, [files, style]);

  // 批量获取图片 URL
  const { urls: imageUrls, isLoading: imageLoading } = useSignedUrlsBatch(
    imageIds,
    imageStyle,
    imageIds.length > 0
  );

  // 批量获取视频 URL
  const { urls: videoUrls, isLoading: videoLoading } = useSignedUrlsBatch(
    videoIds,
    videoStyle,
    videoIds.length > 0
  );

  const value = useMemo<SignedUrlContextValue>(() => ({
    getUrl: (fileId: number) => {
      // 先从批量结果中查找
      if (imageUrls[fileId]) return imageUrls[fileId];
      if (videoUrls[fileId]) return videoUrls[fileId];
      // 再从缓存中查找（可能是之前加载的）
      const file = files.find(f => f.id === fileId);
      if (file) {
        const s = file.content_type.startsWith('video/') ? videoStyle : imageStyle;
        return getCachedSignedUrl(fileId, s);
      }
      return null;
    },
    isLoading: imageLoading || videoLoading,
  }), [imageUrls, videoUrls, imageLoading, videoLoading, files, imageStyle, videoStyle]);

  return (
    <SignedUrlContext.Provider value={value}>
      {children}
    </SignedUrlContext.Provider>
  );
}

/**
 * 获取签名 URL 的 hook，从 context 读取
 */
export function useSignedUrlFromContext(fileId: number): { url: string | null; isLoading: boolean } {
  const context = useContext(SignedUrlContext);
  
  if (!context) {
    // 没有 Provider 时返回空，组件可以 fallback 到单独请求
    return { url: null, isLoading: false };
  }
  
  return {
    url: context.getUrl(fileId),
    isLoading: context.isLoading,
  };
}
