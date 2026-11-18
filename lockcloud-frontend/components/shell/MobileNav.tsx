'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpFromLine, Ellipsis, GalleryVerticalEnd, Info, LogOut, Search, UsersRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sheet } from '@/components/ui/Sheet';
import { Segmented } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme, type Theme } from '@/lib/theme';
import { useAuthStore, useIsAdmin } from '@/stores/authStore';
import { NAV, isActive } from './nav';
import { usePendingCount } from './Sidebar';
import { AboutDialog } from './AboutDialog';

const TABS = [
  { href: '/', label: '资料库', icon: GalleryVerticalEnd },
  { href: '/search', label: '搜索', icon: Search },
  { href: '/upload', label: '上传', icon: ArrowUpFromLine },
  { href: '/people', label: '人物', icon: UsersRound },
];

const MORE = ['/requests', '/trash', '/admin'];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [about, setAbout] = useState(false);
  const isAdmin = useIsAdmin();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { theme, setTheme } = useTheme();
  const pending = usePendingCount();

  // 看片和对比时把底栏让出来
  if (pathname.startsWith('/f/') || pathname.startsWith('/compare')) return null;

  const moreItems = NAV.filter((n) => MORE.includes(n.href) && (!n.adminOnly || isAdmin));
  const moreActive = moreItems.some((n) => isActive(n, pathname));

  return (
    <>
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid h-14 grid-cols-5">
          {TABS.map((t) => {
            const item = NAV.find((n) => n.href === t.href)!;
            const active = isActive(item, pathname);
            const Icon = t.icon;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px]',
                    active ? 'text-fg' : 'text-fg-faint',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.7} />
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              className={cn(
                'relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10.5px]',
                moreActive ? 'text-fg' : 'text-fg-faint',
              )}
            >
              <Ellipsis className="h-5 w-5" strokeWidth={1.7} />
              更多
              {pending > 0 && <span className="absolute right-[calc(50%-14px)] top-2.5 h-2 w-2 rounded-full bg-accent" />}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)}>
        <div className="px-4 pb-6 pt-2">
          {user && (
            <div className="flex items-center gap-3 px-2 py-3">
              <Avatar name={user.name} src={user.avatar_url} seed={user.id} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-fg">{user.name}</p>
                <p className="truncate text-xs text-fg-faint">{user.email}</p>
              </div>
            </div>
          )}
          <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
            {moreItems.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.href} className="border-b border-line last:border-b-0">
                  <Link
                    href={n.href}
                    onClick={() => setMore(false)}
                    className="flex h-12 items-center gap-3 px-4 text-[15px] text-fg active:bg-surface-2"
                  >
                    <Icon className="h-[18px] w-[18px] text-fg-soft" strokeWidth={1.8} />
                    <span className="flex-1">{n.label}</span>
                    {n.href === '/requests' && pending > 0 && (
                      <span className="tabular rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{pending}</span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => {
                  setMore(false);
                  setAbout(true);
                }}
                className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-fg active:bg-surface-2"
              >
                <Info className="h-[18px] w-[18px] text-fg-soft" strokeWidth={1.8} />
                <span className="flex-1">关于 LockCloud</span>
              </button>
            </li>
          </ul>
          <div className="mt-5 flex items-center justify-between px-2">
            <span className="text-[13px] text-fg-soft">外观</span>
            <Segmented<Theme>
              size="sm"
              value={theme}
              onChange={(v) => setTheme(v)}
              options={[
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
                { value: 'system', label: '自动' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              signOut();
              router.replace('/auth/login');
            }}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[15px] text-danger active:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </Sheet>
      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </>
  );
}
