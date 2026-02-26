/**
 * Sliding-window rate limiter keyed by client identity.
 *
 * Provides two independent controls:
 *  1. Message rate limiting  -- max N messages per sliding window.
 *  2. Connection concurrency -- max M simultaneous WebSocket connections
 *     per client identity.
 *
 * The implementation is entirely in-process (no Redis) which is
 * appropriate for a single-daemon deployment.  For multi-instance
 * deployments, swap this out for a Redis-backed implementation.
 */

import { Logger } from '../utils/logger';

export interface RateLimiterConfig {
  /** Maximum messages allowed within the sliding window. */
  maxMessages: number;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
  /** Maximum concurrent connections per client identity. */
  maxConnectionsPerClient: number;
}

interface ClientBucket {
  /** Timestamps (ms) of messages within the current window. */
  timestamps: number[];
  /** Active connection count. */
  connections: number;
}

export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly buckets: Map<string, ClientBucket> = new Map();
  private readonly logger: Logger;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.logger = new Logger('RateLimiter');

    // Periodic cleanup of stale buckets every 2 minutes.
    this.cleanupTimer = setInterval(() => this.cleanup(), 120_000);
  }

  // -------------------------------------------------------------------------
  // Message rate limiting
  // -------------------------------------------------------------------------

  /**
   * Record a message and check whether the client is within limits.
   *
   * @returns `true` if the message is allowed, `false` if rate-limited.
   */
  checkMessageRate(clientId: string): boolean {
    const now = Date.now();
    const bucket = this.getOrCreateBucket(clientId);

    // Prune timestamps outside the window.
    const windowStart = now - this.config.windowMs;
    bucket.timestamps = bucket.timestamps.filter(t => t > windowStart);

    if (bucket.timestamps.length >= this.config.maxMessages) {
      this.logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return false;
    }

    bucket.timestamps.push(now);
    return true;
  }

  /**
   * Return remaining message allowance for a client within the current window.
   */
  getRemainingMessages(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket) {
      return this.config.maxMessages;
    }
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const recent = bucket.timestamps.filter(t => t > windowStart).length;
    return Math.max(0, this.config.maxMessages - recent);
  }

  // -------------------------------------------------------------------------
  // Connection concurrency
  // -------------------------------------------------------------------------

  /**
   * Attempt to register a new connection for a client.
   *
   * @returns `true` if the connection is allowed, `false` if the
   *          concurrency limit has been reached.
   */
  addConnection(clientId: string): boolean {
    const bucket = this.getOrCreateBucket(clientId);
    if (bucket.connections >= this.config.maxConnectionsPerClient) {
      this.logger.warn(`Connection limit exceeded for client: ${clientId}`);
      return false;
    }
    bucket.connections++;
    return true;
  }

  /**
   * Release a connection slot when a WebSocket closes.
   */
  removeConnection(clientId: string): void {
    const bucket = this.buckets.get(clientId);
    if (bucket) {
      bucket.connections = Math.max(0, bucket.connections - 1);
    }
  }

  /**
   * Get the current connection count for a client.
   */
  getConnectionCount(clientId: string): number {
    return this.buckets.get(clientId)?.connections ?? 0;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private getOrCreateBucket(clientId: string): ClientBucket {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = { timestamps: [], connections: 0 };
      this.buckets.set(clientId, bucket);
    }
    return bucket;
  }

  /**
   * Remove buckets that have zero connections and no recent messages.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [clientId, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter(t => t > windowStart);
      if (bucket.connections === 0 && bucket.timestamps.length === 0) {
        this.buckets.delete(clientId);
      }
    }
  }

  /**
   * Tear down the periodic cleanup timer.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}
