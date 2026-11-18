'use client';

import { useId, useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * Lucky Locker：队里画的 16 个锁舞动作小人（public/moves/1–16.gif，240×240，透明底）。
 * 用在加载、空状态、登录页、上传完成这些"喘口气"的地方；功能界面里不出现。
 */
export const MOVE_COUNT = 16;

export const moveSrc = (n: number) => `/moves/${((n - 1) % MOVE_COUNT + MOVE_COUNT) % MOVE_COUNT + 1}.gif`;

// 每次打开页面换一批动作；服务端渲染时不出图，避免水合对不上
const seed = typeof window === 'undefined' ? 0 : Math.floor(Math.random() * 9973);
const noop = () => () => {};

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 不指定动作时，每个实例在客户端随机挑一个（同一页面里的几个尽量不同） */
export function useRandomMove(fixed?: number): number | null {
  const id = useId();
  return useSyncExternalStore(
    noop,
    () => fixed ?? ((hash(id) + seed) % MOVE_COUNT) + 1,
    () => fixed ?? null,
  );
}

interface LuckyLockerProps {
  move?: number;
  size?: number;
  className?: string;
}

export function LuckyLocker({ move, size = 96, className }: LuckyLockerProps) {
  const n = useRandomMove(move);
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      {n && (
        <Image
          src={moveSrc(n)}
          alt=""
          width={size}
          height={size}
          unoptimized
          draggable={false}
          className="h-full w-full object-contain animate-fade"
        />
      )}
    </span>
  );
}

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  move?: number;
  /** 找不到东西时不要小人（比如搜索没结果），只留字 */
  quiet?: boolean;
  className?: string;
}

export function EmptyState({ title, description, action, move, quiet, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center animate-fade', className)}>
      {!quiet && <LuckyLocker move={move} size={112} className="mb-3" />}
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-faint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * 一条底片：16 个动作排成印样上的一格一格，边上带齿孔和片号，慢慢往左走。
 * 登录页和 404 用。减弱动效时停住。
 */
export function FilmStrip({ className, frameSize = 132 }: { className?: string; frameSize?: number }) {
  const frames = Array.from({ length: MOVE_COUNT }, (_, i) => i + 1);
  const rail = 'relative h-5 bg-ink text-ink-fg';
  const sprockets = {
    backgroundImage: 'radial-gradient(circle at center, var(--bg) 0 3.2px, transparent 3.6px)',
    backgroundSize: `${frameSize / 4}px 100%`,
    backgroundRepeat: 'repeat-x',
  } as React.CSSProperties;

  const strip = (copy: number) => (
    <div className="flex shrink-0" aria-hidden={copy > 0}>
      {frames.map((n) => (
        <div key={`${copy}-${n}`} className="shrink-0" style={{ width: frameSize + 8 }}>
          <div className={rail} style={sprockets} />
          <div className="bg-ink px-1">
            <div className="relative bg-frame" style={{ height: frameSize }}>
              <Image
                src={moveSrc(n)}
                alt=""
                width={frameSize}
                height={frameSize}
                unoptimized
                draggable={false}
                className="h-full w-full object-contain p-2"
              />
            </div>
          </div>
          <div className={cn(rail, 'flex items-center justify-between px-2.5 font-mono text-[9px] tracking-wider')}>
            <span className="opacity-70">{n}</span>
            <span className="opacity-40">▸ {n}A</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="flex w-max motion-safe:animate-[marquee_90s_linear_infinite] hover:[animation-play-state:paused]">
        {strip(0)}
        {strip(1)}
      </div>
    </div>
  );
}
