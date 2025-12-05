/**
 * Workflow Trigger Rate Limiter
 *
 * Implements sliding window rate limiting for workflow triggers using Redis.
 *
 * @module lib/workflow/rate-limiter
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Default rate limit configurations by trigger type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  webhook: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  api: { maxRequests: 1000, windowMs: 60000 }, // 1000 requests per minute
  schedule: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  event: { maxRequests: 500, windowMs: 60000 }, // 500 requests per minute
};

/**
 * Check rate limit for a workflow trigger
 */
export async function checkRateLimit(
  workflowId: string,
  triggerType: string = 'webhook'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[triggerType] || RATE_LIMITS.webhook;
  const key = `ratelimit:workflow:${workflowId}:${triggerType}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis sorted set for sliding window
    const multi = redis.multi();

    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    multi.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    // Get count (index 1 in results)
    const count = results[1]?.[1] as number;

    const allowed = count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count - 1);
    const reset = now + config.windowMs;

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.windowMs,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  workflowId: string,
  triggerType: string = 'webhook'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[triggerType] || RATE_LIMITS.webhook;
  const key = `ratelimit:workflow:${workflowId}:${triggerType}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Remove old entries and count
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    const remaining = Math.max(0, config.maxRequests - count);
    const reset = now + config.windowMs;

    return {
      allowed: count < config.maxRequests,
      limit: config.maxRequests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit status check failed:', error);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.windowMs,
    };
  }
}

/**
 * Reset rate limit for a workflow
 */
export async function resetRateLimit(
  workflowId: string,
  triggerType?: string
): Promise<void> {
  try {
    if (triggerType) {
      const key = `ratelimit:workflow:${workflowId}:${triggerType}`;
      await redis.del(key);
    } else {
      // Reset all trigger types
      const pattern = `ratelimit:workflow:${workflowId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('Rate limit reset failed:', error);
  }
}

/**
 * Get rate limit configuration for a trigger type
 */
export function getRateLimitConfig(triggerType: string): RateLimitConfig {
  return RATE_LIMITS[triggerType] || RATE_LIMITS.webhook;
}
