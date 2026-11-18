'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PageLoader } from '@/components/brand/PauseMark';
import { isTyping } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { useUi } from '@/stores/uiStore';
import { HeaderSlot } from './PageHeader';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { UploadDock } from '@/components/upload/UploadDock';

/** 当前这条历史记录。后退、前进回到同一条时值不变。 */
function entryKey(): string {
  const nav = (window as unknown as { navigation?: { currentEntry?: { key?: string } | null } }).navigation;
  return nav?.currentEntry?.key ?? window.location.pathname + window.location.search;
}

/**
 * 桌面上滚动的是 <main> 而不是整页，浏览器不会替它记滚动位置：后退、前进时自己恢复。
 * 换到新页面时滚回顶部（Next 只管整页的滚动）。
 */
function useScrollMemory(ref: RefObject<HTMLElement | null>, pathname: string) {
  const saved = useRef(new Map<string, number>());
  const pending = useRef<number | null>(null);
  const shown = useRef(pathname);
  const frame = useRef(0);

  // 内容可能晚一两帧才撑到原来的高度：一直设到位置稳住，用户自己一滚就放手
  const restore = useRef(() => {});
  useEffect(() => {
    restore.current = () => {
      const el = ref.current;
      const target = pending.current;
      if (!el || target === null) return;
      cancelAnimationFrame(frame.current);
      const deadline = performance.now() + 1500;
      let heldSince = 0;
      const step = () => {
        if (pending.current !== target) return;
        const now = performance.now();
        if (Math.abs(el.scrollTop - target) > 1) {
          el.scrollTop = target;
          heldSince = 0;
        } else if (!heldSince) heldSince = now;
        if ((heldSince && now - heldSince > 150) || now > deadline) {
          pending.current = null;
          saved.current.set(entryKey(), el.scrollTop);
          return;
        }
        frame.current = requestAnimationFrame(step);
      };
      step();
    };
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const positions = saved.current;
    const onScroll = () => {
      if (pending.current === null) positions.set(entryKey(), el.scrollTop);
    };
    const onPop = () => {
      pending.current = positions.get(entryKey()) ?? null;
      // 同一个页面里的后退（关掉大图）不会换页，直接恢复；换页的等新页面出来再恢复
      if (window.location.pathname === shown.current) restore.current();
    };
    const release = () => {
      pending.current = null;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', release, { passive: true });
    el.addEventListener('touchmove', release, { passive: true });
    el.addEventListener('pointerdown', release);
    window.addEventListener('keydown', release);
    window.addEventListener('popstate', onPop);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', release);
      el.removeEventListener('touchmove', release);
      el.removeEventListener('pointerdown', release);
      window.removeEventListener('keydown', release);
      window.removeEventListener('popstate', onPop);
      cancelAnimationFrame(frame.current);
    };
  }, [ref]);

  useLayoutEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    if (pending.current === null) {
      if (ref.current) ref.current.scrollTop = 0;
    } else restore.current();
  }, [ref, pathname]);
}

/**
 * 内容区。md 以上顶栏固定在上面，下面的内容自己滚动：滚动条从顶栏下面开始、只占内容这一块，
 * 弹窗锁住整页时也不会消失、布局不跳。手机上还是整页滚动（顶栏吸顶），地址栏收起、下拉这些系统行为才正常。
 * 页面里的 <PageHeader> 会被放进顶栏的位置（见 PageHeader）。
 */
function Main({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const pathname = usePathname();
  useScrollMemory(ref, pathname);

  // 没有别的东西拿着焦点时交给内容区，空格、PageDown 才滚得动它
  useEffect(() => {
    if (document.activeElement === document.body) ref.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <main className="flex min-w-0 flex-1 flex-col md:h-dvh">
      <div ref={setSlot} className="sticky top-0 z-30 shrink-0 md:static" />
      <div
        ref={ref}
        data-scroll-root
        tabIndex={-1}
        className="min-h-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+3.5rem)] outline-none thin-scrollbar md:overflow-y-auto md:pb-0"
      >
        <HeaderSlot.Provider value={slot}>{children}</HeaderSlot.Provider>
      </div>
    </main>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const ready = useAuthStore((s) => s.ready);
  const token = useAuthStore((s) => s.token);
  const initialize = useAuthStore((s) => s.initialize);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (ready && !token) {
      const next = window.location.pathname + window.location.search;
      router.replace(next === '/' ? '/auth/login' : `/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, token, router]);

  // 全局快捷键：⌘K 命令面板、/ 搜索、U 上传、G L / G P 跳转
  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUi.getState().paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // 正在看文件（大图、播放器、对比）时这些键留给它们，不然看着视频按一下就跳走了
      if (pathname.startsWith('/f/') || pathname.startsWith('/compare') || pathname.startsWith('/lab') || pathname.startsWith('/beats') || new URLSearchParams(window.location.search).has('f')) {
        g = 0;
        return;
      }
      const k = e.key.toLowerCase();
      if (Date.now() - g < 900) {
        g = 0;
        if (k === 'l') router.push('/');
        if (k === 'p') router.push('/people');
        if (k === 's') router.push('/search');
        return;
      }
      if (k === 'g') g = Date.now();
      else if (e.key === '/' && !pathname.startsWith('/search')) {
        e.preventDefault();
        router.push('/search');
      } else if (k === 'u') router.push('/upload');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, pathname, setPaletteOpen]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-dvh">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh md:h-dvh md:overflow-hidden">
      <Sidebar />
      <Main>{children}</Main>
      <MobileNav />
      <UploadDock />
      <CommandPalette />
    </div>
  );
}
