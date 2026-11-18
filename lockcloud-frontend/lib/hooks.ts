'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** 这个元素跟着谁滚：桌面是内容区（Shell 里的 data-scroll-root），手机是整页（null） */
export function scrollRootOf(el: Element): Element | null {
  const root = el.closest('[data-scroll-root]');
  return root && getComputedStyle(root).overflowY !== 'visible' ? root : null;
}

/** 滚到底部附近时回调（无限滚动） */
export function useLoadMore(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onReach);
  useEffect(() => {
    cb.current = onReach;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) cb.current();
      },
      // 提前量是相对滚动容器算的：不指明容器的话，容器外面的部分一律算看不见，提前量就没了
      { root: scrollRootOf(el), rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** 筛选条件放在地址栏里，可以分享、可以后退 */
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, { push = false } = {}) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, router, pathname],
  );

  return [params, set] as const;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatch(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return match;
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
