'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Beats } from '@/lib/api/types';
import { beatIndexAt, countOf, decodeEnvelope, eightOf } from './beats';

interface BeatRulerProps {
  beats: Beats;
  /** 每帧读当前时刻，不走 React 状态，60fps 也不重渲染 */
  getTime: () => number;
  onSeek: (t: number) => void;
  /** 点"1"时按住 Shift：循环这个八拍 */
  onLoopEight?: (beatIndex: number) => void;
  height?: number;
}

const WINDOW_BEATS = 16;
const PLAYHEAD = 0.3;

/**
 * 节拍尺：以播放头为中心的一段窗口（16 拍），随播放往左走，像音乐软件里的走带。
 * 每拍一道刻度，"1"最长、用强调色，上面标第几个八拍；"5"次之；底下是起音包络。
 * 当前这一拍踩到时亮一下——跟着音乐走，不是匀速闪。
 */
export function BeatRuler({ beats, getTime, onSeek, onLoopEight, height = 46 }: BeatRulerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const envelope = useMemo(() => decodeEnvelope(beats.envelope), [beats.envelope]);
  const windowSec = (60 / (beats.bpm || 120)) * WINDOW_BEATS;

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
    const styles = getComputedStyle(c);
    const accent = styles.getPropertyValue('--stage-accent').trim() || '#7a8cff';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mono = getComputedStyle(document.body).getPropertyValue('--font-geist-mono').trim() || 'ui-monospace';
    let raf = 0;

    const draw = () => {
      const now = getTime();
      const W = width;
      const H = height;
      const px = W * PLAYHEAD;
      const x = (t: number) => px + ((t - now) / windowSec) * W;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 起音包络
      if (envelope.length) {
        const rate = beats.envelope_rate;
        const t0 = now - PLAYHEAD * windowSec;
        const base = H - 4;
        ctx.beginPath();
        ctx.moveTo(0, base);
        const step = 2;
        for (let sx = 0; sx <= W; sx += step) {
          const t = t0 + (sx / W) * windowSec;
          const v = envelope[Math.floor(t * rate)] ?? 0;
          ctx.lineTo(sx, base - v * (H * 0.42));
        }
        ctx.lineTo(W, base);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fill();
      }

      const times = beats.times;
      const cur = beatIndexAt(times, now);
      const first = Math.max(0, beatIndexAt(times, now - PLAYHEAD * windowSec) - 1);
      const last = Math.min(times.length - 1, beatIndexAt(times, now + (1 - PLAYHEAD) * windowSec) + 1);
      ctx.textAlign = 'center';
      ctx.font = `500 10px ${mono}, ui-monospace, monospace`;

      for (let i = first; i <= last; i++) {
        const bx = x(times[i]);
        const count = countOf(i, beats.sections);
        const past = i < cur;
        const one = count === 1;
        const tall = one ? 22 : count === 5 ? 15 : 10;
        const top = H - 6 - tall;
        ctx.globalAlpha = past ? 0.45 : 1;
        ctx.fillStyle = one ? accent : count === 5 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)';
        ctx.fillRect(Math.round(bx) - (one ? 1 : 0.5), top, one ? 2 : 1, tall);
        ctx.fillStyle = one ? accent : 'rgba(255,255,255,0.5)';
        ctx.fillText(String(count), bx + (one ? 8 : 6), H - 7);
        if (i > 0 && beats.parts.includes(i)) {
          // 段落分界（换舞、串烧换歌）：一道竖线，八拍从这里重新数
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(Math.round(bx) - 0.5, 1, 1, H - 2);
        }
        if (one) {
          const n = eightOf(i, beats.sections, beats.parts);
          if (n >= 1) {
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(`${n}`, bx + 3, 9);
            ctx.textAlign = 'center';
          }
        }
        ctx.globalAlpha = 1;
      }

      // 踩到拍的那一下
      if (cur >= 0 && !reduce) {
        const since = now - times[cur];
        if (since >= 0 && since < 0.18) {
          const a = 1 - since / 0.18;
          const one = countOf(cur, beats.sections) === 1;
          ctx.fillStyle = one ? accent : '#ffffff';
          ctx.globalAlpha = a * (one ? 0.9 : 0.55);
          ctx.beginPath();
          ctx.arc(x(times[cur]), H - 6 - (one ? 24 : 12), one ? 3.5 : 2.5, 0, Math.PI * 2);
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
  }, [width, height, beats, envelope, windowSec, getTime]);

  const pick = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const now = getTime();
    const t = now + ((e.clientX - r.left - r.width * PLAYHEAD) / r.width) * windowSec;
    const times = beats.times;
    let i = beatIndexAt(times, t);
    if (i < 0) i = 0;
    if (i < times.length - 1 && times[i + 1] - t < t - times[i]) i++;
    return i;
  };

  return (
    <div
      ref={wrap}
      className="relative w-full cursor-pointer select-none"
      style={{ height }}
      onPointerUp={(e) => {
        const i = pick(e);
        if (e.shiftKey && onLoopEight) onLoopEight(i);
        else onSeek(beats.times[i]);
      }}
      role="slider"
      aria-label="节拍"
      aria-valuenow={0}
    >
      <canvas ref={canvas} className="stage absolute inset-0 h-full w-full" />
    </div>
  );
}
