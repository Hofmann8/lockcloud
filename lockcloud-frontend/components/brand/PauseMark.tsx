'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type PauseMarkState = 'idle' | 'busy' | 'done';

interface PauseMarkProps {
  size?: number;
  state?: PauseMarkState;
  /** false 时只画两道竖线（按钮里当加载指示用） */
  framed?: boolean;
  /** 每次变化两道线"咔哒"对齐一次（上传完成、转码完成） */
  clickKey?: number | string;
  className?: string;
  title?: string;
}

/**
 * 品牌标：一叠冲洗好的照片，最上面那张印着暂停符号。
 * 家族共用的两道并行竖线，在 LockAI 是锁孔、在 LockAuth 是钥匙槽，在这里是 ⏸——锁舞的 lock 就是定格。
 * 静止时右边那道高出半个像素，像没完全扣上；忙碌时两道线按"抬—停—扣—停"交替起落，右边晚半拍。
 */
export function PauseMark({ size = 28, state = 'idle', framed = true, clickKey, className, title = 'LockCloud' }: PauseMarkProps) {
  const [clicking, setClicking] = useState(false);
  const [lastKey, setLastKey] = useState(clickKey);
  if (clickKey !== lastKey) {
    setLastKey(clickKey);
    if (clickKey !== undefined) setClicking(true);
  }

  useEffect(() => {
    if (!clicking) return;
    const t = window.setTimeout(() => setClicking(false), 420);
    return () => window.clearTimeout(t);
  }, [clicking]);

  const busy = state === 'busy';
  const settled = state === 'done' || clicking;
  const barStyle = (delay: number): React.CSSProperties => ({
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
    animation: busy
      ? `bar-lift 1.15s cubic-bezier(0.3, 0.7, 0.3, 1) ${delay}s infinite`
      : settled
        ? `bar-click 0.42s var(--ease-lock) ${delay / 4}s both`
        : undefined,
  });

  if (!framed) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        role="img"
        aria-label={busy ? '处理中' : title}
        className={cn('shrink-0 overflow-visible', className)}
      >
        <rect x="4.2" y="3" width="2.6" height="10" rx="1.3" fill="currentColor" style={barStyle(0)} />
        <rect x="9.2" y={settled || busy ? 3 : 2.5} width="2.6" height="10" rx="1.3" fill="currentColor" style={barStyle(0.29)} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('shrink-0 overflow-visible', className)}
    >
      {/* 后面那张 */}
      <rect x="9.5" y="3.6" width="18.9" height="16.9" rx="4.2" stroke="currentColor" strokeWidth="1.3" opacity="0.42" />
      {/* 最上面那张 */}
      <rect x="3.6" y="9" width="20.6" height="19.4" rx="4.6" fill="currentColor" />
      <rect x="10.55" y="14" width="1.9" height="9.4" rx="0.95" fill="var(--bg)" style={barStyle(0)} />
      <rect
        x="15.35"
        y={settled || busy ? 14 : 13.5}
        width="1.9"
        height="9.4"
        rx="0.95"
        fill="var(--accent)"
        style={{ ...barStyle(0.29), transition: 'y 0.3s var(--ease-lock)' }}
      />
    </svg>
  );
}

/** 字标：LockCloud。"Lock" 用柔软的 70 年代斜衬线，"Cloud" 收一点，和 LockAI、LockAuth 同一写法 */
export function Wordmark({ className, subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <span
      className={cn('font-display text-[19px] leading-none tracking-[-0.02em] text-fg', className)}
      style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72' }}
    >
      <span className="italic">Lock</span>
      <span
        className={cn('ml-[1px]', subtle ? 'text-fg-faint' : 'text-fg-soft')}
        style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0, "opsz" 72' }}
      >
        Cloud
      </span>
    </span>
  );
}

/** 整页加载：标志在中间按节奏动，下面一行字 */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 text-fg animate-fade" role="status">
      <PauseMark size={34} state="busy" />
      {label && <p className="text-[13px] text-fg-faint">{label}</p>}
    </div>
  );
}
