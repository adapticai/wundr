/**
 * Performance Monitoring Utilities
 */

export type PerformanceMetric = {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
};

export type PerformanceMark = {
  name: string;
  startTime: number;
};

export type PerformanceMeasure = {
  name: string;
  duration: number;
  startMark: string;
  endMark: string;
};

export type VitalsMetric = {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: Date;
};

/**
 * Core Web Vitals metrics type
 */
export type CoreWebVitals = {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
};

/**
 * Performance rating classification
 */
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/**
 * Connection information interface
 */
export interface ConnectionInfo {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g' | string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private marks: Map<string, PerformanceMark> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>,
  ): void {
    console.log('[Performance] Recording metric:', name, value);

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      metadata,
    };

    const existing = this.metrics.get(name) || [];
    this.metrics.set(name, [...existing, metric]);

    // TODO: Send to analytics service
    // this.sendToAnalytics(metric);
  }

  /**
   * Start a performance measurement
   */
  startMeasure(name: string): void {
    console.log('[Performance] Starting measure:', name);

    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }

    this.marks.set(name, {
      name,
      startTime: Date.now(),
    });
  }

  /**
   * End a performance measurement
   */
  endMeasure(name: string): number | null {
    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`[Performance] No start mark found for: ${name}`);
      return null;
    }

    const duration = Date.now() - mark.startTime;
    console.log('[Performance] Ending measure:', name, `${duration}ms`);

    if (
      typeof performance !== 'undefined' &&
      performance.mark &&
      performance.measure
    ) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    this.recordMetric(name, duration, { type: 'duration' });
    this.marks.delete(name);

    return duration;
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measure<T>(name: string, fn: () => T): T {
    this.startMeasure(name);
    try {
      const result = fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return this.metrics;
  }

  /**
   * Clear metrics
   */
  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      console.log('[Performance] Cleared metrics for:', name);
    } else {
      this.metrics.clear();
      console.log('[Performance] Cleared all metrics');
    }
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  initWebVitals(): void {
    console.log('[Performance] Initializing Web Vitals monitoring');

    if (typeof PerformanceObserver === 'undefined') {
      console.warn('[Performance] PerformanceObserver not supported');
      return;
    }

    // TODO: Implement Web Vitals monitoring using web-vitals library
    // import { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
    // onCLS((metric) => this.recordVital(metric));
    // onFID((metric) => this.recordVital(metric));
    // onFCP((metric) => this.recordVital(metric));
    // onLCP((metric) => this.recordVital(metric));
    // onTTFB((metric) => this.recordVital(metric));
    // onINP((metric) => this.recordVital(metric));
  }

  /**
   * Record a Core Web Vital metric
   */
  private recordVital(metric: unknown): void {
    console.log('[Performance] Recording Web Vital:', metric);
    // TODO: Process and store vital metric
    // this.recordMetric(metric.name, metric.value, {
    //   rating: metric.rating,
    //   id: metric.id,
    // });
  }

  /**
   * Get performance navigation timing
   */
  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) {
      return null;
    }

    const [navigation] = performance.getEntriesByType(
      'navigation',
    ) as PerformanceNavigationTiming[];
    return navigation || null;
  }

  /**
   * Get resource timing entries
   */
  getResourceTiming(): PerformanceResourceTiming[] {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) {
      return [];
    }

    return performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
  }

  /**
   * Calculate page load metrics
   */
  getPageLoadMetrics(): Record<string, number> | null {
    const navigation = this.getNavigationTiming();
    if (!navigation) {
      return null;
    }

    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      processing:
        navigation.domComplete - navigation.domContentLoadedEventStart,
      domContentLoaded:
        navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart,
      load: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.fetchStart,
    };
  }

  /**
   * Send metrics to analytics service
   */
  private async sendToAnalytics(metric: PerformanceMetric): Promise<void> {
    console.log('[Performance] Sending metric to analytics:', metric);
    // TODO: Implement analytics integration
    // await fetch('/api/analytics/performance', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metric),
    // });
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Record a performance metric
 */
export function recordMetric(
  name: string,
  value: number,
  metadata?: Record<string, unknown>,
): void {
  performanceMonitor.recordMetric(name, value, metadata);
}

/**
 * Start a performance measurement
 */
export function startMeasure(name: string): void {
  performanceMonitor.startMeasure(name);
}

/**
 * End a performance measurement
 */
export function endMeasure(name: string): number | null {
  return performanceMonitor.endMeasure(name);
}

/**
 * Measure async function execution
 */
export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return performanceMonitor.measureAsync(name, fn);
}

/**
 * Measure sync function execution
 */
export function measure<T>(name: string, fn: () => T): T {
  return performanceMonitor.measure(name, fn);
}

/**
 * Get metrics for a specific name
 */
export function getMetrics(name: string): PerformanceMetric[] {
  return performanceMonitor.getMetrics(name);
}

/**
 * Get all metrics
 */
export function getAllMetrics(): Map<string, PerformanceMetric[]> {
  return performanceMonitor.getAllMetrics();
}

/**
 * Clear metrics
 */
export function clearMetrics(name?: string): void {
  performanceMonitor.clearMetrics(name);
}

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals(): void {
  performanceMonitor.initWebVitals();
}

/**
 * Get navigation timing
 */
export function getNavigationTiming(): PerformanceNavigationTiming | null {
  return performanceMonitor.getNavigationTiming();
}

/**
 * Get resource timing
 */
export function getResourceTiming(): PerformanceResourceTiming[] {
  return performanceMonitor.getResourceTiming();
}

/**
 * Get page load metrics
 */
export function getPageLoadMetrics(): Record<string, number> | null {
  return performanceMonitor.getPageLoadMetrics();
}

/**
 * Measure Core Web Vitals
 * Returns a promise that resolves with the measured vitals
 */
export async function measureWebVitals(): Promise<Partial<CoreWebVitals>> {
  // TODO: Implement actual web vitals measurement using web-vitals library
  // For now, return empty object
  return new Promise(resolve => {
    if (typeof window === 'undefined') {
      resolve({});
      return;
    }

    // Simulate async measurement
    setTimeout(() => {
      const vitals: Partial<CoreWebVitals> = {};

      // Try to get some basic metrics if available
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(
          entry => entry.name === 'first-contentful-paint',
        );
        if (fcpEntry) {
          vitals.FCP = fcpEntry.startTime;
        }
      }

      resolve(vitals);
    }, 0);
  });
}

/**
 * Get performance rating for a metric
 */
export function getPerformanceRating(
  metric: keyof CoreWebVitals,
  value: number,
): PerformanceRating {
  // Thresholds based on Web Vitals recommendations
  const thresholds: Record<
    keyof CoreWebVitals,
    { good: number; poor: number }
  > = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
  };

  const threshold = thresholds[metric];
  if (!threshold) {
    return 'needs-improvement';
  }

  if (value <= threshold.good) {
    return 'good';
  } else if (value <= threshold.poor) {
    return 'needs-improvement';
  } else {
    return 'poor';
  }
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

/**
 * Check if user prefers reduced data
 */
export function prefersReducedData(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
  };

  return nav.connection?.saveData ?? false;
}

/**
 * Get connection information
 */
export function getConnectionInfo(): ConnectionInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };

  const connection = nav.connection;
  if (!connection) {
    return {};
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
}

/**
 * Check if system is under memory pressure
 */
export function isUnderMemoryPressure(threshold = 0.9): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const performance = window.performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  if (!performance.memory) {
    return false;
  }

  const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
  const usage = usedJSHeapSize / jsHeapSizeLimit;

  return usage >= threshold;
}

/**
 * Polyfill for requestIdleCallback
 */
export function requestIdleCallbackPolyfill(
  callback: () => void,
  options?: { timeout?: number },
): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }

  // Fallback to setTimeout
  const timeout = options?.timeout ?? 1000;
  return globalThis.setTimeout(callback, timeout) as unknown as number;
}

/**
 * Polyfill for cancelIdleCallback
 */
export function cancelIdleCallbackPolyfill(handle: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
    return;
  }

  // Fallback to clearTimeout
  globalThis.clearTimeout(handle);
}

/**
 * Create a lazy-loading IntersectionObserver
 */
export function createLazyObserver(
  onVisible: () => void,
  options: IntersectionObserverInit = {},
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        onVisible();
        observer.disconnect();
      }
    });
  }, options);

  return observer;
}

// Export the monitor instance
export default performanceMonitor;
