/**
 * AI Rate Limiter
 *
 * Implements sliding window rate limiting for AI API requests with Redis-based
 * distributed tracking and in-memory fallback.
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Redis-based distributed rate limiting
 * - In-memory fallback when Redis unavailable
 * - Per-user and per-workspace limits
 * - Configurable time windows
 * - Retry-After header calculation
 */

import Redis from 'ioredis';

// Types
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string; // user:userId or workspace:workspaceId
  scope?: 'user' | 'workspace' | 'global';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until next request allowed
  limit: number;
}

export interface RateLimitEntry {
  timestamp: number;
  count: number;
}

// Redis client singleton with graceful fallback
let redisClient: Redis | null = null;
let redisAvailable = false;

// In-memory fallback store
const memoryStore = new Map<string, RateLimitEntry[]>();

// Initialize Redis connection
function getRedisClient(): Redis | null {
  if (redisClient !== null) {
    return redisAvailable ? redisClient : null;
  }

  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    redisClient = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn(
            'Redis connection failed, falling back to in-memory rate limiting'
          );
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('Redis connected for rate limiting');
      redisAvailable = true;
    });

    redisClient.on('error', err => {
      console.error('Redis error:', err.message);
      redisAvailable = false;
    });

    // Connect asynchronously
    redisClient.connect().catch(() => {
      redisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    redisAvailable = false;
    return null;
  }
}

/**
 * Check rate limit using sliding window algorithm
 */
export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, identifier } = config;
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:ai:${identifier}`;

  try {
    const redis = getRedisClient();

    if (redis && redisAvailable) {
      return await checkRateLimitRedis(
        redis,
        key,
        now,
        windowStart,
        maxRequests,
        windowMs
      );
    } else {
      return checkRateLimitMemory(key, now, windowStart, maxRequests, windowMs);
    }
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: maxRequests - 1,
      reset: Math.floor((now + windowMs) / 1000),
      limit: maxRequests,
    };
  }
}

/**
 * Redis-based rate limiting with sliding window
 */
async function checkRateLimitRedis(
  redis: Redis,
  key: string,
  now: number,
  windowStart: number,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const pipeline = redis.pipeline();

  // Remove old entries outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);

  // Count requests in current window
  pipeline.zcard(key);

  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`);

  // Set expiration
  pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);

  const results = await pipeline.exec();

  if (!results) {
    throw new Error('Redis pipeline failed');
  }

  // Get count before adding current request
  const count = (results[1]?.[1] as number) || 0;
  const allowed = count < maxRequests;
  const remaining = Math.max(0, maxRequests - count - 1);

  // Calculate reset time (end of current window)
  const reset = Math.floor((now + windowMs) / 1000);

  // If not allowed, remove the request we just added
  if (!allowed) {
    await redis.zremrangebyscore(key, now, now);
  }

  // Calculate retry after if limit exceeded
  let retryAfter: number | undefined;
  if (!allowed) {
    // Get oldest request in window
    const oldestRequests = await redis.zrange(key, 0, 0, 'WITHSCORES');
    if (oldestRequests.length >= 2) {
      const oldestTimestamp = parseInt(oldestRequests[1] as string, 10);
      retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    } else {
      retryAfter = Math.ceil(windowMs / 1000);
    }
  }

  return {
    allowed,
    remaining,
    reset,
    retryAfter,
    limit: maxRequests,
  };
}

/**
 * In-memory fallback rate limiting with sliding window
 */
function checkRateLimitMemory(
  key: string,
  now: number,
  windowStart: number,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  let entries = memoryStore.get(key) || [];

  // Remove old entries
  entries = entries.filter(entry => entry.timestamp > windowStart);

  const count = entries.reduce((sum, entry) => sum + entry.count, 0);
  const allowed = count < maxRequests;
  const remaining = Math.max(0, maxRequests - count - (allowed ? 1 : 0));

  if (allowed) {
    entries.push({ timestamp: now, count: 1 });
    memoryStore.set(key, entries);
  }

  const reset = Math.floor((now + windowMs) / 1000);

  let retryAfter: number | undefined;
  if (!allowed && entries.length > 0) {
    const oldestTimestamp = entries[0].timestamp;
    retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
  }

  // Cleanup old entries periodically (basic memory management)
  if (Math.random() < 0.01) {
    cleanupMemoryStore(now - windowMs * 2);
  }

  return {
    allowed,
    remaining,
    reset,
    retryAfter,
    limit: maxRequests,
  };
}

/**
 * Clean up old entries from memory store
 */
function cleanupMemoryStore(cutoffTime: number): void {
  for (const [key, entries] of memoryStore.entries()) {
    const filtered = entries.filter(entry => entry.timestamp > cutoffTime);
    if (filtered.length === 0) {
      memoryStore.delete(key);
    } else if (filtered.length < entries.length) {
      memoryStore.set(key, filtered);
    }
  }
}

/**
 * Check if a bypass token is valid (for admin/testing)
 */
export function checkBypassToken(token: string | null): boolean {
  if (!token) return false;

  const bypassTokens = process.env.RATE_LIMIT_BYPASS_TOKENS?.split(',') || [];
  return bypassTokens.some(t => t.trim() === token.trim());
}

/**
 * Reset rate limit for a specific identifier (admin function)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `ratelimit:ai:${identifier}`;

  try {
    const redis = getRedisClient();
    if (redis && redisAvailable) {
      await redis.del(key);
    } else {
      memoryStore.delete(key);
    }
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
  }
}

/**
 * Get current rate limit status without consuming a request
 */
export async function getRateLimitStatus(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, identifier } = config;
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:ai:${identifier}`;

  try {
    const redis = getRedisClient();

    if (redis && redisAvailable) {
      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);
      const remaining = Math.max(0, maxRequests - count);
      const reset = Math.floor((now + windowMs) / 1000);

      return {
        allowed: count < maxRequests,
        remaining,
        reset,
        limit: maxRequests,
      };
    } else {
      let entries = memoryStore.get(key) || [];
      entries = entries.filter(entry => entry.timestamp > windowStart);
      const count = entries.reduce((sum, entry) => sum + entry.count, 0);
      const remaining = Math.max(0, maxRequests - count);
      const reset = Math.floor((now + windowMs) / 1000);

      return {
        allowed: count < maxRequests,
        remaining,
        reset,
        limit: maxRequests,
      };
    }
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      allowed: true,
      remaining: maxRequests,
      reset: Math.floor((now + windowMs) / 1000),
      limit: maxRequests,
    };
  }
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
  }
}
