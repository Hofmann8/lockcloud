'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import type { FileItem } from '@/lib/api/types';
import { aspectOf, displayName } from '@/lib/urls';
import { useSelection } from '@/stores/selectionStore';
import { useUi } from '@/stores/uiStore';
import { JustifiedGrid } from './JustifiedGrid';
import { Thumb } from './Thumb';

const ROW_HEIGHT = { sm: 140, md: 200, lg: 290 };

interface FileGridProps {
  files: FileItem[];
  /** 选择集合的作用域（一般是页面地址），换页面自动清空 */
  scope: string;
  onOpen: (file: FileItem, index: number) => void;
  selectable?: boolean;
  className?: string;
}

export function FileGrid({ files, scope, onOpen, selectable = true, className }: FileGridProps) {
  const density = useUi((s) => s.density);
  const selection = useSelection();
  const selected = useMemo(
    () => new Set(selection.scope === scope ? selection.ids : []),
    [selection.ids, selection.scope, scope],
  );
  const selecting = selected.size > 0;
  const ordered = useMemo(() => files.map((f) => f.id), [files]);

  useEffect(() => {
    if (!selectable) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useSelection.getState().setAll(ordered, scope);
      } else if (e.key === 'Escape' && useSelection.getState().ids.length) {
        useSelection.getState().clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ordered, scope, selectable]);

  const getKey = useCallback((f: FileItem) => f.id, []);

  return (
    <JustifiedGrid
      className={className}
      items={files}
      getKey={getKey}
      getAspect={aspectOf}
      rowHeight={ROW_HEIGHT[density]}
      gap={density === 'sm' ? 3 : 4}
      renderItem={(file, box, index) => {
        const isSelected = selected.has(file.id);
        const click = (e: React.MouseEvent) => {
          if (selectable && e.shiftKey) {
            e.preventDefault();
            selection.selectRange(ordered, file.id, scope);
          } else if (selectable && (selecting || e.metaKey || e.ctrlKey)) {
            selection.toggle(file.id, scope);
          } else {
            onOpen(file, index);
          }
        };
        return (
          <div
            role="button"
            tabIndex={0}
            aria-label={displayName(file)}
            aria-pressed={selectable ? isSelected : undefined}
            onClick={click}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(file, index);
              if (e.key === ' ' && selectable) {
                e.preventDefault();
                selection.toggle(file.id, scope);
              }
            }}
            className="group/tile absolute inset-0 cursor-pointer select-none outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Thumb
              file={file}
              width={box.width}
              height={box.height}
              scrub={!selecting}
              className={cn(
                'h-full w-full transition-[transform,border-radius] duration-200 [transition-timing-function:var(--ease-lock)]',
                isSelected && 'scale-[0.9] rounded-lg',
              )}
            />
            {isSelected && <span className="pointer-events-none absolute inset-0 bg-accent/10" />}
            {/* 印样上的片号 */}
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 font-mono text-[10px] leading-none text-white/0 transition-colors duration-150 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)] group-hover/tile:text-white/80 tabular">
              {index + 1}
            </span>
            {selectable && (
              <button
                type="button"
                aria-label={isSelected ? '取消选择' : '选择'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey) selection.selectRange(ordered, file.id, scope);
                  else selection.toggle(file.id, scope);
                }}
                className={cn(
                  'absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-[opacity,background-color,border-color] duration-150',
                  isSelected
                    ? 'border-accent bg-accent text-accent-fg opacity-100'
                    : 'border-white/90 bg-black/15 text-transparent opacity-0 backdrop-blur-[2px] hover:bg-black/30 group-hover/tile:opacity-100',
                  selecting && !isSelected && 'opacity-100',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            )}
          </div>
        );
      }}
    />
  );
}
