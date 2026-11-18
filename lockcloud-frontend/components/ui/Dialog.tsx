'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** 顶部对齐（命令面板）还是居中 */
  align?: 'center' | 'top';
  hideClose?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  align = 'center',
  hideClose,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // 弹窗里开着的小浮层（日历、菜单）先关它自己，弹窗留着
        if (document.querySelector('[data-popover]')) return;
        event.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current;
    focusTarget?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[250] flex justify-center px-4',
        align === 'top' ? 'items-start pt-[12vh]' : 'items-end pb-4 sm:items-center sm:pb-0',
      )}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[86vh] w-full max-w-md flex-col rounded-3xl border border-line bg-surface shadow-pop outline-none animate-lock-in',
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-5">
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold text-fg">{title}</h2>}
              {description && <p className="mt-1 text-[13px] leading-relaxed text-fg-soft">{description}</p>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="-mr-2 -mt-0.5 shrink-0 rounded-xl p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {children && <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
}

/** 二次确认。文案要说清楚后果，比如"移到回收站？30 天内可以恢复。" */
export function Confirm({ open, onClose, onConfirm, title, description, confirmLabel = '确定', danger, busy }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      hideClose
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
