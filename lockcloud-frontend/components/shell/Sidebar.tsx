'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PauseMark, Wordmark } from '@/components/brand/PauseMark';
import { Tooltip } from '@/components/ui/Tooltip';
import { activitiesApi, requestsApi } from '@/lib/api/media';
import { activityHref } from '@/lib/routes';
import { splitDate } from '@/lib/format';
import { useIsAdmin } from '@/stores/authStore';
import { useUi } from '@/stores/uiStore';
import { NAV, isActive } from './nav';
import { UserMenu } from './UserMenu';

export function usePendingCount() {
  return useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: requestsApi.pendingCount,
    refetchInterval: 60_000,
    meta: { silent: true },
  }).data ?? 0;
}

export function Sidebar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const pending = usePendingCount();

  const recent = useQuery({
    queryKey: ['activities', 'recent'],
    queryFn: () => activitiesApi.list({ per_page: 6 }),
    meta: { silent: true },
    enabled: !collapsed,
  });

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg transition-[width] duration-300 [transition-timing-function:var(--ease-out)] md:flex',
        collapsed ? 'w-[68px]' : 'w-[232px]',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'justify-between pl-5 pr-3')}>
        {collapsed ? (
          // 收起后开关还在原来的顶部：平时是标志，指上去变成"展开"
          <Tooltip label="展开侧栏" side="right">
            <button
              type="button"
              onClick={toggle}
              aria-label="展开侧栏"
              className="group/open relative flex h-10 w-10 items-center justify-center rounded-xl text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <span className="transition-opacity group-hover/open:opacity-0 group-focus-visible/open:opacity-0">
                <PauseMark size={26} />
              </span>
              <PanelLeftOpen className="absolute h-4 w-4 opacity-0 transition-opacity group-hover/open:opacity-100 group-focus-visible/open:opacity-100" />
            </button>
          </Tooltip>
        ) : (
          <Link href="/" className="flex items-center gap-2.5 text-fg" aria-label="LockCloud 资料库">
            <PauseMark size={26} />
            <Wordmark />
          </Link>
        )}
        {!collapsed && (
          <Tooltip label="收起侧栏" side="bottom">
            <button
              type="button"
              onClick={toggle}
              aria-label="收起侧栏"
              className="rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>

      <nav className={cn('flex flex-col gap-0.5', collapsed ? 'items-center px-2' : 'px-3')} aria-label="主导航">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          const badge = item.href === '/requests' && pending > 0 ? pending : 0;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center rounded-xl text-[14px] transition-colors duration-150',
                collapsed ? 'h-10 w-10 justify-center' : 'h-9 gap-3 px-3',
                active ? 'bg-surface-2 font-medium text-fg' : 'text-fg-soft hover:bg-surface-2/70 hover:text-fg',
              )}
            >
              {active && !collapsed && (
                <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-accent" />
              )}
              <Icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-fg' : 'text-fg-faint group-hover:text-fg-soft')} strokeWidth={1.8} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {badge > 0 && (
                <span
                  className={cn(
                    'tabular flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-medium text-accent-fg',
                    collapsed && 'absolute -right-0.5 -top-0.5',
                  )}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} label={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {!collapsed && (recent.data?.activities.length ?? 0) > 0 && (
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3 thin-scrollbar">
          <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-fg-faint">最近活动</p>
          <ul className="flex flex-col gap-0.5">
            {recent.data!.activities.map((a) => {
              const d = splitDate(a.activity_date);
              return (
                <li key={`${a.activity_date}|${a.activity_type}|${a.activity_name}`}>
                  <Link
                    href={activityHref(a)}
                    className="group flex items-baseline gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-fg-soft transition-colors hover:bg-surface-2/70 hover:text-fg"
                  >
                    <span className="tabular w-9 shrink-0 font-mono text-[11px] text-fg-faint">
                      {d ? `${d.mm}·${d.dd}` : ''}
                    </span>
                    <span className="truncate">{a.activity_name || a.activity_type_display}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(collapsed || !(recent.data?.activities.length ?? 0)) && <div className="flex-1" />}

      <div className={cn('flex items-center gap-1 border-t border-line py-3', collapsed ? 'flex-col px-2' : 'px-3')}>
        <UserMenu compact={collapsed} />
      </div>
    </aside>
  );
}
