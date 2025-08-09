/**
 * Performance monitoring and optimization utilities
 */

/**
 * Performance timer for measuring execution time
 */
export class Timer {
  private startTime: number;
  private endTime?: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Mark a specific point in time
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Get the duration since start or since a specific mark
   */
  getDuration(fromMark?: string): number {
    const now = performance.now();
    const startPoint = fromMark ? this.marks.get(fromMark) : this.startTime;
    
    if (!startPoint) {
      throw new Error(`Mark '${fromMark}' not found`);
    }
    
    return now - startPoint;
  }

  /**
   * Get the duration between two marks
   */
  getDurationBetween(startMark: string, endMark: string): number {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    
    if (!start || !end) {
      throw new Error(`Mark(s) not found: ${startMark}, ${endMark}`);
    }
    
    return end - start;
  }

  /**
   * Stop the timer and return total duration
   */
  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  /**
   * Get all marks with their timestamps
   */
  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = performance.now();
    this.endTime = undefined;
    this.marks.clear();
  }
}

/**
 * Creates a timer instance
 */
export function createTimer(): Timer {
  return new Timer();
}

/**
 * Measures the execution time of a function
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const timer = createTimer();
  
  if (label) {
    console.time(label);
  }
  
  try {
    const result = await fn();
    const duration = timer.stop();
    
    if (label) {
      console.timeEnd(label);
    }
    
    return { result, duration };
  } catch (error) {
    if (label) {
      console.timeEnd(label);
    }
    throw error;
  }
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  free: number;
  usage: number;
} {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    return {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      free: memUsage.heapTotal - memUsage.heapUsed,
      usage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };
  }
  
  // Fallback for browser environments
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    return {
      used: mem.usedJSHeapSize,
      total: mem.totalJSHeapSize,
      free: mem.totalJSHeapSize - mem.usedJSHeapSize,
      usage: (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100,
    };
  }
  
  return {
    used: 0,
    total: 0,
    free: 0,
    usage: 0,
  };
}

/**
 * Simple LRU cache implementation
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      // Move to end (most recent)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }
}

/**
 * Memoization decorator for caching function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number; // Time to live in milliseconds
  } = {}
): T {
  const {
    maxSize = 100,
    keyGenerator = (...args) => JSON.stringify(args),
    ttl,
  } = options;

  const cache = new LRUCache<string, { value: ReturnType<T>; timestamp?: number }>(maxSize);

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);
    const now = ttl ? Date.now() : undefined;

    // Check if cached value is still valid
    if (cached && (!ttl || !now || (now - (cached.timestamp || 0)) < ttl)) {
      return cached.value;
    }

    // Compute new value
    const value = fn(...args);
    cache.set(key, { value, timestamp: now });
    
    return value;
  }) as T;
}

/**
 * Performance benchmarking suite
 */
export class Benchmark {
  private tests: Array<{ name: string; fn: () => any | Promise<any> }> = [];
  private results: Array<{ name: string; duration: number; error?: Error }> = [];

  /**
   * Add a test to the benchmark suite
   */
  add(name: string, fn: () => any | Promise<any>): this {
    this.tests.push({ name, fn });
    return this;
  }

  /**
   * Run all benchmarks
   */
  async run(iterations = 1): Promise<Array<{ name: string; duration: number; error?: Error }>> {
    this.results = [];

    for (const test of this.tests) {
      let totalDuration = 0;
      let error: Error | undefined;

      for (let i = 0; i < iterations; i++) {
        try {
          const { duration } = await measureTime(test.fn);
          totalDuration += duration;
        } catch (e) {
          error = e instanceof Error ? e : new Error(String(e));
          break;
        }
      }

      this.results.push({
        name: test.name,
        duration: totalDuration / iterations, // Average duration
        error,
      });
    }

    return this.results;
  }

  /**
   * Get benchmark results sorted by performance
   */
  getResults(sortBy: 'name' | 'duration' = 'duration'): Array<{ name: string; duration: number; error?: Error }> {
    return [...this.results].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return a.duration - b.duration;
    });
  }

  /**
   * Print results to console
   */
  printResults(): void {
    console.table(this.getResults().map(result => ({
      Name: result.name,
      'Duration (ms)': result.duration.toFixed(2),
      Error: result.error ? result.error.message : 'None',
    })));
  }
}

/**
 * Creates a new benchmark instance
 */
export function createBenchmark(): Benchmark {
  return new Benchmark();
}