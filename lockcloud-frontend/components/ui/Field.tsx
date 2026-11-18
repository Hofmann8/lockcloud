'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-faint ' +
  'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft ' +
  'disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(CONTROL, 'h-9', invalid && 'border-danger focus:border-danger focus:ring-danger-soft', className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, 'min-h-20 resize-none py-2 leading-relaxed', className)} {...rest} />;
  },
);

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 里面是一组按钮（不是单个输入框）时用 div，免得点空白处触发第一个按钮 */
  as?: 'label' | 'div';
}

export function Field({ label, hint, error, children, className, as = 'label' }: FieldProps) {
  const Tag = as;
  return (
    <Tag className={cn('block', className)} {...(as === 'div' ? { role: 'group' } : {})}>
      <span className="mb-1.5 block text-[13px] font-medium text-fg-soft">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-fg-faint">{hint}</span>
      ) : null}
    </Tag>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/** 分段选择：视图切换、类型筛选这类二三选一 */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex shrink-0 rounded-xl bg-surface-2 p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            // grow：整条被拉宽（w-full）时几段平分，不把空白全剩在右边；按内容宽度时没有多余空间，不受影响
            'inline-flex grow items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,color,box-shadow] duration-150',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-surface text-fg shadow-soft' : 'text-fg-faint hover:text-fg-soft',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-[13px] text-fg-soft disabled:opacity-50"
    >
      <span
        className={cn(
          'relative h-5 w-8 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform duration-200 [transition-timing-function:var(--ease-lock)]',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1 font-mono text-[11px] text-fg-soft',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** 标签、筛选条件的小胶囊 */
export function Chip({ children, onRemove, active, onClick, className }: ChipProps) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'inline-flex h-7 max-w-full items-center gap-1 rounded-full border px-2.5 text-[13px] transition-colors',
        active
          ? 'border-transparent bg-accent-soft text-accent-ink'
          : 'border-line bg-surface text-fg-soft',
        onClick && !active && 'hover:border-line-strong hover:text-fg',
        onRemove && 'pr-1',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="移除"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRemove();
            }
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full opacity-60 hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] hover:opacity-100"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </Tag>
  );
}
