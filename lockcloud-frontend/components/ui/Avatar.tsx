'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: number;
  /** 没有头像时按 id 取一个稳定的底色 */
  seed?: number;
  className?: string;
}

export function Avatar({ name, src, size = 28, seed = 0, className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().slice(0, 1).toUpperCase();
  const hue = (seed * 47 + 30) % 360;
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: src && !broken ? 'var(--surface-2)' : `oklch(0.9 0.04 ${hue})`,
        color: `oklch(0.38 0.07 ${hue})`,
        fontSize: Math.max(10, size * 0.42),
      }}
      title={name || undefined}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} draggable={false} />
      ) : (
        <span className="font-medium leading-none">{initial}</span>
      )}
    </span>
  );
}
