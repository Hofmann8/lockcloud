'use client';

import { useRef, useState, DragEvent } from 'react';
import { Button } from './Button';

interface FileWithCustomName {
  id: string;
  file: File;
  customFilename: string;
}

interface MultiFileUploadZoneProps {
  filesWithNames: FileWithCustomName[];
  onFilesChange: (files: FileWithCustomName[]) => void;
  existingFiles?: Set<string>;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Allowed file extensions (must match backend)
const ALLOWED_EXTENSIONS = [
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
  // Videos
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz'
];

export function MultiFileUploadZone({ filesWithNames, onFilesChange, existingFiles = new Set() }: MultiFileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

  const validateFileExtension = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      alert(
        `不支持的文件类型: ${file.name}\n\n` +
        `允许的文件类型：\n` +
        `• 图片：jpg, jpeg, png, gif, bmp, webp, svg\n` +
        `• 视频：mp4, mov, avi, mkv, webm, flv, wmv\n` +
        `• 音频：mp3, wav, flac, aac, m4a, ogg\n` +
        `• 文档：pdf, doc, docx, xls, xlsx, ppt, pptx, txt\n` +
        `• 压缩包：zip, rar, 7z, tar, gz`
      );
      return false;
    }
    return true;
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件 "${file.name}" 大小超过限制（最大 2GB）`);
      return false;
    }
    return true;
  };

  const validateFile = (file: File): boolean => {
    return validateFileExtension(file) && validateFileSize(file);
  };

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

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(validateFile);
    
    if (validFiles.length > 0) {
      const newFiles = validFiles.map(file => ({
        id: generateId(),
        file,
        customFilename: '',
      }));
      onFilesChange([...filesWithNames, ...newFiles]);
    }
    
    // Show message if some files were rejected
    if (validFiles.length < files.length) {
      const rejectedCount = files.length - validFiles.length;
      alert(`已过滤 ${rejectedCount} 个不支持的文件`);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = files.filter(validateFile);
    
    if (validFiles.length > 0) {
      const newFiles = validFiles.map(file => ({
        id: generateId(),
        file,
        customFilename: '',
      }));
      onFilesChange([...filesWithNames, ...newFiles]);
    }
    
    // Show message if some files were rejected
    if (validFiles.length < files.length) {
      const rejectedCount = files.length - validFiles.length;
      alert(`已过滤 ${rejectedCount} 个不支持的文件`);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateCustomFilename = (id: string, filename: string) => {
    onFilesChange(
      filesWithNames.map(f => (f.id === id ? { ...f, customFilename: filename } : f))
    );
  };

  // Check for duplicate filenames
  const getDuplicateFilenames = () => {
    const filenameMap = new Map<string, number>();
    
    filesWithNames.forEach(item => {
      // Get final filename (custom or original)
      const customName = item.customFilename.trim();
      const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
      const finalName = customName ? `${customName}${extension}` : item.file.name;
      
      filenameMap.set(finalName, (filenameMap.get(finalName) || 0) + 1);
    });
    
    // Return set of duplicate filenames
    return new Set(
      Array.from(filenameMap.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    );
  };

  const duplicates = getDuplicateFilenames();

  const getFileDisplayName = (item: FileWithCustomName) => {
    const customName = item.customFilename.trim();
    const extension = item.file.name.match(/\.[^/.]+$/)?.[0] || '';
    return customName ? `${customName}${extension}` : item.file.name;
  };

  const removeFile = (id: string) => {
    onFilesChange(filesWithNames.filter(f => f.id !== id));
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept="*/*"
          multiple
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
                拖拽文件到这里，或点击选择
              </p>
              <p className="text-sm text-accent-gray mt-2">
                支持多文件上传
              </p>
              <p className="text-xs text-accent-gray mt-2">
                单个文件最大 2 GB
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
                选择文件
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile: Simple Upload Button - optimized for touch */}
        <div className="md:hidden">
          <div className="bg-white rounded-xl border-2 border-accent-gray/30 p-5">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-accent-blue/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-accent-blue"
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
                  支持图片、视频、音频、文档、压缩包
                </p>
                <p className="text-xs text-accent-gray mt-1">
                  单个文件最大 2 GB
                </p>
              </div>

              {/* Large touch-friendly button */}
              <button
                type="button"
                onClick={handleSelectFileClick}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent-green text-white rounded-xl font-medium 
                  hover:bg-accent-green/90 active:bg-accent-green/80 active:scale-[0.98] transition-all
                  min-h-[56px] touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-base">选择文件</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Files Preview with Custom Filename */}
      {filesWithNames.length > 0 && (
        <div className="card-functional p-3 md:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm md:text-base font-semibold text-primary-black">
              已选择 {filesWithNames.length} 个文件
            </h3>
            <button
              onClick={() => onFilesChange([])}
              className="px-3 py-1.5 text-xs text-accent-gray hover:text-semantic-error hover:bg-semantic-error/10 rounded-lg transition-colors min-h-[36px] md:min-h-0"
            >
              清空
            </button>
          </div>

          <div className="space-y-2 max-h-80 md:max-h-96 overflow-y-auto">
            {filesWithNames.map((fileItem) => {
              const fileExtension = fileItem.file.name.match(/\.[^/.]+$/)?.[0] || '';
              
              return (
                <div key={fileItem.id} className="flex flex-col gap-2 p-3 bg-accent-gray/5 rounded-lg">
                  {/* File Info Row */}
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 rounded bg-accent-gray/10 flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4 text-accent-gray"
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

                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-medium text-primary-black truncate" title={fileItem.file.name}>
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-accent-gray">
                        {formatFileSize(fileItem.file.size)}
                      </p>
                    </div>

                    {/* Remove button - larger touch target on mobile */}
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="p-2 md:p-1.5 hover:bg-accent-gray/10 active:bg-accent-gray/20 rounded-lg transition-colors min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                      title="移除文件"
                    >
                      <svg className="w-4 h-4 text-accent-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Custom Filename Input Row - mobile optimized */}
                  <div className="flex items-center gap-2 pl-0 md:pl-11">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={fileItem.customFilename}
                        onChange={(e) => updateCustomFilename(fileItem.id, e.target.value)}
                        placeholder="自定义文件名（可选）"
                        className={`w-full px-3 py-2.5 md:py-1.5 pr-16 text-sm md:text-xs border rounded-lg focus:ring-1 focus:outline-none placeholder:text-accent-gray/50
                          min-h-[44px] md:min-h-0
                          ${
                          duplicates.has(getFileDisplayName(fileItem)) || existingFiles.has(getFileDisplayName(fileItem))
                            ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20'
                            : 'border-accent-gray/30 focus:border-accent-green focus:ring-accent-green/20'
                        }`}
                      />
                      {fileExtension && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent-gray pointer-events-none bg-white px-1">
                          {fileExtension}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Duplicate warning */}
                  {duplicates.has(getFileDisplayName(fileItem)) && (
                    <div className="flex items-start gap-1 pl-0 md:pl-11 text-xs text-semantic-error">
                      <svg className="w-3 h-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>任务内文件名重复</span>
                    </div>
                  )}

                  {/* Database existing file warning */}
                  {existingFiles.has(getFileDisplayName(fileItem)) && (
                    <div className="flex items-start gap-1 pl-0 md:pl-11 text-xs text-semantic-error">
                      <svg className="w-3 h-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>数据库中已存在</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global duplicate warning */}
          {duplicates.size > 0 && (
            <div className="mt-3 p-3 bg-semantic-error/10 border border-semantic-error/20 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-semantic-error">检测到重复的文件名</p>
                  <p className="text-xs text-semantic-error/80 mt-1">
                    同一任务中的文件名不能重复，请修改自定义文件名或使用不同的原文件名
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
