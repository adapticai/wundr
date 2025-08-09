"use strict";
/**
 * Async utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = delay;
exports.retry = retry;
exports.withTimeout = withTimeout;
exports.batchProcess = batchProcess;
exports.processWithConcurrency = processWithConcurrency;
exports.debounceAsync = debounceAsync;
exports.throttleAsync = throttleAsync;
/**
 * Delays execution for specified milliseconds
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Executes async operations with retry logic
 */
async function retry(operation, options = {}) {
    const { attempts = 3, delay: baseDelay = 1000, backoff = 'exponential', shouldRetry = () => true, } = options;
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === attempts || !shouldRetry(error)) {
                throw error;
            }
            const delayMs = backoff === 'exponential'
                ? baseDelay * Math.pow(2, attempt - 1)
                : baseDelay * attempt;
            await delay(delayMs);
        }
    }
    throw lastError;
}
/**
 * Executes async operations with timeout
 */
async function withTimeout(operation, timeoutMs, timeoutMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return Promise.race([operation, timeoutPromise]);
}
/**
 * Executes async operations in batches
 */
async function batchProcess(items, processor, options = {}) {
    const { batchSize = 10, concurrency = 3, delayBetweenBatches = 0, } = options;
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await processWithConcurrency(batch, processor, concurrency);
        results.push(...batchResults);
        if (delayBetweenBatches > 0 && i + batchSize < items.length) {
            await delay(delayBetweenBatches);
        }
    }
    return results;
}
/**
 * Executes async operations with limited concurrency
 */
async function processWithConcurrency(items, processor, concurrency) {
    const results = [];
    const executing = [];
    for (const [index, item] of items.entries()) {
        const promise = processor(item).then(result => {
            results[index] = result;
        });
        executing.push(promise);
        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(executing.findIndex(p => p === promise), 1);
        }
    }
    await Promise.all(executing);
    return results;
}
/**
 * Creates a debounced version of an async function
 */
function debounceAsync(fn, delay) {
    let timeoutId;
    return ((...args) => {
        return new Promise((resolve, reject) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                try {
                    const result = await fn(...args);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            }, delay);
        });
    });
}
/**
 * Creates a throttled version of an async function
 */
function throttleAsync(fn, interval) {
    let lastCall = 0;
    let timeout;
    return ((...args) => {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCall;
            const execute = async () => {
                lastCall = Date.now();
                try {
                    const result = await fn(...args);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            };
            if (timeSinceLastCall >= interval) {
                execute();
            }
            else {
                clearTimeout(timeout);
                timeout = setTimeout(execute, interval - timeSinceLastCall);
            }
        });
    });
}
//# sourceMappingURL=async.js.map