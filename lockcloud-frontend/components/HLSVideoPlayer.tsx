'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';

// Bitiful HLS 分辨率配置
const BITIFUL_QUALITY_PRESETS = {
  auto: { label: '自动', suffix: 'auto_medium.m3u8' },
  high: { label: '高清', suffix: 'auto_high.m3u8' },
  medium: { label: '标清', suffix: 'auto_medium.m3u8' },
  low: { label: '流畅', suffix: 'auto_low.m3u8' },
} as const;

type QualityLevel = keyof typeof BITIFUL_QUALITY_PRESETS;

const VOLUME_STORAGE_KEY = 'hls-player-volume';

interface HLSVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
  autoPlay?: boolean;
}

function toBitifulHLSUrl(originalUrl: string, quality: QualityLevel = 'auto'): string {
  const baseUrl = originalUrl.replace(/!style:[^/]+\/[^?]+/, '');
  const preset = BITIFUL_QUALITY_PRESETS[quality];
  return `${baseUrl}!style:medium/${preset.suffix}`;
}

function isBitifulUrl(url: string): boolean {
  return url.includes('.bitiful.net') || url.includes('s3.bitiful');
}

function getSavedVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (saved) {
    const vol = parseFloat(saved);
    if (!isNaN(vol) && vol >= 0 && vol <= 1) return vol;
  }
  return 0.5;
}

function saveVolume(volume: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
  }
}

export function HLSVideoPlayer({ 
  src, 
  poster, 
  className = '',
  onError,
  autoPlay = false
}: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isMirrored, setIsMirrored] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => getSavedVolume());
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState<QualityLevel>('auto');
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // 新增状态
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shouldUseHLS = isBitifulUrl(src);

  const isHLSSupported = shouldUseHLS && (
    Hls.isSupported() || 
    (typeof document !== 'undefined' && 
     document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '')
  );

  // 初始化音量到 video 元素
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // 初始化 HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (shouldUseHLS && Hls.isSupported()) {
      const hlsUrl = toBitifulHLSUrl(src, quality);
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.destroy();
            video.src = src;
          }
          onError?.();
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && shouldUseHLS) {
      video.src = toBitifulHLSUrl(src, quality);
    } else {
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, quality, shouldUseHLS, autoPlay, onError]);

  // 视频事件监听
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
    };
    
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    
    const handleProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBufferedPercent((bufferedEnd / video.duration) * 100);
      }
    };
    
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => setIsBuffering(false);
    const handleSeeked = () => {
      setIsBuffering(false);
      setIsSeeking(false);
    };

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
    };
  }, [isSeeking]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setSeekTime(newTime);
    setCurrentTime(newTime);
    
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
    
    seekTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = newTime;
      }
    }, 100);
  }, []);

  const handleSeekEnd = useCallback(() => {
    const video = videoRef.current;
    if (video && seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      video.currentTime = seekTime;
    }
  }, [seekTime]);

  const handleVolumeChangeInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
    saveVolume(newVolume);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  }, []);

  const handleQualityChange = useCallback((newQuality: QualityLevel) => {
    const video = videoRef.current;
    if (!video) return;
    
    const currentTimeVal = video.currentTime;
    const wasPlaying = !video.paused;
    
    setQuality(newQuality);
    setShowQualityMenu(false);
    
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTimeVal;
        if (wasPlaying) videoRef.current.play();
      }
    }, 100);
  }, []);

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

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  const displayTime = isSeeking ? seekTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className={`hls-video-player relative w-full h-full bg-black ${className}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className={`w-full h-full ${isMirrored ? 'scale-x-[-1]' : ''}`}
        poster={poster}
        loop={isLooping}
        playsInline
        onClick={togglePlay}
      />

      {/* 加载中指示器 */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-lg px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-xs sm:text-sm">加载中...</span>
          </div>
        </div>
      )}

      {/* 播放按钮覆盖层 */}
      {!isPlaying && !isBuffering && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="bg-black/50 rounded-full p-4 sm:p-6 hover:bg-black/70 transition-colors">
            <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}

      {/* 顶部控制栏 */}
      <div className={`absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-end gap-1.5 sm:gap-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={() => setIsMirrored(!isMirrored)}
          className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm transition-all text-xs sm:text-sm font-medium ${
            isMirrored ? 'bg-blue-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
          }`}
        >
          {isMirrored ? '关闭镜像' : '镜像'}
        </button>

        <button
          onClick={() => setIsLooping(!isLooping)}
          className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm transition-all text-xs sm:text-sm font-medium ${
            isLooping ? 'bg-green-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
          }`}
        >
          {isLooping ? '关闭循环' : '循环'}
        </button>
      </div>

      {/* 底部控制栏 */}
      <div className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-2 py-1.5 sm:p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* 进度条 */}
        <div className="mb-1 sm:mb-3 relative h-1 group">
          {/* 缓冲进度（灰色） */}
          <div 
            className="absolute top-0 left-0 h-full bg-white/30 rounded-lg"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* 播放进度（白色） */}
          <div 
            className="absolute top-0 left-0 h-full bg-white rounded-lg pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
          {/* 可拖动的滑块 */}
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
          {/* 滑块指示器 */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        {/* 移动端布局：单行紧凑 */}
        <div className="flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-1.5">
            <button onClick={togglePlay} className="text-white p-0.5">
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            <button onClick={toggleMute} className="text-white p-0.5">
              {isMuted || volume === 0 ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              )}
            </button>
            <span className="text-white text-[10px]">
              {formatTime(displayTime)}/{formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button 
                onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                className="text-white text-[10px] px-1.5 py-0.5 bg-black/30 rounded"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-1 right-0 bg-black/90 rounded py-1 min-w-[50px] z-10">
                  {speedOptions.map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`block w-full px-2 py-1 text-[10px] text-left hover:bg-white/20 ${
                        playbackRate === speed ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isHLSSupported && shouldUseHLS && (
              <div className="relative">
                <button 
                  onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                  className="text-white text-[10px] px-1.5 py-0.5 bg-black/30 rounded"
                >
                  {BITIFUL_QUALITY_PRESETS[quality].label}
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full mb-1 right-0 bg-black/90 rounded py-1 min-w-[50px] z-10">
                    {(Object.keys(BITIFUL_QUALITY_PRESETS) as QualityLevel[]).map(q => (
                      <button
                        key={q}
                        onClick={() => handleQualityChange(q)}
                        className={`block w-full px-2 py-1 text-[10px] text-left hover:bg-white/20 ${
                          quality === q ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        {BITIFUL_QUALITY_PRESETS[q].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={toggleFullscreen} className="text-white p-0.5">
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 桌面端布局：单行 */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-gray-300">
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* 音量控制 */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-gray-300">
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChangeInput}
                className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className="text-white text-xs w-8">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            <span className="text-white text-sm">
              {formatTime(displayTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                className="text-white text-sm hover:text-gray-300 px-2 py-1 bg-black/30 rounded"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg py-2 min-w-[80px]">
                  {speedOptions.map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`block w-full px-4 py-1 text-sm text-left hover:bg-white/20 ${
                        playbackRate === speed ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isHLSSupported && shouldUseHLS && (
              <div className="relative">
                <button 
                  onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                  className="text-white text-sm hover:text-gray-300 px-2 py-1 bg-black/30 rounded"
                >
                  {BITIFUL_QUALITY_PRESETS[quality].label}
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg py-2 min-w-[80px]">
                    {(Object.keys(BITIFUL_QUALITY_PRESETS) as QualityLevel[]).map(q => (
                      <button
                        key={q}
                        onClick={() => handleQualityChange(q)}
                        className={`block w-full px-4 py-1 text-sm text-left hover:bg-white/20 ${
                          quality === q ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        {BITIFUL_QUALITY_PRESETS[q].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFullscreen} className="text-white hover:text-gray-300">
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* HLS 状态指示 */}
      {shouldUseHLS && (
        <div className={`absolute top-2 left-2 sm:top-4 sm:left-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded ${isHLSSupported ? 'bg-green-500/80' : 'bg-yellow-500/80'} text-white`}>
            {isHLSSupported ? 'HLS 流媒体' : '直接播放'}
          </span>
        </div>
      )}
    </div>
  );
}
