import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for responsive media query detection
 * Provides SSR-safe media query matching with automatic updates on resize
 * 
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with false for SSR safety
  const [matches, setMatches] = useState(false);

  const handleChange = useCallback((event: MediaQueryListEvent | MediaQueryList) => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQueryList.matches);

    // Modern browsers support addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
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
