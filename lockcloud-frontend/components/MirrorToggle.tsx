'use client';

interface MirrorToggleProps {
  isMirrored: boolean;
  onToggle: () => void;
}

/**
 * MirrorToggle Component
 * 
 * Provides a button to toggle video mirror/flip mode.
 * 
 * Features:
 * - Toggle button with mirror icon
 * - Visual indication when mirror mode is active (highlighted)
 * - Maintains video playback state during toggle
 * - Uses CSS transform: scaleX(-1) for horizontal flip
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function MirrorToggle({ isMirrored, onToggle }: MirrorToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-1.5 sm:p-2 rounded transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/50 ${
        isMirrored
          ? 'bg-accent-blue text-white'
          : 'hover:bg-white/20 active:bg-white/30 text-white'
      }`}
      aria-label={isMirrored ? '关闭镜面模式' : '开启镜面模式'}
      aria-pressed={isMirrored}
      title={isMirrored ? '关闭镜面模式' : '开启镜面模式'}
    >
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Mirror/Flip Icon */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    </button>
  );
}
