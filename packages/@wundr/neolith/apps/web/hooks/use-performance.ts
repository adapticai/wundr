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
  type CoreWebVitals as LibCoreWebVitals,
  type PerformanceRating as LibPerformanceRating,
} from '@/lib/performance';

// Re-export the CoreWebVitals type for backwards compatibility
export type { LibCoreWebVitals as CoreWebVitals };

/**
 * Performance rating classification (extended to include null for loading state)
 */
export type PerformanceRating = LibPerformanceRating | null;

/**
 * Render metrics return type
 */
export interface RenderMetrics {
  /** Total number of renders */
  renderCount: number;
  /** Average render time in milliseconds */
  avgRenderTime: number;
  /** Most recent render time in milliseconds */
  lastRenderTime: number;
}

/**
 * Web Vitals hook return type
 */
export interface UseWebVitalsReturn {
  /** Current web vitals measurements */
  vitals: Partial<LibCoreWebVitals>;
  /** Whether vitals are still loading */
  loading: boolean;
  /** Get performance rating for a specific metric */
  getRating: (metric: keyof LibCoreWebVitals) => PerformanceRating;
}

/**
 * Connection type for network information
 */
export type EffectiveConnectionType =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | string
  | undefined;

/**
 * Connection information
 */
export interface ConnectionInfo {
  /** Effective connection type */
  effectiveType?: EffectiveConnectionType;
  /** Estimated downlink speed in Mbps */
  downlink?: number;
  /** Round-trip time in milliseconds */
  rtt?: number;
  /** Whether data saver is enabled */
  saveData?: boolean;
}

/**
 * Connection-aware hook return type
 */
export interface UseConnectionAwareReturn extends ConnectionInfo {
  /** Whether user prefers reduced motion */
  reducedMotion: boolean;
  /** Whether user prefers reduced data */
  reducedData: boolean;
  /** Whether connection is slow (2g or slower) */
  isSlowConnection: boolean;
  /** Whether connection is fast (4g) */
  isFastConnection: boolean;
}

/**
 * Lazy load hook return type
 */
export interface UseLazyLoadReturn<T extends HTMLElement> {
  /** Ref to attach to the target element */
  ref: React.RefObject<T>;
  /** Whether the element is currently visible */
  isVisible: boolean;
}

/**
 * Deferred load hook return type
 */
export interface UseDeferredLoadReturn<T> {
  /** Loaded data or null */
  data: T | null;
  /** Whether data is loading */
  loading: boolean;
  /** Error if loading failed */
  error: Error | null;
}

/**
 * Virtualized item with positioning
 */
export interface VirtualizedItem<T> {
  /** The item data */
  item: T;
  /** Index in the original array */
  index: number;
  /** CSS positioning style */
  style: {
    position: 'absolute';
    top: number;
    height: number;
    left: number;
    right: number;
  };
}

/**
 * Virtualized data hook return type
 */
export interface UseVirtualizedDataReturn<T> {
  /** Currently visible items with positioning */
  visibleItems: VirtualizedItem<T>[];
  /** Total height of all items */
  totalHeight: number;
  /** Scroll event handler */
  handleScroll: (e: React.UIEvent<HTMLElement>) => void;
  /** First visible item index */
  startIndex: number;
  /** Last visible item index */
  endIndex: number;
}

// =============================================================================
// useRenderMetrics Hook
// =============================================================================

/**
 * Hook for measuring component render performance
 *
 * Tracks render count and timing to help identify performance issues.
 *
 * @param _componentName - Name of the component (for logging/debugging)
 * @returns Render metrics including count and timing
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { renderCount, avgRenderTime } = useRenderMetrics('MyComponent');
 *
 *   console.log(`Rendered ${renderCount} times, avg ${avgRenderTime}ms`);
 *
 *   return <div>Content</div>;
 * }
 * ```
 */
export function useRenderMetrics(_componentName: string): RenderMetrics {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastRenderStart = useRef(
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  );

  useEffect(() => {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const renderTime = now - lastRenderStart.current;
    renderCount.current++;
    renderTimes.current.push(renderTime);

    // Keep only last 100 renders
    if (renderTimes.current.length > 100) {
      renderTimes.current.shift();
    }
  });

  // Reset timer before each render
  lastRenderStart.current =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    renderCount: renderCount.current,
    avgRenderTime:
      renderTimes.current.length > 0
        ? renderTimes.current.reduce((a, b) => a + b, 0) /
          renderTimes.current.length
        : 0,
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] ?? 0,
  };
}

// =============================================================================
// useWebVitals Hook
// =============================================================================

/**
 * Hook for Core Web Vitals measurement
 *
 * Measures and provides access to Core Web Vitals metrics (LCP, FID, CLS, etc.)
 * with performance rating classifications.
 *
 * @returns Web vitals data and rating function
 *
 * @example
 * ```tsx
 * function PerformanceMonitor() {
 *   const { vitals, loading, getRating } = useWebVitals();
 *
 *   if (loading) return <div>Measuring...</div>;
 *
 *   return (
 *     <div>
 *       <p>LCP: {vitals.LCP}ms ({getRating('LCP')})</p>
 *       <p>FID: {vitals.FID}ms ({getRating('FID')})</p>
 *       <p>CLS: {vitals.CLS} ({getRating('CLS')})</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebVitals(): UseWebVitalsReturn {
  const [vitals, setVitals] = useState<Partial<LibCoreWebVitals>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    measureWebVitals().then((measured: Partial<LibCoreWebVitals>) => {
      if (mounted) {
        setVitals(measured);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const getRating = useCallback(
    (metric: keyof LibCoreWebVitals): PerformanceRating => {
      const value = vitals[metric];
      if (value === undefined || value === null) {
        return null;
      }
      return getPerformanceRating(metric, value) as PerformanceRating;
    },
    [vitals]
  );

  return { vitals, loading, getRating };
}

// =============================================================================
// useConnectionAware Hook
// =============================================================================

/**
 * Hook for connection-aware rendering
 *
 * Provides information about network conditions and user preferences
 * to enable adaptive rendering strategies.
 *
 * @returns Connection information and user preferences
 *
 * @example
 * ```tsx
 * function AdaptiveImage({ src }: { src: string }) {
 *   const { isSlowConnection, reducedData } = useConnectionAware();
 *
 *   if (isSlowConnection || reducedData) {
 *     return <img src={`${src}?quality=low`} />;
 *   }
 *
 *   return <img src={src} />;
 * }
 * ```
 */
export function useConnectionAware(): UseConnectionAwareReturn {
  const [connection, setConnection] = useState<ConnectionInfo>(
    () => getConnectionInfo() as ConnectionInfo
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedData, setReducedData] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    setReducedData(prefersReducedData());

    // Listen for changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) =>
      setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    // Listen for connection changes
    const nav = navigator as Navigator & {
      connection?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    };

    const handleConnectionChange = () => {
      setConnection(getConnectionInfo() as ConnectionInfo);
      setReducedData(prefersReducedData());
    };

    nav.connection?.addEventListener('change', handleConnectionChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      nav.connection?.removeEventListener('change', handleConnectionChange);
    };
  }, []);

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData ?? false,
    reducedMotion,
    reducedData,
    isSlowConnection:
      connection.effectiveType === 'slow-2g' ||
      connection.effectiveType === '2g',
    isFastConnection: connection.effectiveType === '4g',
  };
}

// =============================================================================
// useLazyLoad Hook
// =============================================================================

/**
 * Hook for lazy loading with Intersection Observer
 *
 * Triggers a callback when an element becomes visible in the viewport.
 *
 * @param onVisible - Callback to execute when element is visible
 * @param options - IntersectionObserver options
 * @returns Ref and visibility state
 *
 * @example
 * ```tsx
 * function LazyImage({ src }: { src: string }) {
 *   const [loaded, setLoaded] = useState(false);
 *   const { ref, isVisible } = useLazyLoad<HTMLDivElement>(
 *     () => setLoaded(true)
 *   );
 *
 *   return (
 *     <div ref={ref}>
 *       {isVisible && <img src={src} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyLoad<T extends HTMLElement>(
  onVisible: () => void,
  options: IntersectionObserverInit = {}
): UseLazyLoadReturn<T> {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const onVisibleRef = useRef(onVisible);

  // Keep callback ref up to date
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const element = ref.current;
    if (!element || isVisible) {
      return;
    }

    const observer = createLazyObserver(() => {
      setIsVisible(true);
      onVisibleRef.current();
    }, options);

    if (observer) {
      observer.observe(element);
      return () => observer.disconnect();
    } else {
      // Fallback for browsers without IntersectionObserver
      setIsVisible(true);
      onVisibleRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, options.root, options.rootMargin, options.threshold]);

  return { ref, isVisible };
}

// =============================================================================
// useDeferredLoad Hook
// =============================================================================

/**
 * Options for deferred loading
 */
export interface UseDeferredLoadOptions {
  /** Delay in milliseconds before loading */
  delay?: number;
  /** Whether to load during browser idle time */
  onIdle?: boolean;
}

/**
 * Hook for deferred loading
 *
 * Loads data after a delay or during browser idle time to prioritize
 * critical rendering.
 *
 * @param loader - Async function that returns data
 * @param options - Loading options
 * @returns Loaded data and loading state
 *
 * @example
 * ```tsx
 * function DeferredComponent() {
 *   const { data, loading } = useDeferredLoad(
 *     () => fetch('/api/data').then(r => r.json()),
 *     { onIdle: true }
 *   );
 *
 *   if (loading) return <Skeleton />;
 *   return <Content data={data} />;
 * }
 * ```
 */
export function useDeferredLoad<T>(
  loader: () => Promise<T>,
  options: UseDeferredLoadOptions = {}
): UseDeferredLoadReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);

  // Keep loader ref up to date
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    const load = async () => {
      try {
        const result = await loaderRef.current();
        if (mounted && !abortController.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (mounted && !abortController.signal.aborted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    if (options.onIdle) {
      const handle = requestIdleCallbackPolyfill(
        () => {
          if (!abortController.signal.aborted) {
            load();
          }
        },
        { timeout: options.delay ?? 2000 }
      );

      return () => {
        mounted = false;
        abortController.abort();
        cancelIdleCallbackPolyfill(handle);
      };
    } else if (options.delay) {
      const timeout = setTimeout(() => {
        if (!abortController.signal.aborted) {
          load();
        }
      }, options.delay);
      return () => {
        mounted = false;
        abortController.abort();
        clearTimeout(timeout);
      };
    } else {
      load();
      return () => {
        mounted = false;
        abortController.abort();
      };
    }
  }, [options.delay, options.onIdle]);

  return { data, loading, error };
}

// =============================================================================
// useMemoryAware Hook
// =============================================================================

/**
 * Hook for memory-aware rendering
 *
 * Monitors memory usage and provides a flag when the system is under
 * memory pressure, allowing components to reduce memory consumption.
 *
 * @param threshold - Memory usage threshold (0-1) to trigger pressure state
 * @returns Whether the system is under memory pressure
 *
 * @example
 * ```tsx
 * function ImageGallery({ images }: { images: string[] }) {
 *   const underPressure = useMemoryAware(0.8);
 *
 *   // Load fewer images when under memory pressure
 *   const displayImages = underPressure ? images.slice(0, 10) : images;
 *
 *   return <Gallery images={displayImages} />;
 * }
 * ```
 */
export function useMemoryAware(threshold = 0.9): boolean {
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

// =============================================================================
// usePerformanceMark Hook
// =============================================================================

/**
 * Hook for performance marks
 *
 * Creates performance marks and measures for a component's lifecycle,
 * useful for profiling and debugging performance.
 *
 * @param name - Name for the performance mark
 *
 * @example
 * ```tsx
 * function ExpensiveComponent() {
 *   usePerformanceMark('ExpensiveComponent');
 *
 *   // Component renders...
 *   return <div>...</div>;
 * }
 *
 * // Check marks in DevTools Performance panel or:
 * // performance.getEntriesByName('ExpensiveComponent')
 * ```
 */
export function usePerformanceMark(name: string): void {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  useEffect(() => {
    if (typeof performance === 'undefined' || !performance.mark) {
      return;
    }

    performance.mark(startMark);

    return () => {
      if (typeof performance === 'undefined' || !performance.mark) {
        return;
      }

      performance.mark(endMark);
      try {
        performance.measure(name, startMark, endMark);
      } catch {
        // Marks may have been cleared
      }
    };
  }, [name, startMark, endMark]);
}

// =============================================================================
// useDebouncedValue Hook
// =============================================================================

/**
 * Hook for debounced value
 *
 * Returns a debounced version of the input value that only updates
 * after the specified delay has passed without changes.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebouncedValue(search, 300);
 *
 *   useEffect(() => {
 *     if (debouncedSearch) {
 *       performSearch(debouncedSearch);
 *     }
 *   }, [debouncedSearch]);
 *
 *   return <input value={search} onChange={e => setSearch(e.target.value)} />;
 * }
 * ```
 */
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

// =============================================================================
// useThrottledCallback Hook
// =============================================================================

/**
 * Generic callback function type for throttling
 * Uses explicit type parameters to avoid 'unknown' in the signature
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThrottledFunction = (...args: any[]) => void;

/**
 * Hook for throttled callback
 *
 * Returns a throttled version of the callback that only executes
 * at most once per specified delay period.
 *
 * @param callback - The function to throttle
 * @param delay - Minimum time between calls in milliseconds
 * @returns The throttled callback
 *
 * @example
 * ```tsx
 * function ScrollTracker() {
 *   const handleScroll = useThrottledCallback(
 *     () => console.log('Scrolled at', Date.now()),
 *     100
 *   );
 *
 *   useEffect(() => {
 *     window.addEventListener('scroll', handleScroll);
 *     return () => window.removeEventListener('scroll', handleScroll);
 *   }, [handleScroll]);
 *
 *   return <div>Scroll me</div>;
 * }
 * ```
 */
export function useThrottledCallback<T extends ThrottledFunction>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    [callback, delay]
  );
}

// =============================================================================
// useVirtualizedData Hook
// =============================================================================

/**
 * Options for virtualized list
 */
export interface UseVirtualizedDataOptions {
  /** Height of each item in pixels */
  itemHeight: number;
  /** Height of the container in pixels */
  containerHeight: number;
  /** Number of extra items to render outside visible area */
  overscan?: number;
}

/**
 * Hook for virtualized list data
 *
 * Provides windowing/virtualization for large lists by only rendering
 * items that are currently visible (plus overscan buffer).
 *
 * @param items - Full list of items
 * @param options - Virtualization options
 * @returns Visible items with positioning and scroll handler
 *
 * @example
 * ```tsx
 * function VirtualList({ items }: { items: string[] }) {
 *   const {
 *     visibleItems,
 *     totalHeight,
 *     handleScroll
 *   } = useVirtualizedData(items, {
 *     itemHeight: 50,
 *     containerHeight: 400,
 *     overscan: 5
 *   });
 *
 *   return (
 *     <div style={{ height: 400, overflow: 'auto' }} onScroll={handleScroll}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {visibleItems.map(({ item, index, style }) => (
 *           <div key={index} style={style}>{item}</div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVirtualizedData<T>(
  items: T[],
  options: UseVirtualizedDataOptions
): UseVirtualizedDataReturn<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const { itemHeight, containerHeight, overscan = 3 } = options;

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
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
