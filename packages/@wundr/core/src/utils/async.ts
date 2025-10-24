/**
 * Async utility functions
 */

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes async operations with retry logic
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const {
    attempts = 3,
    delay: baseDelay = 1000,
    backoff = 'exponential',
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !shouldRetry(error)) {
        throw error;
      }

      const delayMs =
        backoff === 'exponential'
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
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out',
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}

/**
 * Executes async operations in batches
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
  } = {},
): Promise<R[]> {
  const { batchSize = 10, concurrency = 3, delayBetweenBatches = 0 } = options;

  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processWithConcurrency(
      batch,
      processor,
      concurrency,
    );
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
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, item] of items.entries()) {
    const promise = processor(item).then(result => {
      results[index] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1,
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Creates a debounced version of an async function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number,
): T {
  let timeoutId: ReturnType<typeof setTimeout>;

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }) as T;
}

/**
 * Creates a throttled version of an async function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  interval: number,
): T {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout>;

  return ((...args: Parameters<T>) => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      const execute = async () => {
        lastCall = Date.now();
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (timeSinceLastCall >= interval) {
        execute();
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(execute, interval - timeSinceLastCall);
      }
    });
  }) as T;
}
