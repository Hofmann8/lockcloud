'use client';

import { File } from '@/types';
import { FileCardSimple } from './FileCardSimple';

interface FileGridProps {
  files: File[];
  onFileUpdate?: () => void;
  /** Custom render function for file cards (e.g., with selection support) */
  renderFileCard?: (file: File) => React.ReactNode;
}

export function FileGrid({ files, onFileUpdate, renderFileCard }: FileGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
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
