'use client';

import { File } from '@/types';
import { FileCard } from './FileCard';
import { useIntelligentPreload } from '@/lib/hooks/useIntelligentPreload';

interface FileGridProps {
  files: File[];
  onFileUpdate?: () => void;
}

export function FileGrid({ files, onFileUpdate }: FileGridProps) {
  // Initialize intelligent preloading
  const { observeElement, unobserveElement, isPreloading } = useIntelligentPreload(files, {
    enabled: true,
    rootMargin: '200px', // Start preloading 200px before element enters viewport
    threshold: 0.1,
    maxConcurrent: 3,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
      {files.map((file) => (
        <FileCard 
          key={file.id} 
          file={file} 
          onFileUpdate={onFileUpdate}
          observeElement={observeElement}
          unobserveElement={unobserveElement}
        />
      ))}
      
      {/* Preloading indicator (optional) */}
      {isPreloading && (
        <div className="fixed bottom-4 right-4 bg-primary-black/80 text-primary-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 z-50">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>智能预加载中...</span>
        </div>
      )}
    </div>
  );
}
