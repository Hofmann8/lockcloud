'use client';

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Box {
  width: number;
  height: number;
}

interface JustifiedGridProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  getAspect: (item: T) => number;
  renderItem: (item: T, box: Box, index: number) => ReactNode;
  /** 目标行高；手机上会自动变成三列方格 */
  rowHeight?: number;
  gap?: number;
  className?: string;
  /** 手机上用方格还是也排成行 */
  squareOnMobile?: boolean;
}

interface Row<T> {
  items: Array<{ item: T; index: number; width: number }>;
  height: number;
}

function layout<T>(items: T[], aspects: number[], width: number, target: number, gap: number): Row<T>[] {
  const rows: Row<T>[] = [];
  let current: Array<{ item: T; index: number; aspect: number }> = [];
  let sum = 0;
  const flush = (last: boolean) => {
    if (!current.length) return;
    const gaps = gap * (current.length - 1);
    let h = (width - gaps) / sum;
    // 最后一行不够长时不拉伸，按目标高度排
    if (last && h > target * 1.35) h = target;
    rows.push({
      height: h,
      items: current.map((c) => ({ item: c.item, index: c.index, width: c.aspect * h })),
    });
    current = [];
    sum = 0;
  };
  items.forEach((item, index) => {
    const aspect = aspects[index];
    current.push({ item, index, aspect });
    sum += aspect;
    const rowWidth = sum * target + gap * (current.length - 1);
    if (rowWidth >= width) flush(false);
  });
  flush(true);
  return rows;
}

/**
 * 等高行排版：照片按原比例排成齐边的行，像印样。
 * 行用 content-visibility 跳过屏幕外的渲染，上千张也不卡。
 */
export function JustifiedGrid<T>({
  items,
  getKey,
  getAspect,
  renderItem,
  rowHeight = 200,
  gap = 4,
  className,
  squareOnMobile = true,
}: JustifiedGridProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const square = squareOnMobile && width > 0 && width < 560;
  const aspects = useMemo(() => items.map(getAspect), [items, getAspect]);

  const rows = useMemo(() => {
    if (!width) return [];
    if (square) {
      const cols = 3;
      const size = (width - gap * (cols - 1)) / cols;
      const out: Row<T>[] = [];
      for (let i = 0; i < items.length; i += cols) {
        out.push({
          height: size,
          items: items.slice(i, i + cols).map((item, k) => ({ item, index: i + k, width: size })),
        });
      }
      return out;
    }
    return layout(items, aspects, width, rowHeight, gap);
  }, [items, aspects, width, rowHeight, gap, square]);

  return (
    <div ref={ref} className={cn('flex w-full flex-col', className)} style={{ gap }}>
      {rows.map((row) => (
        <div
          key={getKey(row.items[0].item)}
          className="flex"
          style={{
            gap,
            height: row.height,
            contentVisibility: 'auto',
            containIntrinsicSize: `auto ${Math.round(row.height)}px`,
          }}
        >
          {row.items.map(({ item, index, width: w }) => (
            <div key={getKey(item)} className="relative shrink-0" style={{ width: w, height: row.height }}>
              {renderItem(item, { width: w, height: row.height }, index)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
