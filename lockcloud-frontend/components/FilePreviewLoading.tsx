'use client';

import { useState, useEffect } from 'react';

interface FilePreviewLoadingProps {
  text?: string;
  className?: string;
}

/**
 * FilePreviewLoading - Loading component for file preview system
 * Uses random emoji GIFs similar to the global LoadingAnimation but optimized for file previews
 * Note: GIF is shown immediately without waiting for load event to avoid display issues
 */
export function FilePreviewLoading({ 
  text = '加载中...', 
  className = ''
}: FilePreviewLoadingProps) {
  const [emojiNumber, setEmojiNumber] = useState<number | null>(null);
  
  // Set emoji number only on client side to avoid hydration mismatch
  useEffect(() => {
    const randomNum = Math.floor(Math.random() * 16) + 1;
    setEmojiNumber(randomNum);
  }, []);
  
  const emojiUrl = emojiNumber 
    ? `https://funkandlove-main.s3.bitiful.net/mainproject/lockingemojigif/lockingemoji/${emojiNumber}.gif`
    : '';
  
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative w-32 h-32">
        {!emojiNumber && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {emojiNumber && (
          <img
            src={emojiUrl}
            alt="Loading"
            className="w-full h-full object-contain"
          />
        )}
      </div>
      <p className="text-lg font-medium text-white">
        {text}
      </p>
    </div>
  );
}
