/**
 * Performance monitoring and optimization utilities with enterprise-grade logging
 */

import { getLogger, createLogger, type Logger } from '../logger/index.js';
import { getEventBus } from '../events/index.js';

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  logger?: Logger;
  enableEvents?: boolean;
  logLevel?: 'debug' | 'info' | 'warn';
  memoryThreshold?: number; // Memory usage percentage threshold for warnings
  timeThreshold?: number; // Time threshold in ms for warnings
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  duration: number;
  memoryUsage?: {
    used: number;
    total: number;
    free: number;
    usage: number;
  };
  timestamp: number;
  marks?: Record<string, number>;
  operation: string;
  metadata?: Record<string, unknown>;
}

/**
 * Global performance configuration
 */
let performanceConfig: PerformanceConfig = {
  logger: undefined,
  enableEvents: true,
  logLevel: 'info',
  memoryThreshold: 80, // 80% memory usage warning
  timeThreshold: 1000, // 1 second threshold
};

/**
 * Configure performance monitoring
 */
export function configurePerformance(config: Partial<PerformanceConfig>): void {
  performanceConfig = { ...performanceConfig, ...config };
}

/**
 * Get the performance logger
 */
function getPerformanceLogger(): Logger {
  if (!performanceConfig.logger) {
    performanceConfig.logger = createLogger({
      level: performanceConfig.logLevel || 'info',
      format: 'detailed',
      console: true,
    }).child({ module: 'performance' });
  }
  return performanceConfig.logger;
}

/**
 * Emit performance event
 */
function emitPerformanceEvent(type: string, metrics: PerformanceMetrics): void {
  if (performanceConfig.enableEvents) {
    try {
      getEventBus().emit(`performance:${type}`, metrics, 'performance-monitor');
    } catch (error) {
      // Fallback to logger if event bus fails
      getPerformanceLogger().warn('Failed to emit performance event', {
        type,
        error,
      });
    }
  }
}

/**
 * Performance timer for measuring execution time with enterprise logging
 */
export class Timer {
  private startTime: number;
  private endTime?: number;
  private marks: Map<string, number> = new Map();
  private operation: string;
  private logger: Logger;

  constructor(operation = 'timer-operation') {
    this.startTime = performance.now();
    this.operation = operation;
    this.logger = getPerformanceLogger();

    this.logger.debug('Timer started', {
      operation: this.operation,
      startTime: this.startTime,
      timestamp: Date.now(),
    });

    emitPerformanceEvent('timer-started', {
      operation: this.operation,
      duration: 0,
      timestamp: Date.now(),
    });
  }

  /**
   * Mark a specific point in time with logging
   */
  mark(name: string): void {
    const markTime = performance.now();
    this.marks.set(name, markTime);

    const durationSinceStart = markTime - this.startTime;

    this.logger.debug('Performance mark recorded', {
      operation: this.operation,
      mark: name,
      markTime,
      durationSinceStart,
      timestamp: Date.now(),
    });

    emitPerformanceEvent('mark-recorded', {
      operation: this.operation,
      duration: durationSinceStart,
      timestamp: Date.now(),
      marks: { [name]: markTime },
      metadata: { markName: name },
    });
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
   * Stop the timer and return total duration with comprehensive logging
   */
  stop(): number {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    const memoryUsage = getMemoryUsage();

    const metrics: PerformanceMetrics = {
      operation: this.operation,
      duration,
      memoryUsage,
      timestamp: Date.now(),
      marks: Object.fromEntries(this.marks),
    };

    // Log based on duration threshold
    const logLevel =
      duration > (performanceConfig.timeThreshold || 1000) ? 'warn' : 'info';

    this.logger[logLevel]('Timer stopped', {
      ...metrics,
      thresholdExceeded: duration > (performanceConfig.timeThreshold || 1000),
    });

    // Check memory threshold
    if (memoryUsage.usage > (performanceConfig.memoryThreshold || 80)) {
      this.logger.warn('High memory usage detected during operation', {
        operation: this.operation,
        memoryUsage: memoryUsage.usage,
        threshold: performanceConfig.memoryThreshold,
      });
    }

    emitPerformanceEvent('timer-stopped', metrics);

    return duration;
  }

  /**
   * Get all marks with their timestamps
   */
  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  /**
   * Reset the timer with logging
   */
  reset(): void {
    const oldStartTime = this.startTime;
    this.startTime = performance.now();
    this.endTime = undefined;
    this.marks.clear();

    this.logger.debug('Timer reset', {
      operation: this.operation,
      oldStartTime,
      newStartTime: this.startTime,
      timestamp: Date.now(),
    });

    emitPerformanceEvent('timer-reset', {
      operation: this.operation,
      duration: 0,
      timestamp: Date.now(),
    });
  }
}

/**
 * Creates a timer instance with optional operation name
 */
export function createTimer(operation = 'timer-operation'): Timer {
  return new Timer(operation);
}

/**
 * Measures the execution time of a function with enterprise logging
 */
async function measureTimeImpl<T>(
  fn: () => T | Promise<T>,
  options: {
    label?: string;
    enableLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn';
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ result: T; duration: number; metrics: PerformanceMetrics }> {
  const {
    label = 'measureTime-operation',
    enableLogging = true,
    logLevel = 'info',
    metadata = {},
  } = options;

  const timer = createTimer(label);
  const logger = getPerformanceLogger();
  const startMemory = getMemoryUsage();

  if (enableLogging) {
    logger.debug('Starting function measurement', {
      operation: label,
      startMemory,
      metadata,
      timestamp: Date.now(),
    });
  }

  try {
    const result = await fn();
    const duration = timer.stop();
    const endMemory = getMemoryUsage();

    const metrics: PerformanceMetrics = {
      operation: label,
      duration,
      memoryUsage: endMemory,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        memoryDelta: {
          usedDelta: endMemory.used - startMemory.used,
          usageDelta: endMemory.usage - startMemory.usage,
        },
      },
    };

    if (enableLogging) {
      const actualLogLevel =
        duration > (performanceConfig.timeThreshold || 1000)
          ? 'warn'
          : logLevel;

      logger[actualLogLevel]('Function measurement completed', {
        ...metrics,
        success: true,
        thresholdExceeded: duration > (performanceConfig.timeThreshold || 1000),
      });
    }

    emitPerformanceEvent('function-measured', metrics);

    return { result, duration, metrics };
  } catch (error) {
    const duration = timer.stop();
    const endMemory = getMemoryUsage();

    const metrics: PerformanceMetrics = {
      operation: label,
      duration,
      memoryUsage: endMemory,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
      },
    };

    if (enableLogging) {
      logger.error('Function measurement failed', {
        ...metrics,
        success: false,
        error,
      });
    }

    emitPerformanceEvent('function-measurement-failed', metrics);

    throw error;
  }
}

/**
 * Enhanced memory usage monitoring with enterprise logging
 */
export function getMemoryUsage(logUsage = false): {
  used: number;
  total: number;
  free: number;
  usage: number;
} {
  let memoryInfo = {
    used: 0,
    total: 0,
    free: 0,
    usage: 0,
  };

  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    memoryInfo = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      free: memUsage.heapTotal - memUsage.heapUsed,
      usage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };
  } else if (typeof performance !== 'undefined' && 'memory' in performance) {
    // Fallback for browser environments
    const mem = (
      performance as {
        memory: { usedJSHeapSize: number; totalJSHeapSize: number };
      }
    ).memory;
    memoryInfo = {
      used: mem.usedJSHeapSize,
      total: mem.totalJSHeapSize,
      free: mem.totalJSHeapSize - mem.usedJSHeapSize,
      usage: (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100,
    };
  }

  if (logUsage) {
    const logger = getPerformanceLogger();
    const logLevel =
      memoryInfo.usage > (performanceConfig.memoryThreshold || 80)
        ? 'warn'
        : 'debug';

    logger[logLevel]('Memory usage sampled', {
      ...memoryInfo,
      timestamp: Date.now(),
      thresholdExceeded:
        memoryInfo.usage > (performanceConfig.memoryThreshold || 80),
    });

    if (memoryInfo.usage > (performanceConfig.memoryThreshold || 80)) {
      emitPerformanceEvent('high-memory-usage', {
        operation: 'memory-monitoring',
        duration: 0,
        memoryUsage: memoryInfo,
        timestamp: Date.now(),
      });
    }
  }

  return memoryInfo;
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
 * Enhanced memoization decorator with performance monitoring
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number; // Time to live in milliseconds
    enableLogging?: boolean;
    name?: string;
  } = {}
): T {
  const {
    maxSize = 100,
    keyGenerator = (...args) => JSON.stringify(args),
    ttl,
    enableLogging = false,
    name = 'memoized-function',
  } = options;

  const cache = new LRUCache<
    string,
    { value: ReturnType<T>; timestamp?: number }
  >(maxSize);
  const logger = enableLogging ? getPerformanceLogger() : null;
  let hitCount = 0;
  let missCount = 0;

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);
    const now = ttl ? Date.now() : undefined;

    // Check if cached value is still valid
    if (cached && (!ttl || !now || now - (cached.timestamp || 0) < ttl)) {
      hitCount++;

      if (logger) {
        logger.debug('Cache hit for memoized function', {
          function: name,
          key,
          hitCount,
          missCount,
          hitRate: (hitCount / (hitCount + missCount)) * 100,
          timestamp: Date.now(),
        });
      }

      return cached.value;
    }

    // Compute new value
    missCount++;
    const startTime = performance.now();
    const value = fn(...args);
    const computeTime = performance.now() - startTime;

    cache.set(key, { value, timestamp: now });

    if (logger) {
      logger.debug('Cache miss for memoized function', {
        function: name,
        key,
        computeTime,
        hitCount,
        missCount,
        hitRate: hitCount > 0 ? (hitCount / (hitCount + missCount)) * 100 : 0,
        cacheSize: cache.size(),
        timestamp: Date.now(),
      });
    }

    return value;
  }) as T;
}

/**
 * Enhanced performance benchmarking suite with enterprise logging
 */
export class Benchmark {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tests: Array<{ name: string; fn: () => any | Promise<any> }> = [];
  private results: Array<{ name: string; duration: number; error?: Error }> =
    [];
  private logger: Logger;
  private suiteName: string;
  private startTime?: number;
  private endTime?: number;

  constructor(suiteName = 'benchmark-suite') {
    this.suiteName = suiteName;
    this.logger = getPerformanceLogger().child({ benchmarkSuite: suiteName });
  }

  /**
   * Add a test to the benchmark suite with logging
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(name: string, fn: () => any | Promise<any>): this {
    this.tests.push({ name, fn });

    this.logger.debug('Benchmark test added', {
      testName: name,
      totalTests: this.tests.length,
      suiteName: this.suiteName,
      timestamp: Date.now(),
    });

    return this;
  }

  /**
   * Run all benchmarks
   */
  async run(
    iterations = 1
  ): Promise<Array<{ name: string; duration: number; error?: Error }>> {
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
  getResults(
    sortBy: 'name' | 'duration' = 'duration'
  ): Array<{ name: string; duration: number; error?: Error }> {
    return [...this.results].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return a.duration - b.duration;
    });
  }

  /**
   * Log results using enterprise logger instead of console
   */
  logResults(format: 'table' | 'detailed' | 'summary' = 'table'): void {
    const results = this.getResults();

    if (format === 'summary') {
      const summary = {
        suiteName: this.suiteName,
        totalTests: results.length,
        successfulTests: results.filter(r => !r.error).length,
        failedTests: results.filter(r => r.error).length,
        avgDuration:
          results
            .filter(r => !r.error)
            .reduce((sum, r) => sum + r.duration, 0) /
            results.filter(r => !r.error).length || 0,
        fastestTest: results
          .filter(r => !r.error)
          .sort((a, b) => a.duration - b.duration)[0],
        slowestTest: results
          .filter(r => !r.error)
          .sort((a, b) => b.duration - a.duration)[0],
        suiteDuration:
          this.endTime && this.startTime
            ? this.endTime - this.startTime
            : undefined,
      };

      this.logger.info('Benchmark summary', summary);
    } else if (format === 'detailed') {
      results.forEach((result, index) => {
        this.logger.info(`Benchmark result ${index + 1}`, {
          testName: result.name,
          duration: result.duration,
          durationFormatted: `${result.duration.toFixed(2)}ms`,
          error: result.error
            ? {
                message: result.error.message,
                name: result.error.name,
              }
            : null,
          status: result.error ? 'failed' : 'success',
          suiteName: this.suiteName,
        });
      });
    } else {
      // Table format - structured logging
      const tableData = results.map((result, index) => ({
        rank: index + 1,
        testName: result.name,
        durationMs: parseFloat(result.duration.toFixed(2)),
        status: result.error ? 'FAILED' : 'SUCCESS',
        error: result.error ? result.error.message : null,
      }));

      this.logger.info('Benchmark results table', {
        suiteName: this.suiteName,
        results: tableData,
        summary: {
          total: results.length,
          passed: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length,
        },
      });
    }

    // Always emit performance event for results
    emitPerformanceEvent('benchmark-results-logged', {
      operation: this.suiteName,
      duration:
        this.endTime && this.startTime ? this.endTime - this.startTime : 0,
      timestamp: Date.now(),
      metadata: { results, format },
    });
  }

  /**
   * @deprecated Use logResults() instead for enterprise logging
   */
  printResults(): void {
    this.logger.warn('printResults() is deprecated, use logResults() instead');
    this.logResults('table');
  }
}

/**
 * Creates a new benchmark instance with optional suite name
 */
export function createBenchmark(suiteName?: string): Benchmark {
  return new Benchmark(suiteName);
}

/**
 * Enhanced performance monitoring utilities
 */

/**
 * Monitor function execution and gather comprehensive metrics
 */
export async function monitorExecution<T>(
  fn: () => T | Promise<T>,
  options: {
    name: string;
    category?: string;
    enableLogging?: boolean;
    enableEvents?: boolean;
    memoryThreshold?: number;
    timeThreshold?: number;
  }
): Promise<{
  result: T;
  metrics: PerformanceMetrics & {
    category?: string;
    executionId: string;
  };
}> {
  const {
    name,
    category = 'general',
    enableLogging = true,
    enableEvents = true,
    memoryThreshold,
    timeThreshold,
  } = options;

  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const logger = enableLogging ? getPerformanceLogger() : null;

  // Temporarily override config if thresholds provided
  const originalConfig = { ...performanceConfig };
  if (memoryThreshold !== undefined)
    performanceConfig.memoryThreshold = memoryThreshold;
  if (timeThreshold !== undefined)
    performanceConfig.timeThreshold = timeThreshold;
  if (!enableEvents) performanceConfig.enableEvents = false;

  try {
    const { result, duration, metrics } = await measureTimeOriginal(fn, {
      label: name,
      enableLogging,
      metadata: { category, executionId },
    });

    const enhancedMetrics = {
      ...metrics,
      category,
      executionId,
    };

    if (logger) {
      logger.info('Execution monitoring completed', {
        name,
        category,
        executionId,
        duration,
        memoryUsage: metrics.memoryUsage,
        success: true,
      });
    }

    return { result, metrics: enhancedMetrics };
  } finally {
    // Restore original config
    performanceConfig = originalConfig;
  }
}

/**
 * Create a performance monitoring decorator
 */
export function performanceMonitor<T extends (...args: any[]) => any>(
  options: {
    name?: string;
    category?: string;
    enableLogging?: boolean;
    logParams?: boolean;
    logResults?: boolean;
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName =
      options.name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: Parameters<T>) {
      const { result } = await monitorExecution(
        () => originalMethod.apply(this, args),
        {
          name: methodName,
          category: options.category || 'method',
          enableLogging: options.enableLogging,
        }
      );

      return result;
    };

    return descriptor;
  };
}

/**
 * Aggregate performance metrics over time
 */
export class PerformanceAggregator {
  private metrics: PerformanceMetrics[] = [];
  private logger: Logger;
  private name: string;

  constructor(name = 'performance-aggregator') {
    this.name = name;
    this.logger = getPerformanceLogger().child({ aggregator: name });
  }

  /**
   * Add metrics to the aggregator
   */
  addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    this.logger.debug('Metrics added to aggregator', {
      operation: metrics.operation,
      duration: metrics.duration,
      totalMetrics: this.metrics.length,
    });
  }

  /**
   * Get aggregated statistics
   */
  getStats(operation?: string): {
    count: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    standardDeviation: number;
    p95Duration: number;
    p99Duration: number;
    memoryStats?: {
      avgUsage: number;
      maxUsage: number;
      minUsage: number;
    };
  } {
    const filteredMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        standardDeviation: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const durations = filteredMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / durations.length;

    const variance =
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) /
      durations.length;
    const standardDeviation = Math.sqrt(variance);

    const p95Index = Math.floor(durations.length * 0.95) - 1;
    const p99Index = Math.floor(durations.length * 0.99) - 1;

    const stats = {
      count: filteredMetrics.length,
      totalDuration,
      avgDuration,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      standardDeviation,
      p95Duration: durations[Math.max(0, p95Index)],
      p99Duration: durations[Math.max(0, p99Index)],
    };

    // Add memory stats if available
    const metricsWithMemory = filteredMetrics.filter(m => m.memoryUsage);
    if (metricsWithMemory.length > 0) {
      const memoryUsages = metricsWithMemory.map(m => m.memoryUsage!.usage);
      (stats as any).memoryStats = {
        avgUsage:
          memoryUsages.reduce((sum, u) => sum + u, 0) / memoryUsages.length,
        maxUsage: Math.max(...memoryUsages),
        minUsage: Math.min(...memoryUsages),
      };
    }

    return stats;
  }

  /**
   * Log aggregated statistics
   */
  logStats(operation?: string): void {
    const stats = this.getStats(operation);

    this.logger.info('Performance statistics', {
      aggregator: this.name,
      operation: operation || 'all',
      ...stats,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    const previousCount = this.metrics.length;
    this.metrics = [];

    this.logger.debug('Metrics cleared', {
      aggregator: this.name,
      previousCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all operations tracked
   */
  getOperations(): string[] {
    return [...new Set(this.metrics.map(m => m.operation))];
  }
}

/**
 * Global performance aggregator instance
 */
let globalAggregator: PerformanceAggregator;

/**
 * Get the global performance aggregator
 */
export function getPerformanceAggregator(): PerformanceAggregator {
  if (!globalAggregator) {
    globalAggregator = new PerformanceAggregator('global');
  }
  return globalAggregator;
}

// Export the main measureTime function
export const measureTime = measureTimeImpl;

// For internal use to avoid circular references
const measureTimeOriginal = measureTimeImpl;
