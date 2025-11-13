'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { MirrorToggle } from './MirrorToggle';

interface CustomVideoPlayerProps {
  src: string;
  className?: string;
  onError?: (event?: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  aspectRatio?: string;
}

/**
 * CustomVideoPlayer Component
 * 
 * A fully-featured custom video player with:
 * - Play/pause controls with keyboard shortcuts
 * - Seekable progress bar with buffer indication
 * - Volume control with mute toggle
 * - Playback speed control (0.5x - 2x)
 * - Mirror/flip mode
 * - Fullscreen support
 * - Auto-hiding controls (3s timeout)
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1-6.5, 7.1-7.5
 */
export function CustomVideoPlayer({ src, className = '', onError, aspectRatio }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  // Debug: 检查视频元素状态
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      console.log('[Video] Component mounted, video element exists');
      console.log('[Video] Initial duration:', video.duration);
      console.log('[Video] Ready state:', video.readyState);
      console.log('[Video] Network state:', video.networkState);
    }
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!videoRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clampedVolume;
    setVolume(clampedVolume);
    setIsMuted(clampedVolume === 0);
    // Save to localStorage
    localStorage.setItem('videoPlayerVolume', clampedVolume.toString());
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // Handle playback speed change
  const handleSpeedChange = useCallback((speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  // Toggle mirror mode
  const toggleMirror = useCallback(() => {
    setIsMirrored(prev => !prev);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    seekTo(newTime);
  }, [currentTime, duration, seekTo]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          skip(-5);
          break;
        case 'arrowright':
          e.preventDefault();
          skip(5);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, handleVolumeChange, volume, toggleFullscreen, toggleMute]);

  // Load saved volume on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const savedVolume = localStorage.getItem('videoPlayerVolume');
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      video.volume = vol;
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log('[Video] No video ref');
      return;
    }

    console.log('[Video] Setting up event listeners');

    // 如果视频已经加载了 metadata，立即设置 duration
    if (video.duration && isFinite(video.duration)) {
      console.log('[Video] Setting initial duration:', video.duration);
      setDuration(video.duration);
      setIsMetadataLoaded(true);
    } else {
      // 如果还没有 duration，尝试触发加载
      console.log('[Video] No duration yet, triggering load');
      video.load();
    }

    const handlePlay = () => {
      console.log('[Video] Play event');
      setIsPlaying(true);
    };
    const handlePause = () => {
      console.log('[Video] Pause event');
      setIsPlaying(false);
    };
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => {
      console.log('[Video] Duration changed:', video.duration);
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
        setIsMetadataLoaded(true);
      }
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleLoadedMetadata = () => {
      console.log('[Video] Metadata loaded, duration:', video.duration);
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
        setIsMetadataLoaded(true);
      }
    };
    const handleError = (event: Event) => {
      setHasError(true);
      if (onError) {
        onError(event as unknown as React.SyntheticEvent<HTMLVideoElement, Event>);
      }
    };
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered(bufferedEnd / video.duration);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.removeEventListener('progress', handleProgress);
    };
  }, [onError]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Mouse move handler for auto-hide controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => resetControlsTimeout();
    const handleMouseLeave = () => {
      if (isPlaying) {
        setShowControls(false);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, resetControlsTimeout]);

  if (hasError) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-900">
        <div className="text-center text-white p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2">视频加载失败</h3>
          <p className="text-gray-400">无法播放此视频文件</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className}`}
      style={aspectRatio ? { aspectRatio, width: '100%' } : { width: '100%' }}
      role="region"
      aria-label="视频播放器"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        className={`w-full h-full object-contain cursor-pointer transition-transform touch-manipulation ${
          isMirrored ? 'scale-x-[-1]' : ''
        } ${!isMetadataLoaded ? 'invisible' : ''}`}
        onClick={togglePlay}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        aria-label="视频内容"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            togglePlay();
          }
        }}
      />

      {/* Loading overlay while metadata is being loaded */}
      {!isMetadataLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" aria-hidden="true"></div>
            <p>加载视频信息中...</p>
          </div>
        </div>
      )}



      {/* Play/Pause Overlay (center) */}
      {!isPlaying && isMetadataLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            onClick={togglePlay}
            className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-white/20 hover:bg-white/30 active:bg-white/40 focus:outline-none focus:ring-4 focus:ring-white/50 rounded-full backdrop-blur-sm transition-all touch-manipulation"
            aria-label="播放视频"
          >
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}

      {/* Controls */}
      {isMetadataLoaded && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          role="group"
          aria-label="视频控制栏"
        >
        {/* Progress Bar */}
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={seekTo}
        />

        {/* Control Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-white">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label={isPlaying ? '暂停视频' : '播放视频'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time Display */}
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap px-1" aria-live="off" role="timer">
            <span className="sr-only">当前播放时间：</span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Volume Control - Hidden on very small screens */}
          <div className="hidden xs:block">
            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
            />
          </div>

          <div className="flex-1" />

          {/* Playback Speed */}
          <PlaybackSpeedControl
            currentSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
          />

          {/* Mirror Toggle */}
          <MirrorToggle
            isMirrored={isMirrored}
            onToggle={toggleMirror}
          />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label={isFullscreen ? '退出全屏模式' : '进入全屏模式'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>
      )}

    </div>
  );
}

/**
 * ProgressBar Component
 * Seekable progress bar with buffer indication
 */
interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered: number;
  onSeek: (time: number) => void;
}

function ProgressBar({ currentTime, duration, buffered, onSeek }: ProgressBarProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? buffered * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, pos * duration));
    setHoverTime(time);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={progressRef}
      className="relative h-3 sm:h-2 bg-white/20 cursor-pointer group touch-manipulation focus-within:ring-2 focus-within:ring-white/50"
      onClick={handleSeek}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="slider"
      aria-label="视频进度条"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 5));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 5));
        }
      }}
    >
      {/* Buffered Progress */}
      <div
        className="absolute top-0 left-0 h-full bg-white/30 transition-all pointer-events-none"
        style={{ width: `${bufferedProgress}%` }}
        aria-hidden="true"
      />

      {/* Current Progress */}
      <div
        className="absolute top-0 left-0 h-full bg-accent-blue transition-all pointer-events-none"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />

      {/* Progress Thumb - More visible on mobile */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-2.5 sm:h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
      />

      {/* Hover Time Tooltip */}
      {hoverTime !== null && duration > 0 && (
        <div
          className="absolute bottom-full mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap pointer-events-none z-10"
          style={{
            left: `${(hoverTime / duration) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}

/**
 * VolumeControl Component
 * Volume slider with mute toggle
 */
interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute }: VolumeControlProps) {
  const [showSlider, setShowSlider] = useState(false);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      );
    } else if (volume < 0.5) {
      return (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      );
    } else {
      return (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      );
    }
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        onClick={onToggleMute}
        className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
        aria-label={isMuted ? '取消静音' : '静音'}
        aria-pressed={isMuted}
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {getVolumeIcon()}
        </svg>
      </button>

      {/* Volume Slider */}
      {showSlider && (
        <div className="absolute left-full ml-2 bg-black/90 rounded px-2 py-3 flex items-center z-10" role="group" aria-label="音量控制">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
            aria-label="音量滑块"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
            aria-valuetext={`音量 ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
          <span className="ml-2 text-xs font-medium whitespace-nowrap" aria-hidden="true">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
