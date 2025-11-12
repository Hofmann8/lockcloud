'use client';

import { File } from '@/types';
import { FileCard } from './FileCard';

interface FileGridProps {
  files: File[];
  onFileUpdate?: () => void;
}

export function FileGrid({ files, onFileUpdate }: FileGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
      {files.map((file) => (
        <FileCard key={file.id} file={file} onFileUpdate={onFileUpdate} />
      ))}
    </div>
  );
}
