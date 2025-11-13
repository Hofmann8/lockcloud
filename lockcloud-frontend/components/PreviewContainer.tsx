'use client';

import React from 'react';
import { File } from '@/types';
import { FileMetadata } from './FileMetadata';

interface PreviewContainerProps {
  file: File;
  className?: string;
  children?: React.ReactNode;
  onFileUpdate?: () => void;
}

/**
 * PreviewContainer Component
 * 
 * A responsive container for file preview with two-column layout on desktop
 * and single-column layout on mobile. Provides visual separation between
 * preview area and metadata area.
 * 
 * Layout:
 * - Desktop (≥768px): Two columns - preview (65-70%) | metadata (30-35%)
 * - Mobile (<768px): Single column - preview stacked above metadata
 */
export function PreviewContainer({
  file,
  className = '',
  children,
  onFileUpdate,
}: PreviewContainerProps) {
  return (
    <div
      className={`w-full ${className}`}
      role="region"
      aria-label="文件预览容器"
    >
      {/* Responsive grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6">
        {/* Preview Area - Left/Top */}
        <div className="lg:col-span-8">
          <div className="bg-primary-white rounded-lg overflow-hidden">
            {children}
          </div>
        </div>

        {/* Metadata Area - Right/Bottom */}
        <div className="lg:col-span-4">
          <FileMetadata file={file} onFileUpdate={onFileUpdate} />
        </div>
      </div>
    </div>
  );
}



/**
 * PreviewArea Component
 * 
 * Wrapper for the actual preview content (image, video, or generic)
 */
interface PreviewAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function PreviewArea({ children, className = '' }: PreviewAreaProps) {
  return (
    <div
      className={`w-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] flex items-center justify-center bg-gray-50 ${className}`}
    >
      {children}
    </div>
  );
}
