'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CornerDownLeft, Moon, Search, Sun, UserRound } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { activitiesApi, peopleApi } from '@/lib/api/media';
import { activityHref, personHref } from '@/lib/routes';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useIsAdmin } from '@/stores/authStore';
import { useUi } from '@/stores/uiStore';
import { NAV } from './nav';

interface Item {
  id: string;
  group: string;
  label: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const deferred = useDeferredValue(q.trim());
  const listRef = useRef<HTMLUListElement>(null);

  const activities = useQuery({
    queryKey: ['activities', 'palette', deferred],
    queryFn: ({ signal }) => activitiesApi.list({ q: deferred || undefined, per_page: 6 }, signal),
    enabled: open,
    meta: { silent: true },
  });
  const people = useQuery({
    queryKey: ['people', 'all'],
    // 和人物页共用一份缓存，取的范围要一样
    queryFn: () => peopleApi.list({ limit: 1000 }),
    enabled: open && deferred.length > 0,
    staleTime: 5 * 60 * 1000,
    meta: { silent: true },
  });

  const close = () => {
    setOpen(false);
    setQ('');
    setCursor(0);
  };

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const needle = deferred.toLowerCase();
    const out: Item[] = [];
    if (needle) {
      out.push({
        id: 'search',
        group: '搜索',
        label: <>搜索“{deferred}”</>,
        icon: <Search className="h-4 w-4" />,
        run: go(`/search?q=${encodeURIComponent(deferred)}`),
      });
    }
    for (const a of activities.data?.activities ?? []) {
      out.push({
        id: `a:${a.activity_date}|${a.activity_type}|${a.activity_name}`,
        group: '活动',
        label: a.activity_name || a.activity_type_display,
        hint: `${formatDate(a.activity_date)} · ${a.activity_type_display}`,
        icon: <CalendarDays className="h-4 w-4" />,
        run: go(activityHref(a)),
      });
    }
    if (needle) {
      for (const p of (people.data?.persons ?? []).filter((p) => p.name?.toLowerCase().includes(needle)).slice(0, 5)) {
        out.push({
          id: `p:${p.id}`,
          group: '人物',
          label: p.name,
          hint: `出现 ${p.face_count} 次`,
          icon: p.thumb_url ? <Avatar src={p.thumb_url} name={p.name} size={18} /> : <UserRound className="h-4 w-4" />,
          run: go(personHref(p.id)),
        });
      }
    }
    for (const n of NAV) {
      if (n.adminOnly && !isAdmin) continue;
      if (needle && !n.label.includes(deferred)) continue;
      const Icon = n.icon;
      out.push({ id: `nav:${n.href}`, group: '前往', label: n.label, icon: <Icon className="h-4 w-4" />, run: go(n.href) });
    }
    const themeLabel = resolvedTheme === 'dark' ? '切换到浅色外观' : '切换到深色外观';
    if (!needle || themeLabel.includes(deferred) || '主题外观'.includes(deferred)) {
      out.push({
        id: 'theme',
        group: '命令',
        label: themeLabel,
        icon: resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        run: () => {
          close();
          setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
        },
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, activities.data, people.data, isAdmin, resolvedTheme]);

  const active = Math.min(cursor, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = '';

  return (
    <Dialog open={open} onClose={close} align="top" hideClose className="max-w-xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Search className="h-4 w-4 shrink-0 text-fg-faint" />
        <input
          data-autofocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="搜索活动、人物或命令"
          className="h-14 w-full bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
          aria-label="命令"
        />
      </div>
      <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2 thin-scrollbar" role="listbox">
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id}>
              {header && <p className="px-3 pb-1 pt-2.5 text-[11px] font-medium tracking-wide text-fg-faint">{header}</p>}
              <button
                type="button"
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setCursor(i)}
                onClick={item.run}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px]',
                  i === active ? 'bg-surface-2 text-fg' : 'text-fg-soft',
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-faint">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="shrink-0 text-xs text-fg-faint">{item.hint}</span>}
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-fg-faint" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
