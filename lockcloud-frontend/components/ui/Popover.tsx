'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePortalRoot } from '@/lib/portal';

type Placement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'top' | 'bottom' | 'right-start';

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  placement?: Placement;
  offset?: number;
  className?: string;
  /** 放在暗场（播放器）里用深色面板 */
  tone?: 'default' | 'stage';
  children: ReactNode;
}

interface Position {
  top: number;
  left: number;
  origin: string;
}

const EDGE = 8;

function computePosition(r: DOMRect, w: number, h: number, placement: Placement, offset: number): Position {
  if (placement === 'right-start') {
    let left = r.right + offset;
    if (left + w > window.innerWidth - EDGE) left = r.left - offset - w;
    const top = Math.min(Math.max(EDGE, r.top), window.innerHeight - h - EDGE);
    return { top, left, origin: 'left top' };
  }
  const wantTop = placement.startsWith('top');
  const roomAbove = r.top - offset - EDGE;
  const roomBelow = window.innerHeight - r.bottom - offset - EDGE;
  const top = wantTop
    ? (roomAbove >= h || roomAbove > roomBelow ? r.top - offset - h : r.bottom + offset)
    : (roomBelow >= h || roomBelow > roomAbove ? r.bottom + offset : r.top - offset - h);
  let left = placement.endsWith('end')
    ? r.right - w
    : placement === 'top' || placement === 'bottom'
      ? r.left + r.width / 2 - w / 2
      : r.left;
  left = Math.min(Math.max(EDGE, left), window.innerWidth - w - EDGE);
  const opensUp = top < r.top;
  const originX = placement.endsWith('end') ? 'right' : placement === 'top' || placement === 'bottom' ? 'center' : 'left';
  return { top: Math.max(EDGE, top), left, origin: `${originX} ${opensUp ? 'bottom' : 'top'}` };
}

export function Popover({
  open,
  onOpenChange,
  anchor,
  placement = 'bottom-start',
  offset = 8,
  className,
  tone = 'default',
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const portalRoot = usePortalRoot();
  const [pos, setPos] = useState<Position | null>(null);
  const closeRef = useRef(onOpenChange);
  useEffect(() => {
    closeRef.current = onOpenChange;
  });

  // 打开时量一次位置，窗口变化、滚动时跟着挪；点外面或按 Esc 关
  useLayoutEffect(() => {
    if (!open) return;
    // 鼠标点开的（按钮这时不是 :focus-visible），按 Esc 关掉后让按钮失焦：
    // 不然这一下按键会让浏览器当成键盘操作，给按钮套上焦点框。键盘打开的照旧留着焦点
    const trigger = anchor.current;
    const byKeyboard = trigger?.matches(':focus-visible') ?? false;
    trigger?.setAttribute('data-popover-open', '');
    const place = () => {
      const a = anchor.current;
      const panel = panelRef.current;
      if (!a || !panel) return;
      setPos(computePosition(a.getBoundingClientRect(), panel.offsetWidth, panel.offsetHeight, placement, offset));
    };
    place();
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return;
      closeRef.current(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current(false);
        if (!byKeyboard && trigger && document.activeElement === trigger) trigger.blur();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      trigger?.removeAttribute('data-popover-open');
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, placement, offset]);

  if (!open || !portalRoot) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      data-popover
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        transformOrigin: pos?.origin,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-[260] rounded-2xl p-1.5',
        tone === 'stage'
          ? 'stage border border-stage-line bg-stage-glass text-stage-fg shadow-pop backdrop-blur-xl'
          : 'border border-line bg-surface shadow-pop',
        pos && 'animate-pop',
        className,
      )}
    >
      {children}
    </div>,
    portalRoot,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  description?: ReactNode;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function MenuItem({ icon, label, hint, description, danger, active, disabled, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role={active === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group/item flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors [&:not(:first-child)]:mt-0.5',
        'disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger-soft' : 'hover:bg-[color-mix(in_oklch,currentColor_9%,transparent)]',
        active && 'font-medium',
      )}
    >
      {icon && <span className={cn('mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center', !danger && 'opacity-70')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-snug opacity-60">{description}</span>}
      </span>
      {hint && <span className="mt-[1px] shrink-0 text-xs opacity-50">{hint}</span>}
      {active && <Check className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-2 my-1 h-px bg-[color-mix(in_oklch,currentColor_12%,transparent)]" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium tracking-wide opacity-50">{children}</div>;
}
