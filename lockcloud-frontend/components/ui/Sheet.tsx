'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 手机上的底部抽屉：往下拖可以关 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
    panel.current.style.transition = 'none';
  };
  const onPointerUp = () => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panel.current.style.transition = '';
    panel.current.style.transform = '';
    if (dy > 80) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[250]">
      <div className="absolute inset-0 bg-scrim animate-fade" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop transition-transform duration-200 animate-sheet-up',
          className,
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-2.5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1 w-9 rounded-full bg-line-strong" />
          {title && <h2 className="mt-3 text-[15px] font-semibold text-fg">{title}</h2>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
