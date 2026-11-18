'use client';

import { useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, weekday } from '@/lib/format';
import { Popover } from './Popover';

interface DatePickerProps {
  /** YYYY-MM-DD，空字符串表示没选 */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayIso() {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

function parse(value: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  return m ? { y: +m[1], m: +m[2] - 1 } : null;
}

/** 一行"2026年5月16日 周六"，点开是自己画的中文月历（系统的日期框跟着浏览器语言走，样式也对不上） */
export function DatePicker({ value, onChange, placeholder = '选择日期', className }: DatePickerProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left text-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-soft',
          open ? 'border-accent ring-3 ring-accent-soft' : 'border-line-strong hover:border-fg-faint',
          className,
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-fg-faint" />
        {value ? (
          <span className="text-fg tabular">
            {formatDate(value)}
            <span className="ml-1.5 text-fg-faint">{weekday(value)}</span>
          </span>
        ) : (
          <span className="text-fg-faint">{placeholder}</span>
        )}
      </button>
      <Popover open={open} onOpenChange={setOpen} anchor={anchor} placement="bottom-start" className="w-[17.5rem] p-3">
        {open && (
          <Calendar
            value={value}
            onPick={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        )}
      </Popover>
    </>
  );
}

function Calendar({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const today = todayIso();
  const start = parse(value) ?? parse(today)!;
  const [view, setView] = useState(start);
  const [mode, setMode] = useState<'days' | 'months'>('days');

  const shift = (months: number) =>
    setView((v) => {
      const k = v.y * 12 + v.m + months;
      return { y: Math.floor(k / 12), m: ((k % 12) + 12) % 12 };
    });

  // 周一开头：这个月 1 号前面补上个月的尾巴，凑满 6 行
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.y, view.m, 1 - lead + i);
    return { iso: iso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.m };
  });

  const nav = (label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {icon}
    </button>
  );

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-2 tabular"
        >
          {mode === 'days' ? `${view.y}年${view.m + 1}月` : `${view.y}年`}
          <ChevronDown className={cn('h-3.5 w-3.5 text-fg-faint transition-transform', mode === 'months' && 'rotate-180')} />
        </button>
        <div className="flex">
          {nav(mode === 'days' ? '上个月' : '上一年', () => shift(mode === 'days' ? -1 : -12), <ChevronLeft className="h-4 w-4" />)}
          {nav(mode === 'days' ? '下个月' : '下一年', () => shift(mode === 'days' ? 1 : 12), <ChevronRight className="h-4 w-4" />)}
        </div>
      </div>

      {mode === 'days' ? (
        <>
          <div className="grid grid-cols-7 pb-1">
            {WEEK.map((w) => (
              <span key={w} className="py-1 text-center text-[11.5px] text-fg-faint">{w}</span>
            ))}
          </div>
          <div role="grid" className="grid grid-cols-7 gap-y-0.5">
            {cells.map((c) => {
              const picked = c.iso === value;
              const isToday = c.iso === today;
              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => onPick(c.iso)}
                  aria-pressed={picked}
                  aria-label={`${formatDate(c.iso)} ${weekday(c.iso)}`}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] tabular transition-colors',
                    picked
                      ? 'bg-accent font-semibold text-accent-fg'
                      : isToday
                        ? 'font-semibold text-accent hover:bg-accent-soft'
                        : c.inMonth
                          ? 'text-fg hover:bg-surface-2'
                          : 'text-fg-faint/60 hover:bg-surface-2',
                  )}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, m) => {
            const current = m === view.m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setView((v) => ({ ...v, m }));
                  setMode('days');
                }}
                className={cn(
                  'h-10 rounded-xl text-[13px] transition-colors',
                  current ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-fg hover:bg-surface-2',
                )}
              >
                {m + 1}月
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex justify-end border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="h-7 rounded-lg px-2.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-soft"
        >
          今天
        </button>
      </div>
    </div>
  );
}
