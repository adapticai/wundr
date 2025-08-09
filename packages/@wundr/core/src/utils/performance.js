"use strict";
/**
 * Performance monitoring and optimization utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Benchmark = exports.LRUCache = exports.Timer = void 0;
exports.createTimer = createTimer;
exports.measureTime = measureTime;
exports.getMemoryUsage = getMemoryUsage;
exports.memoize = memoize;
exports.createBenchmark = createBenchmark;
/**
 * Performance timer for measuring execution time
 */
class Timer {
    constructor() {
        this.marks = new Map();
        this.startTime = performance.now();
    }
    /**
     * Mark a specific point in time
     */
    mark(name) {
        this.marks.set(name, performance.now());
    }
    /**
     * Get the duration since start or since a specific mark
     */
    getDuration(fromMark) {
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
    getDurationBetween(startMark, endMark) {
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
    stop() {
        this.endTime = performance.now();
        return this.endTime - this.startTime;
    }
    /**
     * Get all marks with their timestamps
     */
    getMarks() {
        return Object.fromEntries(this.marks);
    }
    /**
     * Reset the timer
     */
    reset() {
        this.startTime = performance.now();
        this.endTime = undefined;
        this.marks.clear();
    }
}
exports.Timer = Timer;
/**
 * Creates a timer instance
 */
function createTimer() {
    return new Timer();
}
/**
 * Measures the execution time of a function
 */
async function measureTime(fn, label) {
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
    }
    catch (error) {
        if (label) {
            console.timeEnd(label);
        }
        throw error;
    }
}
/**
 * Memory usage monitoring
 */
function getMemoryUsage() {
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
    if (typeof performance !== 'undefined' && performance.memory) {
        const mem = performance.memory;
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
class LRUCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recent)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }
    has(key) {
        return this.cache.has(key);
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
    keys() {
        return this.cache.keys();
    }
    values() {
        return this.cache.values();
    }
}
exports.LRUCache = LRUCache;
/**
 * Memoization decorator for caching function results
 */
function memoize(fn, options = {}) {
    const { maxSize = 100, keyGenerator = (...args) => JSON.stringify(args), ttl, } = options;
    const cache = new LRUCache(maxSize);
    return ((...args) => {
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
    });
}
/**
 * Performance benchmarking suite
 */
class Benchmark {
    constructor() {
        this.tests = [];
        this.results = [];
    }
    /**
     * Add a test to the benchmark suite
     */
    add(name, fn) {
        this.tests.push({ name, fn });
        return this;
    }
    /**
     * Run all benchmarks
     */
    async run(iterations = 1) {
        this.results = [];
        for (const test of this.tests) {
            let totalDuration = 0;
            let error;
            for (let i = 0; i < iterations; i++) {
                try {
                    const { duration } = await measureTime(test.fn);
                    totalDuration += duration;
                }
                catch (e) {
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
    getResults(sortBy = 'duration') {
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
    printResults() {
        console.table(this.getResults().map(result => ({
            Name: result.name,
            'Duration (ms)': result.duration.toFixed(2),
            Error: result.error ? result.error.message : 'None',
        })));
    }
}
exports.Benchmark = Benchmark;
/**
 * Creates a new benchmark instance
 */
function createBenchmark() {
    return new Benchmark();
}
//# sourceMappingURL=performance.js.map