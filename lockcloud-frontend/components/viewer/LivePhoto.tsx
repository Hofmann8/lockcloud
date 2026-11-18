'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { LiveMark } from '@/components/media/Thumb';
import { useHlsSource } from '@/components/player/useHlsSource';

/**
 * Live Photo 的动态部分：盖在大图上（同样 object-contain，和照片对齐），平时看不见。
 * 鼠标移到左上角的 LIVE 上、或者点一下，从头放一遍，放完淡出回到照片。
 */
export function LivePhoto({ live }: { live: { url: string; hls: boolean } }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useHlsSource(video, live.url, live.hls);

  const play = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    // 浏览器不让没点过页面就出声：先带声音试，不行就静音放
    void v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {});
    });
    setPlaying(true);
  };

  return (
    <>
      <video
        ref={video}
        playsInline
        preload="auto"
        onEnded={() => setPlaying(false)}
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300',
          playing ? 'opacity-100' : 'opacity-0',
        )}
      />
      <button
        type="button"
        onClick={play}
        onPointerEnter={(e) => e.pointerType === 'mouse' && !playing && play()}
        aria-label="播放实况"
        className={cn(
          'absolute left-3 top-16 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md transition-colors hover:bg-black/60',
          playing && 'text-stage-accent',
        )}
      >
        <LiveMark className="h-3.5 w-3.5" />
        LIVE
      </button>
    </>
  );
}
