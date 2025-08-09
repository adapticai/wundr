/**
 * Async utility functions
 */
/**
 * Delays execution for specified milliseconds
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Executes async operations with retry logic
 */
export declare function retry<T>(operation: () => Promise<T>, options?: {
    attempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: any) => boolean;
}): Promise<T>;
/**
 * Executes async operations with timeout
 */
export declare function withTimeout<T>(operation: Promise<T>, timeoutMs: number, timeoutMessage?: string): Promise<T>;
/**
 * Executes async operations in batches
 */
export declare function batchProcess<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
}): Promise<R[]>;
/**
 * Executes async operations with limited concurrency
 */
export declare function processWithConcurrency<T, R>(items: T[], processor: (item: T) => Promise<R>, concurrency: number): Promise<R[]>;
/**
 * Creates a debounced version of an async function
 */
export declare function debounceAsync<T extends (...args: any[]) => Promise<any>>(fn: T, delay: number): T;
/**
 * Creates a throttled version of an async function
 */
export declare function throttleAsync<T extends (...args: any[]) => Promise<any>>(fn: T, interval: number): T;
//# sourceMappingURL=async.d.ts.map