'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LoadingAnimationProps {
  text?: string;
  className?: string;
  onAnimationComplete?: () => void;
  minDisplayTime?: number; // Minimum time to display in ms (default: one GIF loop ~2s)
}

/**
 * LoadingAnimation - Hand-drawn style loading component
 * This component maintains the hand-drawn aesthetic for auth pages and initial loading
 * Uses animated emoji GIFs to create a playful, branded loading experience
 */
export function LoadingAnimation({ 
  text = '加载中...', 
  className = '',
  onAnimationComplete,
  minDisplayTime = 2000 // Default to 2 seconds (typical GIF duration)
}: LoadingAnimationProps) {
  const [emojiNumber, setEmojiNumber] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const hasNotifiedRef = useRef(false);
  
  // Set emoji number only on client side to avoid hydration mismatch
  useEffect(() => {
    setEmojiNumber(Math.floor(Math.random() * 16) + 1);
  }, []);
  
  const emojiUrl = emojiNumber 
    ? `https://funkandlove-main.s3.bitiful.net/public/lockingemoji/${emojiNumber}.gif`
    : '';
  
  useEffect(() => {
    const img = new Image();
    img.src = emojiUrl;
    img.onload = () => setImageLoaded(true);
  }, [emojiUrl]);
  
  useEffect(() => {
    if (!imageLoaded || !onAnimationComplete || hasNotifiedRef.current) return;
    
    // Calculate how long we've been showing the animation
    const elapsed = Date.now() - startTimeRef.current;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    
    // Wait for the remaining time, then notify parent
    const timer = setTimeout(() => {
      hasNotifiedRef.current = true;
      onAnimationComplete();
    }, remainingTime);
    
    return () => clearTimeout(timer);
  }, [imageLoaded, onAnimationComplete, minDisplayTime]);
  
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative w-32 h-32">
        {(!imageLoaded || !emojiNumber) && (
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
