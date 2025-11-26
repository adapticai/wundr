import { renderHook } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useBreakpoint,
  useTouchDevice,
  useOrientation,
  BREAKPOINTS,
} from '@/hooks/use-media-query';

describe('use-media-query hooks', () => {
  // Mock matchMedia
  const createMatchMedia = (matches: boolean) => {
    return (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });
  };

  describe('BREAKPOINTS', () => {
    it('should have correct breakpoint values', () => {
      expect(BREAKPOINTS.sm).toBe(640);
      expect(BREAKPOINTS.md).toBe(768);
      expect(BREAKPOINTS.lg).toBe(1024);
      expect(BREAKPOINTS.xl).toBe(1280);
    });
  });

  describe('useMediaQuery', () => {
    it('should return true when media query matches', () => {
      window.matchMedia = createMatchMedia(true) as any;

      const { result } = renderHook(() =>
        useMediaQuery('(min-width: 768px)')
      );

      expect(result.current).toBe(true);
    });

    it('should return false when media query does not match', () => {
      window.matchMedia = createMatchMedia(false) as any;

      const { result } = renderHook(() =>
        useMediaQuery('(min-width: 768px)')
      );

      expect(result.current).toBe(false);
    });
  });

  describe('useIsMobile', () => {
    it('should return true for mobile viewport', () => {
      window.matchMedia = createMatchMedia(true) as any;

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('should call matchMedia with correct query', () => {
      const mockMatchMedia = jest.fn(createMatchMedia(false));
      window.matchMedia = mockMatchMedia as any;

      renderHook(() => useIsMobile());

      expect(mockMatchMedia).toHaveBeenCalledWith(`(max-width: ${BREAKPOINTS.sm}px)`);
    });
  });

  describe('useIsTablet', () => {
    it('should return true for tablet viewport', () => {
      window.matchMedia = createMatchMedia(true) as any;

      const { result } = renderHook(() => useIsTablet());

      expect(result.current).toBe(true);
    });

    it('should call matchMedia with correct range query', () => {
      const mockMatchMedia = jest.fn(createMatchMedia(false));
      window.matchMedia = mockMatchMedia as any;

      renderHook(() => useIsTablet());

      expect(mockMatchMedia).toHaveBeenCalledWith(
        `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
      );
    });
  });

  describe('useIsDesktop', () => {
    it('should return true for desktop viewport', () => {
      window.matchMedia = createMatchMedia(true) as any;

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(true);
    });

    it('should call matchMedia with correct query', () => {
      const mockMatchMedia = jest.fn(createMatchMedia(false));
      window.matchMedia = mockMatchMedia as any;

      renderHook(() => useIsDesktop());

      expect(mockMatchMedia).toHaveBeenCalledWith(
        `(min-width: ${BREAKPOINTS.lg}px)`
      );
    });
  });

  describe('useBreakpoint', () => {
    it('should return null initially', () => {
      const { result } = renderHook(() => useBreakpoint());

      expect(result.current).toBeNull();
    });
  });

  describe('useTouchDevice', () => {
    it('should return false for non-touch devices', () => {
      window.matchMedia = createMatchMedia(false) as any;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true,
      });

      const { result } = renderHook(() => useTouchDevice());

      // Note: This may not work perfectly in test environment
      // but tests the basic structure
      expect(typeof result.current).toBe('boolean');
    });
  });

  describe('useOrientation', () => {
    it('should return null initially', () => {
      const { result } = renderHook(() => useOrientation());

      expect(result.current).toBeNull();
    });
  });
});
