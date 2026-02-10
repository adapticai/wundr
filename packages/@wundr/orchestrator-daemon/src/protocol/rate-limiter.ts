/**
 * Rate Limiter
 *
 * Token-bucket rate limiting per client connection. Each connection
 * gets a configurable number of tokens that replenish over time.
 * Requests that exceed the limit receive a RATE_LIMITED error with
 * a `retryAfterMs` hint.
 *
 * The implementation is lightweight -- no timers, no background threads.
 * Token replenishment is computed lazily on each `consume()` call
 * using elapsed time since the last refill.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum tokens in the bucket (burst capacity). */
  maxTokens: number;
  /** Tokens added per second (sustained rate). */
  refillRatePerSecond: number;
  /** Tokens consumed per request. Default: 1. */
  tokensPerRequest?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining after this check. */
  remaining: number;
  /** If denied, milliseconds until enough tokens are available. */
  retryAfterMs?: number;
}

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxTokens: 100,
  refillRatePerSecond: 20,
  tokensPerRequest: 1,
};

// ---------------------------------------------------------------------------
// Per-method overrides
// ---------------------------------------------------------------------------

/**
 * Some methods are more expensive than others. This map allows
 * overriding the tokens-per-request cost on a per-method basis.
 */
export const METHOD_COST_MAP: Record<string, number> = {
  'prompt.submit': 5,
  'session.create': 3,
  'agent.spawn': 3,
  'team.create': 3,
  'memory.store': 2,
  'memory.query': 2,
  'config.set': 2,
};

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private config: Required<RateLimitConfig>;
  private methodCosts: Record<string, number>;

  constructor(
    config?: Partial<RateLimitConfig>,
    methodCosts?: Record<string, number>,
  ) {
    this.config = {
      maxTokens: config?.maxTokens ?? DEFAULT_RATE_LIMIT_CONFIG.maxTokens,
      refillRatePerSecond: config?.refillRatePerSecond ?? DEFAULT_RATE_LIMIT_CONFIG.refillRatePerSecond,
      tokensPerRequest: config?.tokensPerRequest ?? DEFAULT_RATE_LIMIT_CONFIG.tokensPerRequest!,
    };
    this.methodCosts = methodCosts ?? METHOD_COST_MAP;
  }

  /**
   * Attempt to consume tokens for a request from the given connection.
   *
   * @param connectionId - The connection identifier.
   * @param method - The RPC method being called (used for per-method cost lookup).
   * @returns Whether the request is allowed, and rate limit metadata.
   */
  consume(connectionId: string, method?: string): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(connectionId);

    if (!bucket) {
      bucket = { tokens: this.config.maxTokens, lastRefillAt: now };
      this.buckets.set(connectionId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - bucket.lastRefillAt;
    if (elapsedMs > 0) {
      const tokensToAdd = (elapsedMs / 1000) * this.config.refillRatePerSecond;
      bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefillAt = now;
    }

    // Determine cost
    const cost = method && this.methodCosts[method]
      ? this.methodCosts[method]
      : this.config.tokensPerRequest;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
      };
    }

    // Denied -- compute retry delay
    const deficit = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / this.config.refillRatePerSecond) * 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  /**
   * Remove the bucket for a disconnected client.
   */
  removeConnection(connectionId: string): void {
    this.buckets.delete(connectionId);
  }

  /**
   * Reset all buckets. Called during testing or shutdown.
   */
  reset(): void {
    this.buckets.clear();
  }

  /**
   * Get current bucket state for monitoring.
   */
  getBucketState(connectionId: string): { tokens: number; maxTokens: number } | null {
    const bucket = this.buckets.get(connectionId);
    if (!bucket) {
      return null;
    }
    return {
      tokens: Math.floor(bucket.tokens),
      maxTokens: this.config.maxTokens,
    };
  }

  /** Number of tracked connections. */
  get connectionCount(): number {
    return this.buckets.size;
  }
}
