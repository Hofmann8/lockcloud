import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for responsive media query detection
 * Provides SSR-safe media query matching with automatic updates on resize
 * 
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // 关键:lazy initializer 让 client 端首次 render 就拿到真实值。
  // 之前写 useState(false) 会让 desktop 被当成 mobile 一帧,
  // 进而让 ImagePreview 先请求 previewmobile(w=800),
  // 等 useEffect 翻 desktop 后再请求 previewdesktop(w=1920),
  // 谁先回来就显示谁——这就是"图片有时糊有时清,左右还带黑边"那个 bug。
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  const handleChange = useCallback((event: MediaQueryListEvent | MediaQueryList) => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    // 同步一次,覆盖 query 字符串变化或 SSR→client 切换的边角情况
    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    } else {
      mediaQueryList.addListener(handleChange);
      return () => mediaQueryList.removeListener(handleChange);
    }
  }, [query, handleChange]);

  return matches;
}

/**
 * Predefined breakpoint hooks for common responsive scenarios
 * Based on Tailwind CSS breakpoints
 */

/** Returns true when viewport width >= 640px (sm breakpoint) */
export function useIsSmallScreen(): boolean {
  return useMediaQuery('(min-width: 640px)');
}

/** Returns true when viewport width >= 768px (md breakpoint) */
export function useIsMediumScreen(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/** Returns true when viewport width >= 1024px (lg breakpoint) */
export function useIsLargeScreen(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** Returns true when viewport width >= 1280px (xl breakpoint) */
export function useIsExtraLargeScreen(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}

/** Returns true when viewport width < 768px (mobile devices) */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)');
}

/** Returns true when viewport width is between 768px and 1023px (tablet devices) */
export function useIsTablet(): boolean {
  const isAtLeastMedium = useMediaQuery('(min-width: 768px)');
  const isLessThanLarge = !useMediaQuery('(min-width: 1024px)');
  return isAtLeastMedium && isLessThanLarge;
}

/** Returns true when viewport width >= 1024px (desktop devices) */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export default useMediaQuery;
