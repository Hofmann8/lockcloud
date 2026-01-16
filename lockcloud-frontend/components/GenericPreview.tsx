'use client';

import { File } from '@/types';
import { useSignedUrl } from '@/lib/hooks/useSignedUrl';
import { zhCN } from '@/locales/zh-CN';
import toast from 'react-hot-toast';

interface GenericPreviewProps {
  file: File;
}

/**
 * GenericPreview Component
 * 
 * Displays a placeholder preview for file types that don't have specialized preview support.
 * Shows file type icon, file information, and provides download functionality.
 * 
 * Features:
 * - File type icon based on content type
 * - File name and size display
 * - Download button
 * - Friendly message for unsupported preview types
 * 
 * Requirements: 3.4
 */
export function GenericPreview({ file }: GenericPreviewProps) {
  // 获取原始文件的签名 URL 用于下载
  const { url: downloadUrl } = useSignedUrl(file.id, 'original', true);

  // Format file size with null safety
  const formatSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return '未知';
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ${zhCN.units.gb}`;
  };

  // Get file type icon based on content type
  const getFileIcon = () => {
    const contentType = (file.content_type || '').toLowerCase();
    
    // Document types
    if (contentType.includes('pdf')) {
      return (
        <svg className="w-20 h-20 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" fill="white" />
        </svg>
      );
    }
    
    if (contentType.includes('word') || contentType.includes('document')) {
      return (
        <svg className="w-20 h-20 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" fill="white" />
        </svg>
      );
    }
    
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
      return (
        <svg className="w-20 h-20 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" fill="white" />
        </svg>
      );
    }
    
    if (contentType.includes('powerpoint') || contentType.includes('presentation')) {
      return (
        <svg className="w-20 h-20 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" fill="white" />
        </svg>
      );
    }
    
    // Archive types
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('7z') || contentType.includes('tar')) {
      return (
        <svg className="w-20 h-20 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M12 11v2m0 2v2m0-8v2" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }
    
    // Text types
    if (contentType.includes('text')) {
      return (
        <svg className="w-20 h-20 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    }
    
    // Audio types
    if (contentType.includes('audio')) {
      return (
        <svg className="w-20 h-20 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M9 13a2 2 0 100 4 2 2 0 000-4zm0 0V9l4-1v5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    
    // Default file icon
    return (
      <svg className="w-20 h-20 text-accent-gray" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 2v6h6" fill="white" />
      </svg>
    );
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      toast.error('下载链接获取中，请稍后重试');
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] flex items-center justify-center p-4 sm:p-6 lg:p-8" role="region" aria-label="文件预览">
      <div className="text-center max-w-md px-2">
        {/* File Icon */}
        <div className="mb-4 sm:mb-6 flex justify-center" aria-hidden="true">
          {getFileIcon()}
        </div>

        {/* File Name */}
        <h3 className="text-lg sm:text-xl font-semibold text-primary-black mb-2 break-all">
          {file.filename}
        </h3>

        {/* File Size */}
        <p className="text-sm sm:text-base text-accent-gray mb-4 sm:mb-6">
          {formatSize(file.size)}
        </p>

        {/* Friendly Message */}
        <p className="text-xs sm:text-sm text-accent-gray mb-6 sm:mb-8 leading-relaxed" role="status">
          此文件类型暂不支持在线预览，请下载后查看
        </p>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-accent-blue text-primary-white rounded-lg hover:bg-accent-blue/90 active:bg-accent-blue/80 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 transition-colors font-medium shadow-sm hover:shadow-md touch-manipulation text-sm sm:text-base"
          aria-label={`下载文件 ${file.filename}`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {zhCN.common.download}
        </button>

        {/* Content Type Info */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-accent-gray/20">
          <p className="text-xs text-accent-gray break-all">
            文件类型: <span className="font-medium text-primary-black">{file.content_type || '未知'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
