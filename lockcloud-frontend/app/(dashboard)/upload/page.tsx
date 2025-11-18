'use client';

import { useState } from 'react';
import { MultiFileUploadZone } from '@/components/MultiFileUploadZone';
import { MultiFileUploadForm } from '@/components/MultiFileUploadForm';
import { UploadQueue } from '@/components/UploadQueue';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { zhCN } from '@/locales/zh-CN';

interface FileWithCustomName {
  id: string;
  file: File;
  customFilename: string;
}

export default function UploadPage() {
  const [filesWithNames, setFilesWithNames] = useState<FileWithCustomName[]>([]);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());

  const handleFilesChange = (files: FileWithCustomName[]) => {
    setFilesWithNames(files);
    // Clear existing files check when files change
    setExistingFiles(new Set());
  };

  const handleUploadComplete = () => {
    setFilesWithNames([]);
    setExistingFiles(new Set());
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <h1 className="text-2xl md:text-3xl font-bold text-primary-black">
            {zhCN.files.upload}
          </h1>
        </div>
      </div>

      {/* Main Layout: Upload Form + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload Zone and Form (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Zone - File selection with custom filenames */}
          <MultiFileUploadZone
            filesWithNames={filesWithNames}
            onFilesChange={handleFilesChange}
            existingFiles={existingFiles}
          />

          {/* Upload Form - Shown after file selection */}
          {filesWithNames.length > 0 && (
            <MultiFileUploadForm
              filesWithNames={filesWithNames}
              onUploadComplete={handleUploadComplete}
              existingFiles={existingFiles}
              onExistingFilesChange={setExistingFiles}
            />
          )}
        </div>

        {/* Right: Upload Queue (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <UploadQueue />
          </div>
        </div>
      </div>
    </div>
  );
}
