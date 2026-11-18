'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePortalRoot } from '@/lib/portal';

export interface ToastItem {
  id: number;
  message: ReactNode;
  tone?: 'default' | 'danger' | 'ok';
  /** 左边的小图，比如上传完成时跳一个 Lucky Locker */
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  duration?: number;
  /** 超时（没点 action）后执行，常用于"延迟删除" */
  onExpire?: () => void;
  /** 同 key 的提示只留最新一条（比如"网络断了"） */
  key?: string;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function toast(message: ReactNode, options: Omit<ToastItem, 'id' | 'message'> = {}) {
  const id = ++seq;
  const kept = options.key ? items.filter((t) => t.key !== options.key) : items;
  // 被挤掉的旧提示也算"到期"，保证延迟删除之类的回调一定会执行
  const dropped = kept.slice(0, -2);
  items = [...kept.slice(-2), { id, message, ...options }];
  emit();
  for (const item of dropped) item.onExpire?.();
  return id;
}

toast.error = (message: ReactNode, options: Omit<ToastItem, 'id' | 'message' | 'tone'> = {}) =>
  toast(message, { ...options, tone: 'danger', duration: options.duration ?? 6000 });

toast.ok = (message: ReactNode, options: Omit<ToastItem, 'id' | 'message' | 'tone'> = {}) =>
  toast(message, { ...options, tone: 'ok' });

export function dismissToast(id: number, { runExpire = false } = {}) {
  const item = items.find((t) => t.id === id);
  items = items.filter((t) => t.id !== id);
  emit();
  if (runExpire) item?.onExpire?.();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ToastView({ item }: { item: ToastItem }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(item.id, { runExpire: true }), item.duration ?? 4200);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration]);

  return (
    <div
      role={item.tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pl-4 pr-2 text-sm shadow-pop animate-lock-in',
        !!item.icon && 'pl-2',
      )}
    >
      {item.icon && <span className="flex shrink-0 items-center">{item.icon}</span>}
      {!item.icon && item.tone && item.tone !== 'default' && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', item.tone === 'danger' ? 'bg-danger' : 'bg-ok')}
        />
      )}
      <span className="min-w-0 flex-1 leading-snug text-fg">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismissToast(item.id);
          }}
          className="shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-soft"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="关闭"
        onClick={() => dismissToast(item.id, { runExpire: true })}
        className="shrink-0 rounded-lg p-1 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  const portalRoot = usePortalRoot();
  if (!portalRoot) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[300] flex flex-col items-center gap-2 px-4 md:bottom-5">
      {list.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>,
    portalRoot,
  );
}
