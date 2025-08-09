/**
 * Performance monitoring and optimization utilities
 */
/**
 * Performance timer for measuring execution time
 */
export declare class Timer {
    private startTime;
    private endTime?;
    private marks;
    constructor();
    /**
     * Mark a specific point in time
     */
    mark(name: string): void;
    /**
     * Get the duration since start or since a specific mark
     */
    getDuration(fromMark?: string): number;
    /**
     * Get the duration between two marks
     */
    getDurationBetween(startMark: string, endMark: string): number;
    /**
     * Stop the timer and return total duration
     */
    stop(): number;
    /**
     * Get all marks with their timestamps
     */
    getMarks(): Record<string, number>;
    /**
     * Reset the timer
     */
    reset(): void;
}
/**
 * Creates a timer instance
 */
export declare function createTimer(): Timer;
/**
 * Measures the execution time of a function
 */
export declare function measureTime<T>(fn: () => T | Promise<T>, label?: string): Promise<{
    result: T;
    duration: number;
}>;
/**
 * Memory usage monitoring
 */
export declare function getMemoryUsage(): {
    used: number;
    total: number;
    free: number;
    usage: number;
};
/**
 * Simple LRU cache implementation
 */
export declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    constructor(maxSize?: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    size(): number;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
}
/**
 * Memoization decorator for caching function results
 */
export declare function memoize<T extends (...args: any[]) => any>(fn: T, options?: {
    maxSize?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
}): T;
/**
 * Performance benchmarking suite
 */
export declare class Benchmark {
    private tests;
    private results;
    /**
     * Add a test to the benchmark suite
     */
    add(name: string, fn: () => any | Promise<any>): this;
    /**
     * Run all benchmarks
     */
    run(iterations?: number): Promise<Array<{
        name: string;
        duration: number;
        error?: Error;
    }>>;
    /**
     * Get benchmark results sorted by performance
     */
    getResults(sortBy?: 'name' | 'duration'): Array<{
        name: string;
        duration: number;
        error?: Error;
    }>;
    /**
     * Print results to console
     */
    printResults(): void;
}
/**
 * Creates a new benchmark instance
 */
export declare function createBenchmark(): Benchmark;
//# sourceMappingURL=performance.d.ts.map