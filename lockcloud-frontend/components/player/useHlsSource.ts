'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type Hls from 'hls.js';

export interface Quality {
  /** -1 是自动 */
  level: number;
  height: number;
}

/**
 * 把播放地址接到 <video> 上：HLS 在支持 MSE 的浏览器用 hls.js，Safari 用原生；不是 HLS 的直接放。
 * 返回可选清晰度和切换函数。
 */
export function useHlsSource(videoRef: RefObject<HTMLVideoElement | null>, url: string | null | undefined, hls: boolean) {
  const instance = useRef<Hls | null>(null);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [level, setLevelState] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  // 换了播放地址：上一个视频的清晰度和报错不带过来
  const source = `${hls ? 'hls' : 'file'}|${url ?? ''}`;
  const [loaded, setLoaded] = useState(source);
  if (loaded !== source) {
    setLoaded(source);
    setError(null);
    setQualities([]);
    setLevelState(-1);
  }

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !url) return;
    let cancelled = false;

    const native = el.canPlayType('application/vnd.apple.mpegurl');
    if (!hls || (native && !('MediaSource' in window))) {
      el.src = url;
      return () => {
        el.removeAttribute('src');
        el.load();
      };
    }

    void import('hls.js').then(({ default: HlsCtor }) => {
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        el.src = url;
        return;
      }
      const h = new HlsCtor({
        // 分片地址是 OSS 签名的，不带 cookie
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
      });
      instance.current = h;
      h.on(HlsCtor.Events.MANIFEST_PARSED, (_e, data) => {
        const list = data.levels
          .map((l, i) => ({ level: i, height: l.height }))
          .sort((a, b) => b.height - a.height);
        setQualities(list);
      });
      h.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) h.startLoad();
        else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
        else setError('无法加载视频');
      });
      h.loadSource(url);
      h.attachMedia(el);
    });

    return () => {
      cancelled = true;
      instance.current?.destroy();
      instance.current = null;
    };
  }, [videoRef, url, hls]);

  const setLevel = (l: number) => {
    setLevelState(l);
    if (instance.current) instance.current.currentLevel = l;
  };

  return { qualities, level, setLevel, error };
}
