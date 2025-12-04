'use client';

import { File } from '@/types';
import { FileCardSimple } from './FileCardSimple';

interface FileGridProps {
  files: File[];
  onFileUpdate?: () => void;
  /** Custom render function for file cards (e.g., with selection support) */
  renderFileCard?: (file: File) => React.ReactNode;
}

/**
 * FileGrid - 响应式文件网格布局
 * 
 * 断点适配:
 * - Mobile (< 640px): 1列
 * - Mobile-Large (640px - 767px): 2列
 * - Tablet (768px - 1023px): 2-3列
 * - Desktop (>= 1024px): 4列
 * 
 * Requirements: 3.1, 3.2, 3.5
 */
export function FileGrid({ files, onFileUpdate, renderFileCard }: FileGridProps) {
  return (
    <div 
      className={[
        // 基础网格布局
        'grid',
        // 移动端: 1列 (< 640px)
        'grid-cols-1',
        // 移动端大屏: 2列 (640px - 767px)
        'sm:grid-cols-2',
        // 平板: 2-3列 (768px - 1023px)
        'md:grid-cols-2 lg:grid-cols-3',
        // 桌面端: 4列 (>= 1024px)
        'xl:grid-cols-4',
        // 响应式间距: 移动端较小间距，桌面端较大间距
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
  );
}
