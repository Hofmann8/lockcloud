'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';

interface DanceVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
}

/**
 * DanceVideoPlayer - 专为舞蹈练习优化的视频播放器
 * 
 * 在 Plyr 基础上添加：
 * - 镜像模式（舞蹈练习必备）
 * - 循环播放
 * - 更多速度选项
 */
export function DanceVideoPlayer({ 
  src, 
  poster, 
  className = '',
  onError 
}: DanceVideoPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plyrRef = useRef<{ plyr: any } | null>(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Plyr 配置 - 舞蹈优化版
  const plyrOptions = {
    controls: [
      'play-large',
      'play',
      'progress',
      'current-time',
      'duration',
      'mute',
      'volume',
      'settings',
      'pip',
      'fullscreen',
    ],
    settings: ['speed'],
    speed: {
      selected: 1,
      options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2], // 添加 0.25x 慢速
    },
    keyboard: {
      focused: true,
      global: true,
    },
    tooltips: {
      controls: true,
      seek: true,
    },
    storage: {
      enabled: true,
      key: 'lockcloud-dance-plyr',
    },
    hideControls: true,
    clickToPlay: true,
  };

  // 获取 Plyr 实例的辅助函数
  const getPlyrInstance = useCallback(() => {
    return plyrRef.current?.plyr;
  }, []);

  // 当 Plyr 准备好时设置事件监听
  useEffect(() => {
    const timer = setTimeout(() => {
      const plyrInstance = getPlyrInstance();
      if (plyrInstance) {
        setIsReady(true);
        
        // 设置错误处理
        if (onError) {
          const handleError = () => {
            console.error('Video playback error');
            onError();
          };
          
          try {
            plyrInstance.on('error', handleError);
          } catch (e) {
            console.warn('Could not attach error handler:', e);
          }
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [getPlyrInstance, onError]);

  // 循环播放控制
  useEffect(() => {
    if (!isReady) return;
    
    const plyrInstance = getPlyrInstance();
    if (plyrInstance && plyrInstance.media) {
      plyrInstance.media.loop = isLooping;
    }
  }, [isLooping, isReady, getPlyrInstance]);

  // 镜像切换
  const toggleMirror = () => {
    setIsMirrored(!isMirrored);
  };

  // 循环切换
  const toggleLoop = () => {
    setIsLooping(!isLooping);
  };

  return (
    <div className={`dance-video-player relative ${className}`}>
      {/* 视频播放器 */}
      <div className={isMirrored ? 'scale-x-[-1]' : ''}>
        <Plyr
          ref={plyrRef}
          source={{
            type: 'video',
            sources: [
              {
                src: src,
                type: getVideoType(src),
              },
            ],
            poster: poster,
          }}
          options={plyrOptions}
        />
      </div>

      {/* 自定义控制按钮 */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {/* 镜像按钮 */}
        <button
          onClick={toggleMirror}
          className={`px-3 py-2 rounded-lg backdrop-blur-sm transition-all text-sm font-medium ${
            isMirrored
              ? 'bg-accent-blue text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isMirrored ? '关闭镜像' : '开启镜像'}
          aria-label={isMirrored ? '关闭镜像' : '开启镜像'}
        >
          {isMirrored ? '关闭镜像' : '镜像'}
        </button>

        {/* 循环按钮 */}
        <button
          onClick={toggleLoop}
          className={`px-3 py-2 rounded-lg backdrop-blur-sm transition-all text-sm font-medium ${
            isLooping
              ? 'bg-accent-green text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isLooping ? '关闭循环' : '开启循环'}
          aria-label={isLooping ? '关闭循环' : '开启循环'}
        >
          {isLooping ? '关闭循环' : '循环'}
        </button>
      </div>
    </div>
  );
}

/**
 * 根据 URL 推断视频类型
 */
function getVideoType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  
  switch (extension) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'ogg':
      return 'video/ogg';
    case 'mov':
      return 'video/mp4';
    default:
      return 'video/mp4';
  }
}
