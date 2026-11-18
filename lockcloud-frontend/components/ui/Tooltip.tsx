'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePortalRoot } from '@/lib/portal';

interface TooltipProps {
  label: ReactNode;
  /** 快捷键，显示在说明右边 */
  shortcut?: string;
  /** 首选方向；放不下时自动翻到对面，左右贴边时往里收 */
  side?: 'top' | 'bottom' | 'right';
  children: ReactNode;
  disabled?: boolean;
}

const GAP = 8;
const EDGE = 6;

/** 悬停 400ms 后出现的小提示。不挡点击，不抢焦点。触屏上不出现。 */
export function Tooltip({ label, shortcut, side = 'top', children, disabled }: TooltipProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const portalRoot = usePortalRoot();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = (event?: React.PointerEvent) => {
    if (disabled || event?.pointerType === 'touch') return;
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setAnchor(r);
    }, 400);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setAnchor(null);
    setPos(null);
  };

  if (disabled && anchor) {
    setAnchor(null);
    setPos(null);
  }

  // 先不可见地渲染一次量出大小，再定位置
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (side === 'right' && anchor.right + GAP + w <= vw - EDGE) {
      left = anchor.right + GAP;
      top = anchor.top + anchor.height / 2 - h / 2;
    } else {
      const above = anchor.top - GAP - h;
      const below = anchor.bottom + GAP;
      const fitsAbove = above >= EDGE;
      const fitsBelow = below + h <= vh - EDGE;
      const wantAbove = side === 'top' || (side === 'right' && !fitsBelow);
      top = wantAbove ? (fitsAbove || !fitsBelow ? above : below) : (fitsBelow || !fitsAbove ? below : above);
      left = anchor.left + anchor.width / 2 - w / 2;
    }
    left = Math.min(Math.max(EDGE, left), vw - w - EDGE);
    top = Math.min(Math.max(EDGE, top), vh - h - EDGE);
    setPos({ left, top });
  }, [anchor, side]);

  return (
    <span
      ref={ref}
      className="inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={() => show()}
      onBlur={hide}
    >
      {children}
      {anchor && portalRoot && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={{ position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="pointer-events-none z-[400] flex items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-ink-fg shadow-float animate-fade"
        >
          {label}
          {shortcut && <kbd className="font-mono text-[11px] opacity-60">{shortcut}</kbd>}
        </span>,
        portalRoot,
      )}
    </span>
  );
}
