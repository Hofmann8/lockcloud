'use client';

import { useState, useRef, useEffect } from 'react';

interface PlaybackSpeedControlProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * PlaybackSpeedControl Component
 * 
 * Provides a dropdown menu for selecting video playback speed.
 * 
 * Features:
 * - Display current speed (e.g., "1x")
 * - Click to show speed options menu
 * - Highlight currently selected speed
 * - Maintains playback position when changing speed
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function PlaybackSpeedControl({ currentSpeed, onSpeedChange }: PlaybackSpeedControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSpeedSelect = (speed: number) => {
    onSpeedChange(speed);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Speed Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/20 active:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded transition-colors text-xs sm:text-sm font-medium whitespace-nowrap touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
        aria-label={`播放速度 ${currentSpeed}倍`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="speed-menu"
      >
        {currentSpeed}x
      </button>

      {/* Speed Options Menu */}
      {isOpen && (
        <div 
          id="speed-menu"
          className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-lg shadow-lg overflow-hidden min-w-[90px] sm:min-w-[100px] z-20"
          role="menu"
          aria-label="播放速度选项"
        >
          <div className="py-1">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedSelect(speed)}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-left text-xs sm:text-sm hover:bg-white/20 active:bg-white/30 focus:outline-none focus:bg-white/20 transition-colors touch-manipulation ${
                  speed === currentSpeed
                    ? 'bg-accent-blue text-white font-semibold'
                    : 'text-white'
                }`}
                role="menuitemradio"
                aria-label={`${speed}倍速播放`}
                aria-checked={speed === currentSpeed}
              >
                {speed}x
                {speed === 1 && <span className="hidden sm:inline"> (正常)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
