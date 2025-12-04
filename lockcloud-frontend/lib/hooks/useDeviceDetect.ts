import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { BREAKPOINTS, DeviceType } from '../responsive';

/**
 * Device context interface providing comprehensive device information
 */
export interface DeviceContext {
  /** True if viewport width < 768px */
  isMobile: boolean;
  /** True if viewport width is between 768px and 1023px */
  isTablet: boolean;
  /** True if viewport width >= 1024px */
  isDesktop: boolean;
  /** True if device supports touch events */
  isTouchDevice: boolean;
  /** Current viewport width in pixels */
  viewportWidth: number;
  /** Current viewport height in pixels */
  viewportHeight: number;
  /** Current device type classification */
  deviceType: DeviceType;
  /** True if device is in portrait orientation */
  isPortrait: boolean;
  /** True if device is in landscape orientation */
  isLandscape: boolean;
}

/**
 * Custom hook for comprehensive device detection
 * Provides device type, touch capability, and viewport dimensions
 * 
 * @returns DeviceContext object with device information
 */
export function useDeviceDetect(): DeviceContext {
  // Use media queries for responsive breakpoints
  const isMediumScreen = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isLargeScreen = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const isPortraitQuery = useMediaQuery('(orientation: portrait)');
  
  // Viewport dimensions state
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Initialize and update viewport dimensions
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateDimensions = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    // Detect touch capability
    const detectTouch = () => {
      const hasTouch = 
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE-specific
        navigator.msMaxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(hasTouch);
    };

    // Initial detection
    updateDimensions();
    detectTouch();

    // Listen for resize events
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Derive device type from breakpoints
  const isMobile = !isMediumScreen;
  const isTablet = isMediumScreen && !isLargeScreen;
  const isDesktop = isLargeScreen;

  // Determine device type classification
  const deviceType: DeviceType = useMemo(() => {
    if (isDesktop) return 'desktop';
    if (isTablet) return 'tablet';
    return 'mobile';
  }, [isDesktop, isTablet]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    viewportWidth,
    viewportHeight,
    deviceType,
    isPortrait: isPortraitQuery,
    isLandscape: !isPortraitQuery,
  };
}

/**
 * Hook to detect if the device prefers reduced motion
 * Useful for accessibility-conscious animations
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to detect if the device prefers dark color scheme
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook to detect if the device has coarse pointer (touch)
 */
export function useHasCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Hook to detect if the device has fine pointer (mouse)
 */
export function useHasFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}

export default useDeviceDetect;
