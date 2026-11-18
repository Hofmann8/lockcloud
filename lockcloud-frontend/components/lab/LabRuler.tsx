'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { beatIndexAt, countOf, decodeEnvelope, nearestBeat, type Sections } from '@/components/player/beats';
import type { LabBlock, LabGrid, LabMark } from '@/lib/api/lab';
import { WHY_LABEL } from './grid';

/** 节拍尺要的网格。标注试验给全的；修改八拍的工作台只有每段的起止，不带两个模型的意见 */
export type RulerGrid = Pick<LabGrid, 'times' | 'bpm' | 'sections' | 'envelope_rate' | 'envelope'> & {
  blocks: Array<Pick<LabBlock, 'start' | 't0' | 't1'> & Partial<Pick<LabBlock, 'why' | 'flag'>>>;
};

interface LabRulerProps {
  grid: RulerGrid;
  /** 套上标注之后的数法 */
  sections: Sections;
  marks: LabMark[];
  getTime: () => number;
  onSeek: (t: number) => void;
  height?: number;
}

const WINDOW_BEATS = 24;
const PLAYHEAD = 0.35;
const FLAG_COLOR = { agree: 'rgba(120,220,160,0.9)', split: 'rgba(255,190,90,0.95)', single: 'rgba(255,255,255,0.28)' };

/**
 * 标注用的节拍尺：和播放器里那条一样随播放往左走，多画三样：
 * 每段连续音乐顶上一条色带（两个模型一致、意见不一、只有一个模型）；标注（1、换歌、不准、备注）；
 * 标过之后数法变了的拍，底下用小字留着算法原来数的数。
 */
export function LabRuler({ grid, sections, marks, getTime, onSeek, height = 96 }: LabRulerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const envelope = useMemo(() => decodeEnvelope(grid.envelope), [grid.envelope]);
  const windowSec = (60 / (grid.bpm || 120)) * WINDOW_BEATS;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d')!;
    const accent = getComputedStyle(c).getPropertyValue('--stage-accent').trim() || '#7a8cff';
    const mono = getComputedStyle(document.body).getPropertyValue('--font-geist-mono').trim() || 'ui-monospace';
    const sans = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const times = grid.times;
    let raf = 0;

    const draw = () => {
      const now = getTime();
      const W = width;
      const H = height;
      const px = W * PLAYHEAD;
      const x = (t: number) => px + ((t - now) / windowSec) * W;
      const base = H - 34; // 刻度的底线
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 起音包络
      if (envelope.length) {
        const t0 = now - PLAYHEAD * windowSec;
        ctx.beginPath();
        ctx.moveTo(0, base);
        for (let sx = 0; sx <= W; sx += 2) {
          const v = envelope[Math.floor((t0 + (sx / W) * windowSec) * grid.envelope_rate)] ?? 0;
          ctx.lineTo(sx, base - v * 34);
        }
        ctx.lineTo(W, base);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }

      // 每段连续音乐：顶上的色带、段首的竖线和原因
      ctx.font = `500 10px ${sans}`;
      for (const b of grid.blocks) {
        const x0 = x(b.t0);
        const x1 = x(b.t1);
        if (x1 < 0 || x0 > W) continue;
        if (b.flag === 'split') {
          ctx.fillStyle = 'rgba(255,190,90,0.06)';
          ctx.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), base);
        }
        if (b.flag) {
          ctx.fillStyle = FLAG_COLOR[b.flag];
          ctx.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), 2);
        }
        if (b.start > 0 && x0 >= 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(Math.round(x0) - 0.5, 2, 1, base - 2);
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(b.why ? WHY_LABEL[b.why] ?? '' : '', x0 + 4, 26);
        }
      }

      // 拍
      const cur = beatIndexAt(times, now);
      const first = Math.max(0, beatIndexAt(times, now - PLAYHEAD * windowSec) - 1);
      const last = Math.min(times.length - 1, beatIndexAt(times, now + (1 - PLAYHEAD) * windowSec) + 1);
      ctx.textAlign = 'center';
      for (let i = first; i <= last; i++) {
        const bx = x(times[i]);
        const count = countOf(i, sections);
        const was = countOf(i, grid.sections);
        const one = count === 1;
        const tall = one ? 30 : count === 5 ? 20 : 12;
        ctx.globalAlpha = i < cur ? 0.5 : 1;
        ctx.fillStyle = one ? accent : count === 5 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)';
        ctx.fillRect(Math.round(bx) - (one ? 1 : 0.5), base - tall, one ? 2 : 1, tall);
        ctx.font = `${one ? 700 : 500} ${one ? 14 : 12}px ${mono}, ui-monospace, monospace`;
        ctx.fillStyle = one ? accent : 'rgba(255,255,255,0.7)';
        ctx.fillText(String(count), bx, base + 15);
        if (was !== count) {
          ctx.font = `500 9px ${mono}, ui-monospace, monospace`;
          ctx.fillStyle = 'rgba(255,255,255,0.32)';
          ctx.fillText(String(was), bx, base + 28);
        }
        ctx.globalAlpha = 1;
      }

      // 标注
      ctx.font = `600 10px ${sans}`;
      for (let k = 0; k < marks.length; k++) {
        const m = marks[k];
        const at = x(times[m.beat] ?? m.t);
        if (at < -40 || at > W + 40) continue;
        // 同一拍上标了几样的，小牌子往右排开
        let mx = at;
        for (let j = 0; j < k; j++) if (marks[j].beat === m.beat) mx += 18;
        if (m.kind === 'cut') {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(Math.round(at) + 0.5, 4);
          ctx.lineTo(Math.round(at) + 0.5, base);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const color = m.kind === 'one' ? accent : m.kind === 'off' ? 'rgb(255,120,110)' : 'rgba(255,255,255,0.92)';
        const text = m.kind === 'one' ? '1' : m.kind === 'cut' ? '换' : m.kind === 'off' ? '偏' : '注';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(mx - 8, 5, 16, 14, 4);
        ctx.fill();
        ctx.fillStyle = m.kind === 'one' || m.kind === 'off' ? '#fff' : '#111';
        ctx.fillText(text, mx, 15.5);
      }

      // 踩到拍的那一下
      if (cur >= 0) {
        const since = now - times[cur];
        if (since >= 0 && since < 0.18) {
          const one = countOf(cur, sections) === 1;
          ctx.fillStyle = one ? accent : '#ffffff';
          ctx.globalAlpha = (1 - since / 0.18) * (one ? 0.9 : 0.55);
          ctx.beginPath();
          ctx.arc(x(times[cur]), base - (one ? 34 : 16), one ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // 播放头
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(Math.round(px) - 0.5, 2, 1, H - 4);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, grid, sections, marks, envelope, windowSec, getTime]);

  return (
    <div
      ref={wrap}
      className="relative w-full cursor-pointer select-none"
      style={{ height }}
      onPointerUp={(e) => {
        const r = wrap.current!.getBoundingClientRect();
        const t = getTime() + ((e.clientX - r.left - r.width * PLAYHEAD) / r.width) * windowSec;
        onSeek(grid.times[nearestBeat(grid.times, t)]);
      }}
    >
      <canvas ref={canvas} className="stage absolute inset-0 h-full w-full" />
    </div>
  );
}

/** 整个视频的总览：每段连续音乐一格（颜色同上），标注是小点，点哪跳哪 */
export function LabOverview({
  grid,
  marks,
  duration,
  getTime,
  onSeek,
}: {
  grid: RulerGrid;
  marks: LabMark[];
  duration: number;
  getTime: () => number;
  onSeek: (t: number) => void;
}) {
  const head = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (head.current) head.current.style.left = `${Math.min(100, (getTime() / duration) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTime, duration]);

  const seek = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration);
  };
  const pct = (t: number) => `${(t / duration) * 100}%`;

  return (
    <div
      ref={wrap}
      className="relative h-7 w-full cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e);
      }}
      onPointerMove={(e) => dragging.current && seek(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <div className="absolute inset-x-0 top-2.5 h-2 rounded-full bg-white/8" />
      {grid.blocks.map((b) => (
        <div
          key={b.start}
          className="absolute top-2.5 h-2 rounded-full"
          style={{ left: pct(b.t0), width: `max(3px, calc(${pct(b.t1 - b.t0)} - 2px))`, background: b.flag ? FLAG_COLOR[b.flag] : FLAG_COLOR.single }}
        />
      ))}
      {marks.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full"
          style={{
            left: pct(m.t),
            background: m.kind === 'one' ? 'var(--stage-accent)' : m.kind === 'off' ? 'rgb(255,120,110)' : '#fff',
          }}
        />
      ))}
      <div ref={head} className="absolute top-1 h-5 w-0.5 -translate-x-1/2 rounded-full bg-white" />
    </div>
  );
}
