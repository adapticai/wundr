'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

import {
  measureWebVitals,
  getPerformanceRating,
  prefersReducedMotion,
  prefersReducedData,
  getConnectionInfo,
  isUnderMemoryPressure,
  requestIdleCallbackPolyfill,
  cancelIdleCallbackPolyfill,
  createLazyObserver,
} from '@/lib/performance';

import type { CoreWebVitals } from '@genesis/core';

/** Hook for measuring component render performance */
export function useRenderMetrics(_componentName: string) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastRenderStart = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - lastRenderStart.current;
    renderCount.current++;
    renderTimes.current.push(renderTime);

    // Keep only last 100 renders
    if (renderTimes.current.length > 100) {
      renderTimes.current.shift();
    }
  });

  // Reset timer before each render
  lastRenderStart.current = performance.now();

  return {
    renderCount: renderCount.current,
    avgRenderTime: renderTimes.current.length > 0
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
      : 0,
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] ?? 0,
  };
}

/** Hook for Core Web Vitals */
export function useWebVitals() {
  const [vitals, setVitals] = useState<Partial<CoreWebVitals>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    measureWebVitals().then((measured) => {
      if (mounted) {
        setVitals(measured);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const getRating = useCallback((metric: keyof CoreWebVitals) => {
    const value = vitals[metric];
    if (value === undefined || value === null) {
return null;
}
    return getPerformanceRating(metric, value);
  }, [vitals]);

  return { vitals, loading, getRating };
}

/** Hook for connection-aware rendering */
export function useConnectionAware() {
  const [connection, setConnection] = useState(getConnectionInfo);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedData, setReducedData] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    setReducedData(prefersReducedData());

    // Listen for changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    // Listen for connection changes
    const nav = navigator as Navigator & {
      connection?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    };

    const handleConnectionChange = () => {
      setConnection(getConnectionInfo());
      setReducedData(prefersReducedData());
    };

    nav.connection?.addEventListener('change', handleConnectionChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      nav.connection?.removeEventListener('change', handleConnectionChange);
    };
  }, []);

  return {
    ...connection,
    reducedMotion,
    reducedData,
    isSlowConnection: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g',
    isFastConnection: connection.effectiveType === '4g',
  };
}

/** Hook for lazy loading with Intersection Observer */
export function useLazyLoad<T extends HTMLElement>(
  onVisible: () => void,
  options: IntersectionObserverInit = {},
) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isVisible) {
return;
}

    const observer = createLazyObserver(
      () => {
        setIsVisible(true);
        onVisible();
      },
      options,
    );

    if (observer) {
      observer.observe(element);
      return () => observer.disconnect();
    } else {
      // Fallback for browsers without IntersectionObserver
      setIsVisible(true);
      onVisible();
    }
  }, [onVisible, options, isVisible]);

  return { ref, isVisible };
}

/** Hook for deferred loading */
export function useDeferredLoad<T>(
  loader: () => Promise<T>,
  options: { delay?: number; onIdle?: boolean } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const result = await loader();
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    if (options.onIdle) {
      const handle = requestIdleCallbackPolyfill(() => {
        load();
      }, { timeout: options.delay ?? 2000 });

      return () => {
        mounted = false;
        cancelIdleCallbackPolyfill(handle);
      };
    } else if (options.delay) {
      const timeout = setTimeout(load, options.delay);
      return () => {
        mounted = false;
        clearTimeout(timeout);
      };
    } else {
      load();
      return () => {
        mounted = false;
      };
    }
  }, [loader, options.delay, options.onIdle]);

  return { data, loading, error };
}

/** Hook for memory-aware rendering */
export function useMemoryAware(threshold = 0.9) {
  const [underPressure, setUnderPressure] = useState(false);

  useEffect(() => {
    const checkMemory = () => {
      setUnderPressure(isUnderMemoryPressure(threshold));
    };

    checkMemory();

    // Check periodically
    const interval = setInterval(checkMemory, 10000);
    return () => clearInterval(interval);
  }, [threshold]);

  return underPressure;
}

/** Hook for performance marks */
export function usePerformanceMark(name: string) {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  useEffect(() => {
    performance.mark(startMark);

    return () => {
      performance.mark(endMark);
      try {
        performance.measure(name, startMark, endMark);
      } catch {
        // Marks may have been cleared
      }
    };
  }, [name, startMark, endMark]);
}

/** Hook for debounced value */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

/** Hook for throttled callback */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): T {
  const lastCall = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = delay - (now - lastCall.current);

      if (remaining <= 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }
        lastCall.current = now;
        callback(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCall.current = Date.now();
          timeoutRef.current = undefined;
          callback(...args);
        }, remaining);
      }
    }) as T,
    [callback, delay],
  );
}

/** Hook for virtualized list data */
export function useVirtualizedData<T>(
  items: T[],
  options: {
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
  },
) {
  const [scrollTop, setScrollTop] = useState(0);
  const { itemHeight, containerHeight, overscan = 3 } = options;

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({
    item,
    index: startIndex + index,
    style: {
      position: 'absolute' as const,
      top: (startIndex + index) * itemHeight,
      height: itemHeight,
      left: 0,
      right: 0,
    },
  }));

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    startIndex,
    endIndex,
  };
}
