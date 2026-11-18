'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { FileItem } from '@/lib/api/types';
import { aspectOf, displayName, previewStyle, thumbhashUrl, useSignedUrl, cachedUrl } from '@/lib/urls';

export interface Overlay {
  key: string | number;
  /** 转正后整图里的比例坐标 */
  rect: { x: number; y: number; w: number; h: number };
  label?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface ImageViewerProps {
  file: FileItem;
  overlays?: Overlay[];
  /** 没放大时左右滑动 / 下滑 */
  onSwipe?: (dir: 'prev' | 'next' | 'down') => void;
  onZoomChange?: (zoomed: boolean) => void;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MAX_SCALE = 6;

/** 大图：先显示网格里已经有的缩略图，再换预览尺寸；放大到两倍以上换原图。滚轮 / 双击 / 双指缩放，拖动平移 */
export function ImageViewer({ file, overlays = [], onSwipe, onZoomChange }: ImageViewerProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [hiLoaded, setHiLoaded] = useState(false);
  const [origLoaded, setOrigLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startView: View;
    start: { x: number; y: number };
    moved: boolean;
    /** 这次手势里出现过两根手指（双指缩放）：结束时不当成滑动 */
    multi: boolean;
  } | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const aspect = aspectOf(file);
  const low = cachedUrl(file.id, 'thumbdesktop') ?? cachedUrl(file.id, 'thumbmobile') ?? cachedUrl(file.id, 'thumbnavdesktop');
  const hi = useSignedUrl(file.id, previewStyle());
  const original = useSignedUrl(file.id, 'original', view.scale >= 2);
  const placeholder = thumbhashUrl(file.thumbhash);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 换文件时复位
  const [lastId, setLastId] = useState(file.id);
  if (lastId !== file.id) {
    setLastId(file.id);
    setView({ scale: 1, x: 0, y: 0 });
    setHiLoaded(false);
    setOrigLoaded(false);
  }

  useEffect(() => {
    onZoomChange?.(view.scale > 1.01);
  }, [view.scale, onZoomChange]);

  // 适配尺寸：整图放进容器
  const fit = (() => {
    if (!size.w || !size.h) return { w: 0, h: 0 };
    return size.w / size.h > aspect ? { w: size.h * aspect, h: size.h } : { w: size.w, h: size.w / aspect };
  })();

  const clamp = useCallback(
    (v: View): View => {
      const scale = Math.min(MAX_SCALE, Math.max(1, v.scale));
      const maxX = Math.max(0, (fit.w * scale - size.w) / 2);
      const maxY = Math.max(0, (fit.h * scale - size.h) / 2);
      return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) };
    },
    [fit.w, fit.h, size.w, size.h],
  );

  /** 以容器里的点 (px, py) 为中心缩放 */
  const zoomAt = useCallback(
    (next: number, px: number, py: number, from: View) => {
      const cx = px - size.w / 2;
      const cy = py - size.h / 2;
      const k = next / from.scale;
      return clamp({ scale: next, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k });
    },
    [clamp, size.w, size.h],
  );

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomAt(v.scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top, v));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onDoubleClick = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    setView((v) => (v.scale > 1.01 ? { scale: 1, x: 0, y: 0 } : zoomAt(2.5, e.clientX - r.left, e.clientY - r.top, v)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = {
      startDist: dist,
      startScale: view.scale,
      startView: view,
      start: { x: e.clientX, y: e.clientY },
      moved: false,
      multi: pts.length >= 2 || !!gesture.current?.multi,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.startDist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const r = box.current!.getBoundingClientRect();
      const mid = { x: (pts[0].x + pts[1].x) / 2 - r.left, y: (pts[0].y + pts[1].y) / 2 - r.top };
      setView(zoomAt(g.startScale * (dist / g.startDist), mid.x, mid.y, g.startView));
      g.moved = true;
      return;
    }
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
    if (g.startView.scale > 1.01) {
      setView(clamp({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (!g) return;
    if (pointers.current.size > 0) {
      // 双指松开一根：剩下那根接着拖，从它现在的位置、现在的缩放重新起算，不然画面会跳
      const [rest] = [...pointers.current.values()];
      const now = viewRef.current;
      gesture.current = { startDist: 0, startScale: now.scale, startView: now, start: rest, moved: true, multi: true };
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (g.multi || g.startView.scale > 1.01 || !g.moved || !onSwipe) return;
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwipe(dx < 0 ? 'next' : 'prev');
    else if (dy > 90 && dy > Math.abs(dx) * 1.4) onSwipe('down');
  };

  const shown = origLoaded ? original : hiLoaded ? hi : low;

  return (
    <div
      ref={box}
      className={cn('relative h-full w-full touch-none select-none overflow-hidden', view.scale > 1.01 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: fit.w,
          height: fit.h,
          transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: dragging ? 'none' : 'transform 0.22s var(--ease-out)',
          backgroundImage: placeholder && !shown ? `url(${placeholder})` : undefined,
          backgroundSize: 'cover',
        }}
      >
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={displayName(file)} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
        )}
        {/* 预加载更清楚的版本，加载好了再换，避免闪 */}
        {hi && !hiLoaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hi} alt="" className="hidden" onLoad={() => setHiLoaded(true)} />
        )}
        {original && view.scale >= 2 && !origLoaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={original} alt="" className="hidden" onLoad={() => setOrigLoaded(true)} />
        )}
        {overlays.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={o.onClick}
            className={cn(
              'group/face absolute rounded-[6px] border-[1.5px] transition-[border-color,box-shadow,opacity] duration-150',
              o.active ? 'border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]' : 'border-white/70 hover:border-white',
            )}
            style={{
              left: `${o.rect.x * 100}%`,
              top: `${o.rect.y * 100}%`,
              width: `${o.rect.w * 100}%`,
              height: `${o.rect.h * 100}%`,
              borderWidth: 1.5 / view.scale,
            }}
          >
            {o.label && (
              <span
                className={cn(
                  'absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm transition-opacity',
                  o.active ? 'opacity-100' : 'opacity-0 group-hover/face:opacity-100',
                )}
                style={{ transform: `translateX(-50%) scale(${1 / view.scale})`, transformOrigin: 'top center' }}
              >
                {o.label}
              </span>
            )}
          </button>
        ))}
      </div>
      {view.scale > 1.01 && (
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[11px] text-white/80 backdrop-blur-sm tabular">
          {Math.round(view.scale * 100)}%{origLoaded ? ' · 原图' : ''}
        </span>
      )}
    </div>
  );
}
