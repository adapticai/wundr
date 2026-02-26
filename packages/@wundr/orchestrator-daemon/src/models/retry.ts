/**
 * Retry Utilities - Exponential backoff with jitter for LLM requests
 *
 * Provides retry-with-backoff for individual LLM calls within the failover
 * loop. The router uses this for transient errors (timeout, network) that
 * should be retried against the SAME provider/model before falling over to
 * the next candidate.
 *
 * Backoff formula: min(maxDelayMs, baseDelayMs * 2^attempt) + jitter
 * Jitter is uniformly distributed in [0, jitterFraction * computedDelay].
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of retries (0 = no retries, just one attempt) */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs: number;
  /** Jitter fraction (0-1). 0 = no jitter, 1 = up to 100% additional delay */
  jitterFraction: number;
  /** Optional abort signal to cancel retries */
  signal?: AbortSignal;
  /** Optional predicate: return true if the error is retryable */
  isRetryable?: (error: unknown, attempt: number) => boolean;
  /** Optional callback on each retry (for logging/telemetry) */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDelayMs: number;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitterFraction: 0.2,
};

// ---------------------------------------------------------------------------
// Backoff calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the delay for a given retry attempt using exponential backoff
 * with optional jitter.
 */
export function calculateBackoffMs(
  attempt: number,
  config: Pick<RetryConfig, 'baseDelayMs' | 'maxDelayMs' | 'jitterFraction'>
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFraction * Math.random();
  return Math.floor(cappedDelay + jitter);
}

// ---------------------------------------------------------------------------
// Retry executor
// ---------------------------------------------------------------------------

/**
 * Execute an async function with exponential backoff retry.
 *
 * @param fn - The async operation to attempt
 * @param config - Retry configuration
 * @returns The successful result along with attempt count and total delay
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const resolved: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;
  let totalDelayMs = 0;
  const totalAttempts = resolved.maxRetries + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    // Check abort before each attempt
    if (resolved.signal?.aborted) {
      throw new DOMException('Retry aborted', 'AbortError');
    }

    try {
      const result = await fn(attempt);
      return { result, attempts: attempt + 1, totalDelayMs };
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt
      if (attempt >= resolved.maxRetries) {
        break;
      }

      // Check if the error is retryable
      if (resolved.isRetryable && !resolved.isRetryable(error, attempt)) {
        break;
      }

      // Calculate delay
      const delayMs = calculateBackoffMs(attempt, resolved);
      totalDelayMs += delayMs;

      // Notify callback
      if (resolved.onRetry) {
        resolved.onRetry(error, attempt + 1, delayMs);
      }

      // Wait with abort support
      await sleep(delayMs, resolved.signal);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for a given duration with abort signal support.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Sleep aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Sleep aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      // Clean up the listener when the timer fires normally
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener('abort', onAbort);
        originalResolve();
      };
    }
  });
}

/**
 * Predicate for errors that are typically transient and worth retrying.
 */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Check status codes
  const status =
    (error as { status?: number }).status ??
    (error as { statusCode?: number }).statusCode;
  if (typeof status === 'number') {
    // 429 Too Many Requests, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    if ([429, 502, 503, 504].includes(status)) {
      return true;
    }
    // 4xx errors other than 429 are not transient
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Check error codes
  const code = (error as { code?: string }).code;
  if (typeof code === 'string') {
    const transientCodes = [
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT',
      'ECONNRESET',
      'ECONNABORTED',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EPIPE',
      'UND_ERR_SOCKET',
    ];
    if (transientCodes.includes(code.toUpperCase())) {
      return true;
    }
  }

  // Check error names
  const name = (error as { name?: string }).name;
  if (name === 'TimeoutError') {
    return true;
  }

  // Check message patterns
  const message = error instanceof Error ? error.message : '';
  if (
    /timeout|timed out|reset|ECONNRESET|rate.?limit|too many requests|overloaded|capacity/i.test(
      message
    )
  ) {
    return true;
  }

  return false;
}
