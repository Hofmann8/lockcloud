'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { scrollRootOf } from '@/lib/hooks';

/** Shell 里顶栏的位置：在滚动区外面，滚动条不从它旁边经过 */
export const HeaderSlot = createContext<HTMLElement | null>(null);

interface PageHeaderProps {
  title?: ReactNode;
  /** 标题下面的一行说明 */
  subtitle?: ReactNode;
  /** 标题左边（返回按钮之类） */
  leading?: ReactNode;
  actions?: ReactNode;
  /** 标题下面、吸顶的工具行（筛选条） */
  toolbar?: ReactNode;
  className?: string;
}

/** 页面顶部：固定在内容上方，内容滚动后出现细分隔线 */
export function PageHeader({ title, subtitle, leading, actions, toolbar, className }: PageHeaderProps) {
  const slot = useContext(HeaderSlot);
  const sentinel = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const root = scrollRootOf(el);
    // 整页滚动（手机）时顶栏盖在内容上面，哨兵要越过顶栏的高度才算滚走
    // 哨兵正好贴着顶栏下沿，留一个像素，不然在顶部时算不准
    const top = root ? 0 : Math.max(0, (header.current?.offsetHeight ?? 0) - 1);
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      root,
      rootMargin: `-${top}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [slot]);

  const bar = (
    <header
      ref={header}
      className={cn(
        'border-b bg-bg/88 backdrop-blur-xl transition-colors duration-200',
        !slot && 'sticky top-0 z-30',
        stuck ? 'border-line' : 'border-transparent',
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
        {leading}
        <div className="min-w-0 flex-1 py-2">
          {typeof title === 'string' ? (
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-fg">{title}</h1>
          ) : (
            title
          )}
          {subtitle && <p className="truncate text-xs text-fg-faint">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {toolbar && <div className="px-4 pb-3 sm:px-6 lg:px-8">{toolbar}</div>}
    </header>
  );

  return (
    <>
      <div ref={sentinel} className="h-0" aria-hidden />
      {slot ? createPortal(bar, slot) : bar}
    </>
  );
}
