'use client';

import { useState, useEffect } from 'react';

/**
 * Media query breakpoints matching Tailwind CSS defaults
 */
export const BREAKPOINTS = {
  sm: 640,   // Mobile
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Large desktop
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Custom hook to detect media query matches
 * Used for responsive design decisions at runtime
 *
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the media query matches
 *
 * @example
 * const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`);
 * const isTablet = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg}px)`);
 * const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Define listener
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Add listener (use addListener for older browsers)
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    } else {
      mediaQuery.addEventListener('change', handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      } else {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook to check if viewport is mobile (below sm breakpoint)
 * @returns boolean true if viewport is mobile
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`);
}

/**
 * Hook to check if viewport is tablet (between sm and lg)
 * @returns boolean true if viewport is tablet
 */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
}

/**
 * Hook to check if viewport is desktop (at or above lg breakpoint)
 * @returns boolean true if viewport is desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

/**
 * Hook to get current breakpoint
 * @returns current breakpoint name or null if no breakpoint matches
 */
export function useBreakpoint(): Breakpoint | null {
  const [breakpoint, setBreakpoint] = useState<Breakpoint | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      if (width >= BREAKPOINTS.xl) {
        setBreakpoint('xl');
      } else if (width >= BREAKPOINTS.lg) {
        setBreakpoint('lg');
      } else if (width >= BREAKPOINTS.md) {
        setBreakpoint('md');
      } else if (width >= BREAKPOINTS.sm) {
        setBreakpoint('sm');
      } else {
        setBreakpoint(null);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if device supports touch
 * @returns boolean true if device supports touch
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(hover: none)').matches ||
        window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0);

    setIsTouch(isTouch);
  }, []);

  return isTouch;
}

/**
 * Hook to detect device orientation
 * @returns 'portrait' or 'landscape' or null
 */
export function useOrientation(): 'portrait' | 'landscape' | null {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | null>(null);

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.matchMedia('(orientation: portrait)').matches
          ? 'portrait'
          : 'landscape'
      );
    };

    handleOrientationChange();
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  return orientation;
}
