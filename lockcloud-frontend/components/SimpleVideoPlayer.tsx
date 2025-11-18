'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';

interface SimpleVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onError?: () => void;
}

/**
 * SimpleVideoPlayer - 使用 Plyr 的现代化视频播放器
 * 
 * 特性：
 * - 开箱即用的播放控制
 * - 自适应质量
 * - 键盘快捷键
 * - 全屏支持
 * - 画中画模式
 * - 速度控制
 * - 音量记忆
 * - 响应式设计
 */
export function SimpleVideoPlayer({ 
  src, 
  poster, 
  className = '',
  onError 
}: SimpleVideoPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plyrRef = useRef<{ plyr: any } | null>(null);

  // Plyr 配置
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
      'airplay',
      'fullscreen',
    ],
    settings: ['speed', 'quality'],
    speed: {
      selected: 1,
      options: [0.5, 0.75, 1, 1.25, 1.5, 2],
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
      key: 'lockcloud-plyr',
    },
    hideControls: true,
    clickToPlay: true,
    disableContextMenu: false,
  };

  // 获取 Plyr 实例的辅助函数
  const getPlyrInstance = useCallback(() => {
    return plyrRef.current?.plyr;
  }, []);

  // 当 Plyr 准备好时设置事件监听
  useEffect(() => {
    const timer = setTimeout(() => {
      const plyrInstance = getPlyrInstance();
      if (plyrInstance && onError) {
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
    }, 100);

    return () => clearTimeout(timer);
  }, [getPlyrInstance, onError]);

  return (
    <div className={`simple-video-player ${className}`}>
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
