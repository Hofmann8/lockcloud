'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';
import { mediaApi } from '@/lib/api/media';
import type { FileItem, MediaDetail, SpriteInfo, StylePreset } from '@/lib/api/types';
import { formatDuration } from '@/lib/format';
import { spriteStyle } from '@/lib/sprite';
import { FileArchive, FileIcon, Music2 } from 'lucide-react';
import { aspectOf, displayName, isAudio, isImage, isVideo, refreshUrl, thumbStyle, thumbhashUrl, useSignedUrl } from '@/lib/urls';

// 缩略图档位从小到大；只往大换，窗口缩小了不重新下一张小的
const RANK: Partial<Record<StylePreset, number>> = { thumbnav: 0, thumbnavdesktop: 1, thumbmobile: 2, thumbdesktop: 3, previewmobile: 4 };

// 一个页面上几百个缩略图共用一个 ResizeObserver
const watchers = new WeakMap<Element, (w: number, h: number) => void>();
let observer: ResizeObserver | null = null;
function watchSize(el: HTMLElement, onSize: (w: number, h: number) => void): () => void {
  observer ??= new ResizeObserver((entries) => {
    for (const e of entries) watchers.get(e.target)?.(e.contentRect.width, e.contentRect.height);
  });
  watchers.set(el, onSize);
  observer.observe(el);
  return () => {
    watchers.delete(el);
    observer?.unobserve(el);
  };
}

interface ThumbProps {
  file: FileItem;
  /** 大概的显示宽度（CSS 像素）。实际量不出来（还没显示）时才用它挑缩略图档位 */
  width: number;
  height?: number;
  className?: string;
  /** 视频鼠标停留时用雪碧图预览 */
  scrub?: boolean;
  showBadges?: boolean;
  fit?: 'cover' | 'contain';
  style?: React.CSSProperties;
}

export const Thumb = memo(function Thumb({ file, width, height, className, scrub = true, showBadges = true, fit = 'cover', style: boxStyle }: ThumbProps) {
  const video = isVideo(file);
  const audio = isAudio(file);
  // 压缩包、文档这些没有缩略图，不去要地址（要回来的是原文件，<img> 会把整个文件下下来）；
  // 音频有专辑封面时缩略图是封面，没有就画波形
  const media = video || isImage(file) || (audio && !!file.cover);
  // 档位按实际显示的宽和高挑：调用方给的宽度只是估计，而且横图放进竖格子（cover）要看高度，光看宽会小一大截、放大发糊。
  // 量到尺寸之前不去要地址，免得先下一张小的再下一张大的
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onSize = (w: number, h: number) =>
      setBox((prev) => (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }));
    onSize(el.offsetWidth, el.offsetHeight);
    return watchSize(el, onSize);
  }, []);
  const wanted = box && box.w >= 1 ? thumbStyle(box.w, box.h || height, aspectOf(file), fit) : thumbStyle(width, height, aspectOf(file), fit);
  const [picked, setPicked] = useState<StylePreset | null>(null);
  if (box && (picked === null || (RANK[wanted] ?? 0) > (RANK[picked] ?? 0))) setPicked(wanted);
  const style = picked ?? wanted;
  const url = useSignedUrl(file.id, style, media && picked !== null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // 地址换了（签名续上了、换了文件）就重新试，之前的失败不算数
  const [lastUrl, setLastUrl] = useState(url);
  if (lastUrl !== url) {
    setLastUrl(url);
    setFailed(false);
  }
  const placeholder = thumbhashUrl(file.thumbhash);
  const pending = file.media_status === 'pending';

  return (
    <div
      ref={frame}
      className={cn('relative overflow-hidden bg-frame', className)}
      style={{
        ...boxStyle,
        backgroundImage: placeholder ? `url(${placeholder})` : undefined,
        backgroundSize: fit,
        backgroundPosition: 'center',
      }}
    >
      {!media && (audio ? <AudioTile waveform={file.waveform} /> : <FileTile name={displayName(file)} />)}
      {url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={displayName(file)}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            // 地址放久了签名会过期：先换个新地址再试一次，还不行才算预览不了
            if (!refreshUrl(file.id, style)) setFailed(true);
          }}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-300',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {video && scrub && file.media_status === 'ready' && <HoverScrub fileId={file.id} width={width} height={height} fit={fit} />}
      {showBadges && (video || audio) && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-white backdrop-blur-sm tabular">
          {audio ? (
            <Music2 className="h-2.5 w-2.5" strokeWidth={2.2} aria-hidden />
          ) : (
            <svg viewBox="0 0 8 8" className="h-2 w-2" aria-hidden>
              <path d="M1.5 1v6l5-3z" fill="currentColor" />
            </svg>
          )}
          {file.duration ? formatDuration(file.duration) : audio ? '音频' : '视频'}
        </span>
      )}
      {showBadges && file.live && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-[3px] text-[10px] font-semibold leading-none tracking-wide text-white backdrop-blur-sm">
          <LiveMark className="h-2.5 w-2.5" />
          LIVE
        </span>
      )}
      {showBadges && video && file.lockai_status === 'ready' && !pending && (
        <span
          className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-[3px] font-display text-[11px] italic leading-none text-white backdrop-blur-sm"
          title="LockAI 已分析"
        >
          AI
        </span>
      )}
      {showBadges && pending && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-[10.5px] leading-none text-white backdrop-blur-sm">
          <PauseMark size={10} framed={false} state="busy" />
          处理中
        </span>
      )}
      {failed && !placeholder && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] text-fg-faint">无法预览</span>
      )}
    </div>
  );
});

type Frames = NonNullable<MediaDetail['preview_frames']>;

/** 最接近 t 秒的那张清晰帧 */
function nearestFrame(frames: Frames, t: number): string | null {
  let best = -1;
  let gap = Infinity;
  frames.times.forEach((s, i) => {
    if (Math.abs(s - t) < gap) {
      gap = Math.abs(s - t);
      best = i;
    }
  });
  return best >= 0 ? frames.urls[best] : null;
}

/**
 * 鼠标在视频卡上横着移动时，按位置显示那一刻的画面。
 * 雪碧图小图马上能出但很小，铺满卡片会糊；同一时刻的清晰帧加载好了就盖上去，没好之前留着上一张清晰的。
 */
function HoverScrub({ fileId, width, height, fit }: { fileId: number; width: number; height?: number; fit: 'cover' | 'contain' }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [sprite, setSprite] = useState<SpriteInfo | null>(null);
  const [frames, setFrames] = useState<Frames | null>(null);
  const [duration, setDuration] = useState(0);
  const [x, setX] = useState<number | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  const wanted = frames && x != null ? nearestFrame(frames, x * duration) : null;
  useEffect(() => {
    if (!wanted) return;
    // 看过的帧在浏览器缓存里，onload 几乎立刻就来
    let live = true;
    const im = new Image();
    im.onload = () => {
      if (live) setShown(wanted);
    };
    im.src = wanted;
    return () => {
      live = false;
    };
  }, [wanted]);

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    timer.current = window.setTimeout(async () => {
      try {
        const detail = await qc.fetchQuery({
          queryKey: ['media', fileId],
          queryFn: () => mediaApi.detail(fileId),
          staleTime: 30 * 60 * 1000,
        });
        const pf = detail.preview_frames?.urls.length ? detail.preview_frames : null;
        const length = detail.duration ?? (detail.sprite ? detail.sprite.count * detail.sprite.interval : pf?.times.at(-1));
        if ((detail.sprite || pf) && length) {
          setSprite(detail.sprite);
          setFrames(pf);
          setDuration(length);
        }
      } catch {
        // 拿不到就不预览
      }
    }, 250);
  };
  const leave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setX(null);
    setShown(null);
  };
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setX(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  const style = sprite && x != null ? spriteStyle(sprite, x * duration, width) : null;
  const boxH = height ?? (sprite ? (sprite.height / sprite.width) * width : 0);

  return (
    <div ref={ref} className="absolute inset-0" onPointerEnter={enter} onPointerLeave={leave} onPointerMove={move}>
      {x != null && (style || shown) && (
        <>
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
            {style && (
              <div
                style={{
                  ...style,
                  transform: `scale(${Math.max(boxH / Number(style.height), 1)})`,
                }}
              />
            )}
            {shown && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown}
                alt=""
                draggable={false}
                className={cn('absolute inset-0 h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
              />
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
            <div className="h-full bg-white" style={{ width: `${(x ?? 0) * 100}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

/** Live Photo 的标记：实心圆点外面一圈虚线圆 */
export function LiveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      <circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="7.1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.2 1.6" />
    </svg>
  );
}

/** 没有封面的音频：波形，没有波形（还在处理）时是音符 */
function AudioTile({ waveform }: { waveform?: number[] | null }) {
  if (!waveform?.length) {
    return (
      <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
        <Music2 className="h-7 w-7" strokeWidth={1.5} />
      </span>
    );
  }
  // 卡片上 40 根柱子就够：每根取那一段里最响的
  const n = 40;
  const bars = Array.from({ length: n }, (_, i) => {
    const part = waveform.slice(Math.floor((i * waveform.length) / n), Math.floor(((i + 1) * waveform.length) / n));
    return Math.max(4, ...part);
  });
  return (
    <svg viewBox={`0 0 ${n * 3} 100`} preserveAspectRatio="none" className="absolute inset-x-[12%] top-1/2 h-[42%] w-[76%] -translate-y-1/2 text-fg-faint" aria-hidden>
      {bars.map((v, i) => (
        <rect key={i} x={i * 3 + 0.6} y={50 - v / 2} width={1.8} height={v} rx={0.9} fill="currentColor" />
      ))}
    </svg>
  );
}

function FileTile({ name }: { name: string }) {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toUpperCase() ?? '';
  const Icon = /^(ZIP|RAR|7Z|TAR|GZ)$/.test(ext) ? FileArchive : FileIcon;
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-fg-faint">
      <Icon className="h-7 w-7" strokeWidth={1.5} />
      {ext && <span className="font-mono text-[10.5px] tracking-wide">{ext}</span>}
    </span>
  );
}
