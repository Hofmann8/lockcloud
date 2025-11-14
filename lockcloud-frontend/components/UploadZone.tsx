'use client';

import { useRef, useState, DragEvent } from 'react';
import { Button } from './Button';
import { zhCN } from '@/locales/zh-CN';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export function UploadZone({
  onFileSelect,
  selectedFile,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // File size limit: 2GB
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB in bytes

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件大小超过限制！\n\n文件大小: ${formatFileSize(file.size)}\n最大限制: 2 GB\n\n请选择小于 2GB 的文件。`);
      return false;
    }
    return true;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFileSize(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFileSize(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${zhCN.units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} ${zhCN.units.kb}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} ${zhCN.units.mb}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${zhCN.units.gb}`;
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getFilePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return url;
    }
    return null;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile-First Upload Zone */}
      <div className="relative">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept="*/*"
          capture="environment"
        />

        {/* Desktop: Drag and Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            hidden md:block
            border-2 border-dashed
            rounded-xl
            p-12
            text-center
            transition-all duration-200
            cursor-pointer
            ${isDragging ? 'bg-accent-blue/10 border-accent-blue border-solid' : 'bg-primary-white border-accent-gray/40'}
            hover:bg-accent-blue/5 hover:border-accent-gray/60
          `}
          onClick={handleSelectFileClick}
        >
          <div className="space-y-4">
            {/* Upload Icon */}
            <div className="flex justify-center">
              <svg
                className="w-16 h-16 text-accent-gray"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <div>
              <p className="text-lg text-primary-black font-medium">
                {zhCN.files.dragDropHint}
              </p>
              <p className="text-sm text-accent-gray mt-2">
                或
              </p>
              <p className="text-xs text-accent-gray mt-2">
                最大文件大小: 2 GB
              </p>
            </div>

            <div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectFileClick();
                }}
              >
                {zhCN.files.selectFile}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile: Simple Upload Button */}
        <div className="md:hidden">
          <div className="bg-white rounded-xl border-2 border-accent-gray/30 p-6">
            <div className="space-y-4">
              {/* Upload Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-accent-blue"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <p className="text-base text-primary-black font-medium">
                  选择要上传的文件
                </p>
                <p className="text-xs text-accent-gray mt-2">
                  支持照片、视频等各类文件
                </p>
                <p className="text-xs text-accent-gray mt-1">
                  最大 2 GB
                </p>
              </div>

              {/* Upload Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleSelectFileClick}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent-green text-white rounded-lg font-medium hover:bg-accent-green/90 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>从相册选择</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    // Trigger file input with camera
                    const input = fileInputRef.current;
                    if (input) {
                      input.setAttribute('capture', 'environment');
                      input.click();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary-black border-2 border-accent-gray/30 rounded-lg font-medium hover:bg-accent-gray/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>拍照上传</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="card-functional p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-primary-black mb-3 md:mb-4">
            已选择文件
          </h3>

          <div className="flex items-start gap-3 md:gap-4">
            {/* File Preview */}
            {previewUrl || getFilePreview(selectedFile) ? (
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border border-accent-gray/20 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl || getFilePreview(selectedFile)!}
                  alt={selectedFile.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-accent-gray/10 flex items-center justify-center border border-accent-gray/20 shrink-0">
                <svg
                  className="w-10 h-10 md:w-12 md:h-12 text-accent-gray"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base font-medium text-primary-black break-all">
                {selectedFile.name}
              </p>
              <p className="text-xs md:text-sm text-accent-gray mt-1">
                {formatFileSize(selectedFile.size)}
              </p>
              <p className="text-xs text-accent-gray mt-1">
                {selectedFile.type || '未知类型'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
