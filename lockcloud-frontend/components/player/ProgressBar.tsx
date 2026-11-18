'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { SpriteInfo } from '@/lib/api/types';
import { formatTimecode } from '@/lib/format';
import { spriteStyle } from '@/lib/sprite';

export interface Marker {
  key: string | number;
  t: number;
  label: string;
}

interface ProgressBarProps {
  current: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  sprite?: SpriteInfo | null;
  loop?: [number, number] | null;
  markers?: Marker[];
  /** 段落（LockAI 理解出的每一段，或手动分的段落）：进度条在开头处断开，悬停时显示标题 */
  chapters?: { start: number; title?: string }[];
}

/** 进度条：拖动时浮出雪碧图预览和时间码；上面一层是评论点，中间是 AB 循环区，段落分界处断开 */
export function ProgressBar({ current, duration, buffered, onSeek, onScrubStart, onScrubEnd, sprite, loop, markers = [], chapters = [] }: ProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHoverState] = useState<number | null>(null);
  const [barWidth, setBarWidth] = useState(0);
  const setHover = (t: number | null) => {
    setHoverState(t);
    if (t != null && ref.current) setBarWidth(ref.current.clientWidth);
  };
  const [scrubbing, setScrubbing] = useState(false);

  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
  };

  const pct = (t: number) => (duration ? `${(t / duration) * 100}%` : '0%');
  const preview = hover != null && sprite ? spriteStyle(sprite, hover, 160) : null;
  const hoverTitle = hover != null ? [...chapters].reverse().find((c) => c.start <= hover)?.title : undefined;
  const hoverLeft = hover != null && barWidth ? Math.min(Math.max(80, (hover / duration) * barWidth), barWidth - 80) : 0;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={formatTimecode(current)}
      className="group/bar relative flex h-5 cursor-pointer touch-none items-center outline-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setScrubbing(true);
        onScrubStart?.();
        onSeek(at(e.clientX));
      }}
      onPointerMove={(e) => {
        const t = at(e.clientX);
        if (e.pointerType === 'mouse' || scrubbing) setHover(t);
        if (scrubbing) onSeek(t);
      }}
      onPointerUp={() => {
        setScrubbing(false);
        setHover(null);
        onScrubEnd?.();
      }}
      onPointerCancel={() => {
        // 拖到一半被系统手势打断：也要收尾，不然视频停在暂停、进度条卡在拖动状态
        if (!scrubbing) return;
        setScrubbing(false);
        setHover(null);
        onScrubEnd?.();
      }}
      onPointerLeave={() => !scrubbing && setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          onSeek(Math.min(duration, Math.max(0, current + (e.key === 'ArrowLeft' ? -5 : 5))));
        }
      }}
    >
      <div
        className={cn(
          'relative h-[3px] w-full rounded-full bg-white/20 transition-[height] duration-150 group-hover/bar:h-[5px]',
          scrubbing && 'h-[5px]',
        )}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: pct(buffered) }} />
        {loop && (
          <div
            className="absolute inset-y-[-3px] rounded-sm bg-stage-accent/35 ring-1 ring-stage-accent/70"
            style={{ left: pct(loop[0]), width: pct(loop[1] - loop[0]) }}
          />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full bg-stage-accent" style={{ width: pct(current) }} />
        <div
          className={cn(
            'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-150',
            scrubbing ? 'scale-110' : 'scale-0 group-hover/bar:scale-100',
          )}
          style={{ left: pct(current) }}
        />
        {chapters
          .filter((c) => c.start > 0.5 && c.start < duration - 0.5)
          .map((c) => (
            <span key={c.start} className="absolute inset-y-[-1px] w-[3px] -translate-x-1/2 bg-black" style={{ left: pct(c.start) }} />
          ))}
      </div>

      {markers.map((m) => (
        <span
          key={m.key}
          title={`${formatTimecode(m.t)} ${m.label}`}
          className="pointer-events-none absolute top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/80"
          style={{ left: pct(m.t) }}
        />
      ))}

      {hover != null && (
        <div
          className="pointer-events-none absolute bottom-6 flex -translate-x-1/2 flex-col items-center gap-1"
          style={{ left: hoverLeft }}
        >
          {preview && <div className="overflow-hidden rounded-lg border border-white/15 shadow-pop" style={preview} />}
          {hoverTitle && <span className="max-w-[200px] truncate text-[12px] font-medium text-white drop-shadow">{hoverTitle}</span>}
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white tabular">
            {formatTimecode(hover)}
          </span>
        </div>
      )}
    </div>
  );
}
