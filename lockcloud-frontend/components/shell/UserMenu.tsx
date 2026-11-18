'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown, Info, Keyboard, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { MenuItem, MenuSeparator, Popover } from '@/components/ui/Popover';
import { Segmented } from '@/components/ui/Field';
import { useTheme, type Theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { ShortcutsDialog } from './ShortcutsDialog';
import { AboutDialog } from './AboutDialog';

const AUTH_URL = 'https://auth.funk-and.love';

export function UserMenu({ compact = false, placement }: { compact?: boolean; placement?: 'top-start' | 'right-start' }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { theme, setTheme } = useTheme();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [about, setAbout] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="账号和设置"
        className={cn(
          'flex min-w-0 items-center rounded-xl transition-colors hover:bg-surface-2',
          compact ? 'p-1.5' : 'flex-1 gap-2.5 px-2 py-1.5',
          open && 'bg-surface-2',
        )}
      >
        <Avatar name={user.name} src={user.avatar_url} seed={user.id} size={28} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-fg">{user.name}</span>
              <span className="block truncate text-[11px] text-fg-faint">{user.is_admin ? '管理员' : user.email}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
          </>
        )}
      </button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchor={anchor}
        placement={placement ?? (compact ? 'right-start' : 'top-start')}
        className="w-64"
      >
        <div className="px-2.5 pb-2 pt-1.5">
          <p className="text-[11px] font-medium tracking-wide text-fg-faint">外观</p>
          <Segmented<Theme>
            className="mt-2 w-full"
            size="sm"
            value={theme}
            onChange={(v) => {
              const r = anchor.current?.getBoundingClientRect();
              setTheme(v, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined);
            }}
            aria-label="外观"
            options={[
              { value: 'light', label: '浅色', icon: <Sun className="h-3.5 w-3.5" /> },
              { value: 'dark', label: '深色', icon: <Moon className="h-3.5 w-3.5" /> },
              { value: 'system', label: '自动', icon: <Monitor className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
        <MenuSeparator />
        <MenuItem
          icon={<Keyboard className="h-4 w-4" />}
          label="快捷键"
          hint="?"
          onSelect={() => {
            setOpen(false);
            setShortcuts(true);
          }}
        />
        <MenuItem
          icon={<UserRound className="h-4 w-4" />}
          label="账号与头像"
          description="在账号中心管理"
          onSelect={() => window.open(AUTH_URL, '_blank', 'noopener')}
        />
        <MenuItem
          icon={<Info className="h-4 w-4" />}
          label="关于 LockCloud"
          onSelect={() => {
            setOpen(false);
            setAbout(true);
          }}
        />
        <MenuSeparator />
        <MenuItem
          icon={<LogOut className="h-4 w-4" />}
          label="退出登录"
          onSelect={() => {
            setOpen(false);
            signOut();
            router.replace('/auth/login');
          }}
        />
      </Popover>
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </>
  );
}
