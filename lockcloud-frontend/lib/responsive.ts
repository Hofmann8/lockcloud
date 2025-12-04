/**
 * Responsive Design Constants and Types
 * 
 * This module defines breakpoints, device types, and utility functions
 * for responsive design across the LockCloud application.
 * 
 * Breakpoint System (aligned with Tailwind CSS):
 * - Mobile:  < 768px  (default, sm)
 * - Tablet:  768px - 1023px (md)
 * - Desktop: >= 1024px (lg, xl)
 */

/**
 * Breakpoint values in pixels
 * Aligned with Tailwind CSS default breakpoints
 */
export const BREAKPOINTS = {
  /** Extra small screens (475px) - custom breakpoint */
  xs: 475,
  /** Small screens (640px) - Tailwind sm */
  sm: 640,
  /** Medium screens (768px) - Tailwind md - Tablet start */
  md: 768,
  /** Large screens (1024px) - Tailwind lg - Desktop start */
  lg: 1024,
  /** Extra large screens (1280px) - Tailwind xl */
  xl: 1280,
  /** 2XL screens (1536px) - Tailwind 2xl */
  '2xl': 1536,
} as const;

/**
 * Device type classification
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Breakpoint key type
 */
export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Media query strings for each breakpoint
 * Use these with CSS-in-JS or useMediaQuery hook
 */
export const MEDIA_QUERIES = {
  /** Viewport width >= 475px */
  xs: `(min-width: ${BREAKPOINTS.xs}px)`,
  /** Viewport width >= 640px */
  sm: `(min-width: ${BREAKPOINTS.sm}px)`,
  /** Viewport width >= 768px */
  md: `(min-width: ${BREAKPOINTS.md}px)`,
  /** Viewport width >= 1024px */
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  /** Viewport width >= 1280px */
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
  /** Viewport width >= 1536px */
  '2xl': `(min-width: ${BREAKPOINTS['2xl']}px)`,
  
  // Device-specific queries
  /** Mobile devices: viewport width < 768px */
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  /** Tablet devices: viewport width 768px - 1023px */
  tablet: `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  /** Desktop devices: viewport width >= 1024px */
  desktop: `(min-width: ${BREAKPOINTS.lg}px)`,
  
  // Touch and pointer queries
  /** Touch-capable devices */
  touch: '(pointer: coarse)',
  /** Mouse/trackpad devices */
  mouse: '(pointer: fine)',
  /** Devices that support hover */
  hover: '(hover: hover)',
  /** Devices that don't support hover */
  noHover: '(hover: none)',
  
  // Orientation queries
  /** Portrait orientation */
  portrait: '(orientation: portrait)',
  /** Landscape orientation */
  landscape: '(orientation: landscape)',
  
  // Accessibility queries
  /** User prefers reduced motion */
  reducedMotion: '(prefers-reduced-motion: reduce)',
  /** User prefers dark color scheme */
  darkMode: '(prefers-color-scheme: dark)',
  /** User prefers high contrast */
  highContrast: '(prefers-contrast: high)',
} as const;

/**
 * Touch target minimum sizes (in pixels)
 * Based on WCAG 2.1 Level AAA guidelines
 */
export const TOUCH_TARGETS = {
  /** Minimum touch target size (44x44px) - WCAG 2.1 AAA */
  min: 44,
  /** Comfortable touch target size (48x48px) */
  comfortable: 48,
  /** Large touch target size (56x56px) */
  large: 56,
} as const;

/**
 * Mobile-specific spacing values (in rem)
 */
export const MOBILE_SPACING = {
  /** Extra small spacing (6px / 0.375rem) */
  xs: '0.375rem',
  /** Small spacing (10px / 0.625rem) */
  sm: '0.625rem',
  /** Medium spacing (16px / 1rem) */
  md: '1rem',
  /** Large spacing (24px / 1.5rem) */
  lg: '1.5rem',
  /** Extra large spacing (32px / 2rem) */
  xl: '2rem',
} as const;

/**
 * Grid column configurations for different screen sizes
 */
export const GRID_COLUMNS = {
  /** Mobile: 1-2 columns */
  mobile: {
    min: 1,
    max: 2,
    default: 1,
  },
  /** Tablet: 2-3 columns */
  tablet: {
    min: 2,
    max: 3,
    default: 2,
  },
  /** Desktop: 3-4 columns */
  desktop: {
    min: 3,
    max: 4,
    default: 4,
  },
} as const;

/**
 * Responsive grid class string for Tailwind CSS
 * Use this in FileGrid and similar components
 */
export const RESPONSIVE_GRID_CLASSES = 
  'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/**
 * Responsive gap classes for grid layouts
 */
export const RESPONSIVE_GAP_CLASSES = 'gap-3 sm:gap-4 md:gap-5 lg:gap-6';

/**
 * Utility function to get device type from viewport width
 */
export function getDeviceType(viewportWidth: number): DeviceType {
  if (viewportWidth >= BREAKPOINTS.lg) {
    return 'desktop';
  }
  if (viewportWidth >= BREAKPOINTS.md) {
    return 'tablet';
  }
  return 'mobile';
}

/**
 * Utility function to check if viewport matches a breakpoint
 */
export function matchesBreakpoint(
  viewportWidth: number,
  breakpoint: BreakpointKey,
  direction: 'up' | 'down' = 'up'
): boolean {
  const breakpointValue = BREAKPOINTS[breakpoint];
  return direction === 'up' 
    ? viewportWidth >= breakpointValue 
    : viewportWidth < breakpointValue;
}

/**
 * Safe area inset CSS variable names
 * For devices with notches or rounded corners
 */
export const SAFE_AREA_INSETS = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;
