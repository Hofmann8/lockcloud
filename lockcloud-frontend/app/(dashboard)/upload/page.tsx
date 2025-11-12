'use client';

import { useState } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { UploadForm } from '@/components/UploadForm';
import { zhCN } from '@/locales/zh-CN';

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleUploadComplete = () => {
    setSelectedFile(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Title */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-primary-black">
          {zhCN.files.upload}
        </h1>
      </div>

      {/* Upload Zone - File selection */}
      <UploadZone
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
      />

      {/* Upload Form - Shown after file selection */}
      {selectedFile && (
        <div className="mt-4 md:mt-6">
          <UploadForm
            selectedFile={selectedFile}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      )}
    </div>
  );
}
