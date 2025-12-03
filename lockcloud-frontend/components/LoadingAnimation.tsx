'use client';

import { useState, useEffect, useRef } from 'react';

interface LoadingAnimationProps {
  text?: string;
  className?: string;
  onAnimationComplete?: () => void;
  minDisplayTime?: number; // Minimum time to display GIF after loaded (default: 2s)
}

/**
 * LoadingAnimation - Hand-drawn style loading component
 * This component maintains the hand-drawn aesthetic for auth pages and initial loading
 * Uses animated emoji GIFs to create a playful, branded loading experience
 * GIF will be shown for at least minDisplayTime after it loads
 */
export function LoadingAnimation({ 
  text = '加载中...', 
  className = '',
  onAnimationComplete,
  minDisplayTime = 2000 // Default to 2 seconds after GIF loads
}: LoadingAnimationProps) {
  const [emojiNumber, setEmojiNumber] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasNotifiedRef = useRef(false);
  
  // Set emoji number only on client side to avoid hydration mismatch
  useEffect(() => {
    setEmojiNumber(Math.floor(Math.random() * 16) + 1);
  }, []);
  
  const emojiUrl = emojiNumber 
    ? `https://funkandlove-main.s3.bitiful.net/mainproject/lockingemojigif/lockingemoji/${emojiNumber}.gif`
    : '';
  
  // Fallback: if image doesn't trigger onLoad within 5s, consider it loaded anyway
  useEffect(() => {
    if (!emojiUrl || imageLoaded) return;
    
    const fallbackTimer = setTimeout(() => {
      setImageLoaded(true);
    }, 5000);
    
    return () => clearTimeout(fallbackTimer);
  }, [emojiUrl, imageLoaded]);
  
  // Wait for GIF to load, then wait minDisplayTime before calling onAnimationComplete
  useEffect(() => {
    if (!imageLoaded || !onAnimationComplete || hasNotifiedRef.current) return;
    
    // GIF has loaded, now wait minDisplayTime before completing
    const timer = setTimeout(() => {
      hasNotifiedRef.current = true;
      onAnimationComplete();
    }, minDisplayTime);
    
    return () => clearTimeout(timer);
  }, [imageLoaded, onAnimationComplete, minDisplayTime]);
  
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative w-32 h-32">
        {/* Show spinner while waiting for emoji number or image to load */}
        {(!emojiNumber || !imageLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-accent-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {emojiNumber && (
          <img
            src={emojiUrl}
            alt="Loading"
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </div>
      <p className="text-lg font-display text-primary-black">
        {text}
      </p>
    </div>
  );
}
