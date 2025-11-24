/**
 * Performance Service for Genesis-App
 * Handles caching, metrics collection, and optimization utilities
 */

import type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  PerformanceMetric,
  CoreWebVitals,
  PerformanceRating,
  QueryMetrics,
  ApiMetrics,
  RenderMetrics,
  MemoizationConfig,
} from '../types/performance';

/**
 * LRU (Least Recently Used) Cache implementation.
 * Provides efficient caching with automatic eviction of least recently accessed items.
 *
 * @typeParam T - The type of values stored in the cache
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<User>({ ttl: 60000, maxSize: 100 });
 * cache.set('user:123', userData);
 * const user = cache.get('user:123');
 * ```
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    hitRate: 0,
    avgTtl: 0,
  };

  constructor(private config: CacheConfig) {}

  /** Get value from cache */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return undefined;
    }

    // Update access info
    entry.hits++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /** Set value in cache */
  set(key: string, value: T, tags: string[] = []): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
        this.stats.size--;
      }
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + this.config.ttl,
      tags: [...(this.config.tags || []), ...tags],
      hits: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /** Delete value from cache */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.size--;
    }
    return result;
  }

  /** Invalidate by tags */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.stats.size = this.cache.size;
    return invalidated;
  }

  /** Clear entire cache */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /** Get cache stats */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /** Check if key exists */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
return false;
}
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }
    return true;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/** Performance metrics collector */
export class MetricsCollector {
  private metrics: PerformanceMetric[] = [];
  private webVitals: Partial<CoreWebVitals> = {};
  private renderMetrics: Map<string, RenderMetrics> = new Map();
  private queryMetrics: QueryMetrics[] = [];
  private apiMetrics: ApiMetrics[] = [];
  private maxMetrics: number;

  constructor(maxMetrics = 10000) {
    this.maxMetrics = maxMetrics;
  }

  /** Record a timing metric */
  timing(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      type: 'timing',
      value,
      unit: 'ms',
      timestamp: Date.now(),
      tags,
    });
  }

  /** Record a counter metric */
  counter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      type: 'counter',
      value,
      unit: 'count',
      timestamp: Date.now(),
      tags,
    });
  }

  /** Record a gauge metric */
  gauge(name: string, value: number, unit: string, tags: Record<string, string> = {}): void {
    this.addMetric({
      name,
      type: 'gauge',
      value,
      unit,
      timestamp: Date.now(),
      tags,
    });
  }

  /** Record Core Web Vitals */
  recordWebVital(name: keyof CoreWebVitals, value: number): void {
    this.webVitals[name] = value;
    this.timing(`web_vital_${name}`, value, { vital: name });
  }

  /** Get Web Vitals */
  getWebVitals(): Partial<CoreWebVitals> {
    return { ...this.webVitals };
  }

  /** Rate a web vital */
  rateWebVital(name: keyof CoreWebVitals, value: number): PerformanceRating {
    const thresholds = {
      lcp: { good: 2500, needsImprovement: 4000 },
      fid: { good: 100, needsImprovement: 300 },
      cls: { good: 0.1, needsImprovement: 0.25 },
      fcp: { good: 1800, needsImprovement: 3000 },
      ttfb: { good: 800, needsImprovement: 1800 },
      inp: { good: 200, needsImprovement: 500 },
    };

    const threshold = thresholds[name];
    if (value <= threshold.good) {
return 'good';
}
    if (value <= threshold.needsImprovement) {
return 'needs-improvement';
}
    return 'poor';
  }

  /** Record component render */
  recordRender(componentName: string, renderTime: number): void {
    const existing = this.renderMetrics.get(componentName);

    if (existing) {
      existing.renderCount++;
      existing.totalRenderTime += renderTime;
      existing.avgRenderTime = existing.totalRenderTime / existing.renderCount;
      existing.lastRenderTime = renderTime;
      existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
    } else {
      this.renderMetrics.set(componentName, {
        componentName,
        renderCount: 1,
        totalRenderTime: renderTime,
        avgRenderTime: renderTime,
        lastRenderTime: renderTime,
        maxRenderTime: renderTime,
      });
    }
  }

  /** Get render metrics */
  getRenderMetrics(): RenderMetrics[] {
    return Array.from(this.renderMetrics.values());
  }

  /** Record database query */
  recordQuery(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    if (this.queryMetrics.length > this.maxMetrics) {
      this.queryMetrics.shift();
    }
  }

  /** Get slow queries */
  getSlowQueries(thresholdMs: number = 100): QueryMetrics[] {
    return this.queryMetrics.filter(q => q.executionTime > thresholdMs);
  }

  /** Record API call */
  recordApiCall(metrics: ApiMetrics): void {
    this.apiMetrics.push(metrics);
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics.shift();
    }
  }

  /** Get API metrics summary */
  getApiMetricsSummary(): Record<string, { count: number; avgTime: number; errorRate: number }> {
    const summary: Record<string, { count: number; totalTime: number; errors: number }> = {};

    for (const metric of this.apiMetrics) {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!summary[key]) {
        summary[key] = { count: 0, totalTime: 0, errors: 0 };
      }
      summary[key].count++;
      summary[key].totalTime += metric.responseTime;
      if (metric.statusCode >= 400) {
        summary[key].errors++;
      }
    }

    const result: Record<string, { count: number; avgTime: number; errorRate: number }> = {};
    for (const [key, data] of Object.entries(summary)) {
      result[key] = {
        count: data.count,
        avgTime: data.totalTime / data.count,
        errorRate: data.errors / data.count,
      };
    }

    return result;
  }

  /** Get all metrics */
  getMetrics(filter?: { name?: string; type?: string; since?: number }): PerformanceMetric[] {
    let result = this.metrics;

    if (filter?.name) {
      result = result.filter(m => m.name.includes(filter.name!));
    }
    if (filter?.type) {
      result = result.filter(m => m.type === filter.type);
    }
    if (filter?.since) {
      result = result.filter(m => m.timestamp >= filter.since!);
    }

    return result;
  }

  /** Clear all metrics */
  clear(): void {
    this.metrics = [];
    this.webVitals = {};
    this.renderMetrics.clear();
    this.queryMetrics = [];
    this.apiMetrics = [];
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }
}

/** Memoization utility */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  config: Partial<MemoizationConfig> = {},
): T {
  const { maxSize = 100, ttl = 60000, keyGenerator } = config;
  const cache = new LRUCache<ReturnType<T>>({ ttl, maxSize });

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}

/** Debounce utility */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };
}

/** Throttle utility */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Request deduplication utility.
 * Prevents duplicate concurrent requests by returning the same promise
 * for identical requests made within a specified time window.
 *
 * @example
 * ```typescript
 * const dedup = new RequestDeduplicator(100);
 * // These will return the same promise if called within 100ms
 * const result1 = await dedup.dedupe('user:123', () => fetchUser(123));
 * const result2 = await dedup.dedupe('user:123', () => fetchUser(123));
 * ```
 */
export class RequestDeduplicator {
  /** Map of pending requests by key */
  private pending: Map<string, Promise<unknown>> = new Map();
  /** Time window in milliseconds for deduplication */
  private windowMs: number;

  /**
   * Creates a new RequestDeduplicator instance.
   *
   * @param windowMs - Time window in milliseconds to keep completed requests for deduplication
   */
  constructor(windowMs: number = 100) {
    this.windowMs = windowMs;
  }

  /** Deduplicate a request */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      setTimeout(() => {
        this.pending.delete(key);
      }, this.windowMs);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /** Check if request is pending */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /** Clear all pending */
  clear(): void {
    this.pending.clear();
  }
}

/** Batch processor for optimizing multiple operations */
export class BatchProcessor<T, R> {
  private queue: Array<{ item: T; resolve: (r: R) => void; reject: (e: Error) => void }> = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: { maxSize: number; maxWait: number } = { maxSize: 50, maxWait: 10 },
  ) {}

  /** Add item to batch */
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.options.maxSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.options.maxWait);
      }
    });
  }

  /** Flush the batch */
  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.queue.length === 0) {
return;
}

    const batch = this.queue.splice(0, this.options.maxSize);
    const items = batch.map(b => b.item);

    try {
      const results = await this.processor(items);
      batch.forEach((b, i) => {
        const result = results[i];
        if (result !== undefined) {
          b.resolve(result);
        } else {
          b.reject(new Error('Batch processor returned undefined result'));
        }
      });
    } catch (error) {
      batch.forEach(b => b.reject(error as Error));
    }
  }
}

/** Performance observer wrapper */
export function observePerformance(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void,
): (() => void) | null {
  if (typeof PerformanceObserver === 'undefined') {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ entryTypes });
    return () => observer.disconnect();
  } catch {
    return null;
  }
}

/**
 * Main performance service providing caching, metrics collection, and request deduplication.
 * Acts as a facade for all performance-related utilities.
 *
 * @example
 * ```typescript
 * const perfService = new PerformanceService({ ttl: 300000, maxSize: 1000 });
 *
 * // Use caching
 * perfService.getCache().set('key', value);
 *
 * // Measure operations
 * const result = await perfService.measure('fetchUsers', () => api.getUsers());
 *
 * // Get performance report
 * const report = perfService.getReport();
 * ```
 */
export class PerformanceService {
  /** LRU cache instance for general caching */
  private cache: LRUCache<unknown>;
  /** Metrics collector instance */
  private metrics: MetricsCollector;
  /** Request deduplicator instance */
  private deduplicator: RequestDeduplicator;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.cache = new LRUCache({
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      ...cacheConfig,
    });
    this.metrics = new MetricsCollector();
    this.deduplicator = new RequestDeduplicator();
  }

  /**
   * Gets the LRU cache instance.
   *
   * @returns The cache instance for storing and retrieving cached values
   */
  getCache(): LRUCache<unknown> {
    return this.cache;
  }

  /**
   * Gets the metrics collector instance.
   *
   * @returns The metrics collector for recording performance metrics
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Gets the request deduplicator instance.
   *
   * @returns The request deduplicator for preventing duplicate concurrent requests
   */
  getDeduplicator(): RequestDeduplicator {
    return this.deduplicator;
  }

  /**
   * Measures the execution time of an async operation.
   *
   * @typeParam T - The return type of the operation
   * @param name - The name of the metric to record
   * @param fn - The async function to measure
   * @param tags - Optional tags to attach to the metric
   * @returns The result of the async operation
   */
  async measure<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.metrics.timing(name, performance.now() - start, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      this.metrics.timing(name, performance.now() - start, { ...tags, status: 'error' });
      throw error;
    }
  }

  /**
   * Generates a comprehensive performance report.
   *
   * @returns Performance report containing cache stats, web vitals, API metrics, and more
   */
  getReport(): {
    cache: CacheStats;
    webVitals: Partial<CoreWebVitals>;
    apiSummary: Record<string, { count: number; avgTime: number; errorRate: number }>;
    slowQueries: QueryMetrics[];
    renderMetrics: RenderMetrics[];
  } {
    return {
      cache: this.cache.getStats(),
      webVitals: this.metrics.getWebVitals(),
      apiSummary: this.metrics.getApiMetricsSummary(),
      slowQueries: this.metrics.getSlowQueries(),
      renderMetrics: this.metrics.getRenderMetrics(),
    };
  }
}

export const performanceService = new PerformanceService();
