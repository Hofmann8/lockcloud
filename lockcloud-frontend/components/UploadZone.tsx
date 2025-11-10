'use client';

import { useRef, useState, DragEvent } from 'react';
import { Button } from './Button';
import { FileNameValidator } from './FileNameValidator';
import { zhCN } from '@/locales/zh-CN';
import { useFileStore } from '@/stores/fileStore';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onUpload: () => void;
  isUploading: boolean;
  fileNameError?: string;
}

export function UploadZone({
  onFileSelect,
  selectedFile,
  onUpload,
  isUploading,
  fileNameError,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadProgress } = useFileStore();

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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
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
      {/* Drag and Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed
          rounded-xl
          p-8 md:p-12
          text-center
          transition-all duration-200
          cursor-pointer
          ${isDragging ? 'bg-accent-blue/10 border-accent-blue border-solid' : 'bg-primary-white border-accent-gray/40'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent-blue/5 hover:border-accent-gray/60'}
        `}
        onClick={handleSelectFileClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <div className="space-y-3 md:space-y-4">
          {/* Upload Icon */}
          <div className="flex justify-center">
            <svg
              className="w-12 h-12 md:w-16 md:h-16 text-accent-gray"
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

          {/* Drag and Drop Text */}
          <div>
            <p className="text-base md:text-lg text-primary-black font-medium">
              {zhCN.files.dragDropHint}
            </p>
            <p className="text-sm md:text-sm text-accent-gray mt-2">
              或
            </p>
          </div>

          {/* Select File Button */}
          <div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFileClick();
              }}
              disabled={isUploading}
            >
              {zhCN.files.selectFile}
            </Button>
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
            </div>
          </div>

          {/* File Name Validation */}
          <div className="mt-3 md:mt-4">
            <FileNameValidator filename={selectedFile.name} />
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="card-functional p-4 md:p-6">
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-sm font-medium text-primary-black">
                {zhCN.files.uploading}
              </span>
              <span className="text-sm md:text-sm text-accent-gray">
                {uploadProgress}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-2 md:h-3 bg-accent-gray/20 rounded-md overflow-hidden">
              <div
                className="h-full bg-accent-green transition-all duration-300 rounded-md"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !isUploading && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="success"
            size="lg"
            onClick={onUpload}
            disabled={!!fileNameError}
          >
            {zhCN.common.upload}
          </Button>
        </div>
      )}
    </div>
  );
}
