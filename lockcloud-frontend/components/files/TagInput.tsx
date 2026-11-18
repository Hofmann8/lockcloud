'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { tagsApi } from '@/lib/api/files';
import { useDebounced } from '@/lib/hooks';

interface TagInputProps {
  onAdd: (name: string) => void | Promise<void>;
  /** 已有的标签不再出现在候选里 */
  exclude?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** dashed：跟在标签后面的小虚线框；field：面板里的正式输入框 */
  variant?: 'dashed' | 'field';
}

/** 加标签：边输边补全，回车加上 */
export function TagInput({ onAdd, exclude = [], placeholder = '添加标签', autoFocus, className, variant = 'dashed' }: TagInputProps) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebounced(value.trim(), 150);

  const suggestions = useQuery({
    queryKey: ['tags', 'search', q],
    queryFn: () => tagsApi.search(q, 8),
    enabled: q.length > 0,
    meta: { silent: true },
    staleTime: 30_000,
  });
  const popular = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: tagsApi.all,
    enabled: focused && q.length === 0,
    meta: { silent: true },
    staleTime: 5 * 60_000,
  });

  const source = q ? suggestions.data : popular.data?.slice().sort((a, b) => b.count - a.count).slice(0, 8);
  const options = (source ?? []).filter((t) => !exclude.includes(t.name));

  const submit = async (name: string) => {
    const clean = name.trim().replace(/^#/, '');
    if (!clean) return;
    setValue('');
    setCursor(-1);
    await onAdd(clean);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-1.5 transition-[border-color,box-shadow]',
          variant === 'dashed'
            ? 'h-8 rounded-xl border border-dashed border-line-strong px-2.5 focus-within:border-solid focus-within:border-accent'
            : 'h-9 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft',
        )}
      >
        {variant === 'dashed' ? (
          <Plus className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
        ) : (
          <TagIcon className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
        )}
        <input
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setCursor(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(options.length - 1, c + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(-1, c - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              void submit(cursor >= 0 && options[cursor] ? options[cursor].name : value);
            } else if (e.key === 'Escape' && value) {
              e.stopPropagation();
              setValue('');
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-fg-faint focus:outline-none"
        />
      </div>
      {focused && options.length > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop animate-pop"
        >
          {options.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void submit(t.name)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px]',
                  i === cursor ? 'bg-surface-2 text-fg' : 'text-fg-soft hover:bg-surface-2',
                )}
              >
                <span className="truncate">{t.name}</span>
                <span className="text-[11px] text-fg-faint tabular">{t.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
