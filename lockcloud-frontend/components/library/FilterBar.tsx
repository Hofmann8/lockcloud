'use client';

import { useRef, useState } from 'react';
import { ChevronDown, GalleryVerticalEnd, LayoutGrid, Rows3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Chip, Segmented } from '@/components/ui/Field';
import { MenuItem, Popover } from '@/components/ui/Popover';
import { ACTIVITY_TYPES } from '@/lib/constants/activityTypes';
import { useUi, type GridDensity } from '@/stores/uiStore';

export interface LibraryFilters {
  type: string;
  media: '' | 'image' | 'video';
  year: string;
  view: 'activities' | 'all';
}

interface FilterBarProps {
  value: LibraryFilters;
  onChange: (patch: Partial<LibraryFilters>) => void;
  years: Array<{ year: number; count: number }>;
}

export function FilterBar({ value, onChange, years }: FilterBarProps) {
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const yearAnchor = useRef<HTMLButtonElement>(null);
  const [yearOpen, setYearOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <Chip active={!value.type} onClick={() => onChange({ type: '' })}>全部</Chip>
        {ACTIVITY_TYPES.map((t) => (
          <Chip key={t.value} active={value.type === t.value} onClick={() => onChange({ type: value.type === t.value ? '' : t.value })}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:overflow-visible sm:px-0">
        <button
          ref={yearAnchor}
          type="button"
          onClick={() => setYearOpen((v) => !v)}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-[13px] font-medium transition-colors',
            value.year ? 'bg-accent-soft text-accent-ink' : 'text-fg-soft hover:bg-surface-2',
          )}
        >
          <span className="tabular">{value.year ? `${value.year} 年` : '全部年份'}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
        <Popover open={yearOpen} onOpenChange={setYearOpen} anchor={yearAnchor} placement="bottom-end" className="w-44">
          <MenuItem label="全部年份" active={!value.year} onSelect={() => { onChange({ year: '' }); setYearOpen(false); }} />
          {years.map((y) => (
            <MenuItem
              key={y.year}
              label={<span className="tabular">{y.year} 年</span>}
              hint={<span className="tabular">{y.count}</span>}
              active={value.year === String(y.year)}
              onSelect={() => {
                onChange({ year: String(y.year) });
                setYearOpen(false);
              }}
            />
          ))}
        </Popover>

        <Segmented<'' | 'image' | 'video'>
          size="sm"
          value={value.media}
          onChange={(media) => onChange({ media })}
          aria-label="类型"
          options={[
            { value: '', label: '全部' },
            { value: 'image', label: '照片' },
            { value: 'video', label: '视频' },
          ]}
        />

        <Segmented<'activities' | 'all'>
          size="sm"
          value={value.view}
          onChange={(view) => onChange({ view })}
          aria-label="视图"
          className="hidden sm:inline-flex"
          options={[
            { value: 'activities', label: '活动', icon: <GalleryVerticalEnd className="h-3.5 w-3.5" /> },
            { value: 'all', label: '平铺', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
          ]}
        />

        {value.view === 'all' && <DensityToggle value={density} onChange={setDensity} />}
      </div>
    </div>
  );
}

export function DensityToggle({ value, onChange }: { value: GridDensity; onChange: (d: GridDensity) => void }) {
  const next: Record<GridDensity, GridDensity> = { sm: 'md', md: 'lg', lg: 'sm' };
  const label = { sm: '小图', md: '中图', lg: '大图' }[value];
  return (
    <button
      type="button"
      onClick={() => onChange(next[value])}
      className="hidden h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] text-fg-soft transition-colors hover:bg-surface-2 sm:inline-flex"
      aria-label={`图片大小：${label}`}
    >
      <Rows3 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
