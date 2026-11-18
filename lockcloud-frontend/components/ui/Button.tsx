'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  'data-autofocus'?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-[1.06] active:brightness-95 shadow-soft',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg-soft hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-105 active:brightness-95',
  ink: 'bg-ink text-ink-fg hover:opacity-90',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-xl px-3 text-[13px]',
  md: 'h-9 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-11 gap-2 rounded-2xl px-5 text-[15px]',
};

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,filter,opacity] duration-150';

/** 长得像按钮的链接（不要在 <Link> 里套 <button>） */
export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(BASE, VARIANT[variant], SIZE[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,filter,opacity] duration-150',
        'disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <PauseMark size={14} state="busy" framed={false} /> : icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tone?: 'default' | 'stage';
}

const ICON_SIZE = { sm: 'h-7 w-7 rounded-lg', md: 'h-9 w-9 rounded-xl', lg: 'h-11 w-11 rounded-2xl' };

export function IconLink({ href, label, size = 'md', className, children }: { href: string; label: string; size?: 'sm' | 'md' | 'lg'; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-fg-soft transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
        ICON_SIZE[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', active, tone = 'default', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:opacity-40',
        ICON_SIZE[size],
        tone === 'stage'
          ? cn('text-stage-soft hover:bg-white/10 hover:text-stage-fg', active && 'bg-white/12 text-stage-fg')
          : cn('text-fg-soft hover:bg-surface-2 hover:text-fg', active && 'bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink'),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
