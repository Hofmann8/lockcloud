'use client';

import { useMemo } from 'react';
import { File } from '@/types';
import { FileCardSimple } from './FileCardSimple';
import { SignedUrlProvider } from '@/contexts/SignedUrlContext';
import { useDeviceDetect } from '@/lib/hooks/useDeviceDetect';
import { StylePreset } from '@/lib/api/files';

interface FileGridProps {
  files: File[];
  onFileUpdate?: () => void;
  /** Custom render function for file cards (e.g., with selection support) */
  renderFileCard?: (file: File) => React.ReactNode;
}

/**
 * FileGrid - 响应式文件网格布局
 * 
 * 使用 SignedUrlProvider 批量获取签名 URL，减少请求数量
 */
export function FileGrid({ files, onFileUpdate, renderFileCard }: FileGridProps) {
  const { isMobile } = useDeviceDetect();
  
  // 根据设备选择缩略图样式
  const thumbnailStyle: StylePreset = isMobile ? 'thumbmobile' : 'thumbdesktop';

  return (
    <SignedUrlProvider files={files} style={thumbnailStyle}>
      <div 
        className={[
          'grid',
          'grid-cols-1',
          'sm:grid-cols-2',
          'md:grid-cols-2 lg:grid-cols-3',
          'xl:grid-cols-4',
          'gap-3 sm:gap-4 md:gap-5 lg:gap-6',
        ].join(' ')}
      >
        {files.map((file) => (
          <div key={file.id}>
            {renderFileCard ? (
              renderFileCard(file)
            ) : (
              <FileCardSimple 
                file={file} 
                onFileUpdate={onFileUpdate}
              />
            )}
          </div>
        ))}
      </div>
    </SignedUrlProvider>
  );
}
