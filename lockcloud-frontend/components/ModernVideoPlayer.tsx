'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Hls, { Level } from 'hls.js';

// ============================================
// Types
// ============================================

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

interface ModernVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
  autoPlay?: boolean;
  fileId?: number;
  defaultQuality?: number; // 默认清晰度高度，如 1080
}

// ============================================
// Constants
// ============================================

const VOLUME_STORAGE_KEY = 'lockcloud-player-volume';
const QUALITY_STORAGE_KEY = 'lockcloud-player-quality';
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_QUALITY = 1080;

// ============================================
// Utils
// ============================================

const isBitifulUrl = (url: string): boolean =>
  url.includes('.bitiful.net') || url.includes('s3.bitiful');

const getSavedVolume = (): number => {
  if (typeof window === 'undefined') return 0.5;
  const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (saved) {
    const vol = parseFloat(saved);
    if (!isNaN(vol) && vol >= 0 && vol <= 1) return vol;
  }
  return 0.5;
};

const saveVolume = (volume: number): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
  }
};

const getSavedQuality = (): number => {
  if (typeof window === 'undefined') return DEFAULT_QUALITY;
  const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
  if (saved) {
    const q = parseInt(saved, 10);
    if (!isNaN(q)) return q;
  }
  return DEFAULT_QUALITY;
};

const saveQuality = (height: number): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUALITY_STORAGE_KEY, height.toString());
  }
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getQualityLabel = (height: number): string => {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return `${height}p`;
};

// ============================================
// Icons
// ============================================

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const FullscreenIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const MirrorIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z" />
  </svg>
);

const LoopIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

// ============================================
// Component
// ============================================

export function ModernVideoPlayer({
  src,
  poster,
  className = '',
  onError,
  autoPlay = false,
  fileId,
  defaultQuality = DEFAULT_QUALITY,
}: ModernVideoPlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => getSavedVolume());
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Menu state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed'>('main');

  // Quality state
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = auto
  const [autoQuality, setAutoQuality] = useState(false);
  const [preferredQuality, setPreferredQuality] = useState(() => getSavedQuality());
  const autoQualityRef = useRef(false);

  // HLS detection
  const isHLSUrl = src.includes('.m3u8');
  const shouldUseHLS = isHLSUrl && isBitifulUrl(src);
  const isHLSSupported = shouldUseHLS && Hls.isSupported();

  // Build proxy URL for HLS
  const hlsSrc = useMemo(() => {
    if (!fileId || !isBitifulUrl(src)) return src;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const url = new URL(src);
      const pathname = url.pathname;
      const styleIdx = pathname.indexOf('!style:');
      if (styleIdx !== -1) {
        const hlsPath = pathname.substring(styleIdx + 7);
        return `${apiBaseUrl}/api/files/hls-proxy/${fileId}/${hlsPath}`;
      }
    } catch (e) {
      console.error('[HLS] Failed to parse URL for proxy:', e);
    }
    return src;
  }, [src, fileId]);

  // Get current quality label
  const currentQualityLabel = useMemo(() => {
    if (autoQuality) return '自动';
    const level = qualityLevels.find((l) => l.index === currentQuality);
    return level ? level.label : '自动';
  }, [autoQuality, currentQuality, qualityLevels]);

  // ============================================
  // HLS Initialization
  // ============================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (shouldUseHLS && Hls.isSupported()) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('lockcloud_token') : null;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // 让 HLS 自动选择，我们稍后手动设置
        abrEwmaDefaultEstimate: 5000000,
        abrMaxWithRealBitrate: true,
        xhrSetup: (xhr, url) => {
          if (url.includes('/api/files/hls-proxy/') && token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        },
      });

      hls.loadSource(hlsSrc);
      hls.attachMedia(video);

      // Handle manifest parsed - extract quality levels
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        console.log('[HLS] Manifest parsed, levels:', data.levels);

        // Build quality levels from HLS levels
        const levels: QualityLevel[] = data.levels.map((level: Level, index: number) => ({
          index,
          height: level.height,
          bitrate: level.bitrate,
          label: getQualityLabel(level.height),
        }));

        // Sort by height descending (highest quality first)
        levels.sort((a, b) => b.height - a.height);
        setQualityLevels(levels);

        // Find preferred quality level (default 1080p)
        const targetHeight = preferredQuality || defaultQuality;
        const preferredLevel = levels.find((l) => l.height === targetHeight);
        
        if (preferredLevel) {
          hls.currentLevel = preferredLevel.index;
          setCurrentQuality(preferredLevel.index);
          setAutoQuality(false);
          console.log(`[HLS] Set quality to ${preferredLevel.label}`);
        } else if (levels.length > 0) {
          // Fallback to highest available
          hls.currentLevel = levels[0].index;
          setCurrentQuality(levels[0].index);
          setAutoQuality(false);
          console.log(`[HLS] Preferred quality not found, using ${levels[0].label}`);
        }

        if (autoPlay) video.play().catch(() => {});
      });

      // Track level changes
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        console.log('[HLS] Level switched to:', data.level);
        if (!autoQualityRef.current) {
          setCurrentQuality(data.level);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS] Fatal error:', data);
          onError?.();
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && shouldUseHLS) {
      // Safari native HLS
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    } else {
      // Direct playback
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsSrc, shouldUseHLS, autoPlay, onError, src, preferredQuality, defaultQuality]);

  // ============================================
  // Video Event Listeners
  // ============================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      saveVolume(video.volume);
    };
    const handleProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        setBufferedPercent((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => setIsBuffering(false);
    const handleSeeked = () => {
      setIsBuffering(false);
      setIsSeeking(false);
    };
    const handleError = () => onError?.();

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [isSeeking, onError]);

  // Sync volume on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // ============================================
  // Controls Handlers
  // ============================================

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) setShowControls(false);
    }, 3000);
  }, [isPlaying, showSettingsMenu]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const handleSeekStart = useCallback(() => setIsSeeking(true), []);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setSeekTime(newTime);
    setCurrentTime(newTime);
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      if (videoRef.current) videoRef.current.currentTime = newTime;
    }, 100);
  }, []);

  const handleSeekEnd = useCallback(() => {
    if (videoRef.current && seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      videoRef.current.currentTime = seekTime;
    }
  }, [seekTime]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
    setSettingsTab('main');
  }, []);

  const handleQualityChange = useCallback((levelIndex: number, isAuto: boolean = false) => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || !video) return;

    // 记录当前状态
    const wasPlaying = !video.paused;
    const currentPos = video.currentTime;

    if (isAuto) {
      hls.currentLevel = -1;
      setAutoQuality(true);
      autoQualityRef.current = true;
      setCurrentQuality(-1);
    } else {
      hls.currentLevel = levelIndex;
      setAutoQuality(false);
      autoQualityRef.current = false;
      setCurrentQuality(levelIndex);
      
      const level = qualityLevels.find((l) => l.index === levelIndex);
      if (level) {
        saveQuality(level.height);
        setPreferredQuality(level.height);
      }
    }
    
    // 恢复播放位置和状态
    const restorePlayback = () => {
      video.currentTime = currentPos;
      if (wasPlaying) {
        video.play().catch(() => {});
      }
    };

    // 监听 level 切换完成后恢复
    const onLevelLoaded = () => {
      restorePlayback();
      hls.off(Hls.Events.LEVEL_LOADED, onLevelLoaded);
    };
    
    hls.on(Hls.Events.LEVEL_LOADED, onLevelLoaded);
    
    // 备用：如果事件没触发，延迟恢复
    setTimeout(restorePlayback, 500);
    
    setSettingsTab('main');
  }, [qualityLevels]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleMirror = useCallback(() => setIsMirrored((prev) => !prev), []);
  const toggleLoop = useCallback(() => setIsLooping((prev) => !prev), []);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSettingsMenu) {
        const target = e.target as HTMLElement;
        // 检查是否点击在设置菜单区域内（包括按钮和下拉菜单）
        if (!target.closest('.settings-menu-container')) {
          setShowSettingsMenu(false);
          setSettingsTab('main');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime += 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute]);

  // Computed values
  const displayTime = isSeeking ? seekTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  // ============================================
  // Render
  // ============================================

  return (
    <div
      ref={containerRef}
      className={`modern-video-player relative w-full h-full bg-black select-none ${className}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && !showSettingsMenu && setShowControls(false)}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className={`w-full h-full object-contain ${isMirrored ? 'scale-x-[-1]' : ''}`}
        poster={poster}
        loop={isLooping}
        playsInline
        onClick={togglePlay}
      />

      {/* Buffering Indicator - 显示 poster 占位图 */}
      {isBuffering && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Poster 背景 - 用 background 铺满 */}
          {poster && (
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `url(${poster})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          )}
          {/* 加载指示器 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/60 rounded-lg px-4 py-3 flex items-center gap-3 z-10">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white text-sm">加载中...</span>
            </div>
          </div>
        </div>
      )}

      {/* Play Button Overlay - 未播放时显示 poster */}
      {!isPlaying && !isBuffering && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={togglePlay}
        >
          {/* Poster 背景（视频未加载时）- 用 background 铺满 */}
          {poster && duration === 0 && (
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `url(${poster})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-5 hover:bg-black/70 transition-colors z-10">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Stream Type Badge */}
        <span
          className={`text-xs px-2 py-1 rounded font-medium ${
            isHLSSupported ? 'bg-green-500/80' : 'bg-yellow-500/80'
          } text-white`}
        >
          {isHLSSupported ? 'HLS' : '直接播放'}
        </span>

        {/* Feature Toggles */}
        <div className="flex gap-2">
          <button
            onClick={toggleMirror}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMirrored ? 'bg-blue-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
            }`}
            title="镜像模式"
          >
            <MirrorIcon />
            <span className="hidden sm:inline">{isMirrored ? '关闭镜像' : '镜像'}</span>
          </button>
          <button
            onClick={toggleLoop}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isLooping ? 'bg-green-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
            }`}
            title="循环播放"
          >
            <LoopIcon />
            <span className="hidden sm:inline">{isLooping ? '关闭循环' : '循环'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-2 relative h-1.5 group cursor-pointer">
          {/* Buffered */}
          <div
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Seek Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors">
                {isMuted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover:w-16 transition-all duration-200 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Time */}
            <span className="text-white text-xs tabular-nums">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Settings Menu */}
            <div className="relative settings-menu-container">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                  setSettingsTab('main');
                }}
                className="flex items-center gap-1.5 text-white hover:text-white/80 transition-colors px-2 py-1 rounded bg-black/30 hover:bg-black/50"
              >
                <SettingsIcon />
                <span className="text-xs">{currentQualityLabel}</span>
              </button>

              {/* Settings Dropdown */}
              {showSettingsMenu && (
                <div 
                  className="absolute bottom-full mb-2 right-0 bg-black/95 rounded-lg py-1 min-w-[160px] z-20 shadow-xl border border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {settingsTab === 'main' && (
                    <>
                      {/* Quality Option */}
                      <button
                        onClick={() => setSettingsTab('quality')}
                        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center justify-between"
                      >
                        <span>画质</span>
                        <span className="text-white/60">{currentQualityLabel} →</span>
                      </button>
                      {/* Speed Option */}
                      <button
                        onClick={() => setSettingsTab('speed')}
                        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 flex items-center justify-between"
                      >
                        <span>播放速度</span>
                        <span className="text-white/60">{playbackRate}x →</span>
                      </button>
                    </>
                  )}

                  {settingsTab === 'quality' && (
                    <>
                      <button
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-4 py-2 text-left text-sm text-white/60 hover:bg-white/10 border-b border-white/10"
                      >
                        ← 画质
                      </button>
                      {/* Auto Quality */}
                      <button
                        onClick={() => handleQualityChange(-1, true)}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                          autoQuality ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        <span>自动</span>
                        {autoQuality && <span>✓</span>}
                      </button>
                      {/* Quality Levels */}
                      {qualityLevels.map((level) => (
                        <button
                          key={level.index}
                          onClick={() => handleQualityChange(level.index)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                            !autoQuality && currentQuality === level.index ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          <span>{level.label}</span>
                          {!autoQuality && currentQuality === level.index && <span>✓</span>}
                        </button>
                      ))}
                    </>
                  )}

                  {settingsTab === 'speed' && (
                    <>
                      <button
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-4 py-2 text-left text-sm text-white/60 hover:bg-white/10 border-b border-white/10"
                      >
                        ← 播放速度
                      </button>
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                            playbackRate === speed ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          <span>{speed === 1 ? '正常' : `${speed}x`}</span>
                          {playbackRate === speed && <span>✓</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-white/80 transition-colors p-1"
              title="全屏"
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
