'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadZone } from '@/components/UploadZone';
import { useFileStore } from '@/stores/fileStore';
import { toast } from 'react-hot-toast';
import { zhCN } from '@/locales/zh-CN';
import { isValidFileName } from '@/lib/utils/validation';
import { getErrorMessage } from '@/lib/utils/errorMessages';

const DIRECTORY_OPTIONS = [
  { value: '/rehearsals', label: '排练 (Rehearsals)' },
  { value: '/events', label: '活动 (Events)' },
  { value: '/members', label: '成员 (Members)' },
  { value: '/resources', label: '资源 (Resources)' },
];

export default function UploadPage() {
  const router = useRouter();
  const { uploadFile, isUploading } = useFileStore();
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileNameError, setFileNameError] = useState<string>('');

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Validate file name with detailed feedback
    if (!isValidFileName(file.name)) {
      setFileNameError(`${zhCN.files.invalidFileName} - ${zhCN.files.fileNamingExample}`);
    } else {
      setFileNameError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('请选择文件');
      return;
    }

    if (!selectedDirectory) {
      toast.error('请选择目录');
      return;
    }

    if (!isValidFileName(selectedFile.name)) {
      toast.error(zhCN.files.invalidFileName);
      return;
    }

    try {
      await uploadFile(selectedFile, selectedDirectory);
      toast.success(zhCN.files.uploadSuccess);
      router.push('/files');
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = getErrorMessage(error, zhCN.files.uploadFailed);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Title - Using standard font */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-primary-black">
          {zhCN.files.upload}
        </h1>
      </div>

      {/* Directory Selection - Standard select styling */}
      <div className="mb-4 md:mb-6">
        <label className="block text-sm md:text-sm font-medium text-primary-black mb-2">
          {zhCN.files.selectDirectory}
        </label>
        <select
          value={selectedDirectory}
          onChange={(e) => setSelectedDirectory(e.target.value)}
          className="w-full px-4 py-3 md:py-2 text-base md:text-base bg-primary-white text-primary-black border border-primary-black/20 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-accent-blue transition-all duration-200 min-h-[44px]"
          disabled={isUploading}
        >
          <option value="">{zhCN.files.selectDirectory}</option>
          {DIRECTORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* File Naming Convention Helper - Using info card style */}
      <div className="mb-4 md:mb-6">
        <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="text-accent-blue shrink-0 mt-0.5">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm md:text-base font-semibold text-primary-black mb-1.5">
                文件命名规范
              </h3>
              <p className="text-sm md:text-sm text-accent-gray mb-1 leading-relaxed">
                {zhCN.files.fileNamingHint}
              </p>
              <p className="text-sm md:text-sm text-accent-orange font-medium">
                {zhCN.files.fileNamingExample}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone - Using refactored component */}
      <UploadZone
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        onUpload={handleUpload}
        isUploading={isUploading}
        fileNameError={fileNameError}
      />
    </div>
  );
}
