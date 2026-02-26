/**
 * Tests for the protocol RateLimiter class (src/protocol/rate-limiter.ts).
 *
 * Covers:
 *  - Token bucket algorithm (lazy refill, clamping to maxTokens)
 *  - Request throttling with consume()
 *  - Per-method cost overrides
 *  - Burst handling (full bucket drained in quick succession)
 *  - Rate limit reset and connection removal
 *  - retryAfterMs computation
 *  - Bucket state monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  RateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  METHOD_COST_MAP,
} from '../../../protocol/rate-limiter';

describe('RateLimiter (protocol)', () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.reset();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Construction and defaults
  // -------------------------------------------------------------------------

  describe('construction', () => {
    it('should use default config when none is provided', () => {
      limiter = new RateLimiter();
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      // Default bucket starts with 100 tokens, costs 1 -> remaining = 99
      expect(result.remaining).toBe(99);
    });

    it('should accept partial config overrides', () => {
      limiter = new RateLimiter({ maxTokens: 10 });
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should accept full config', () => {
      limiter = new RateLimiter({
        maxTokens: 50,
        refillRatePerSecond: 10,
        tokensPerRequest: 2,
      });
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      // 50 - 2 = 48
      expect(result.remaining).toBe(48);
    });

    it('should accept custom method costs', () => {
      const customCosts = { 'my.method': 10 };
      limiter = new RateLimiter({ maxTokens: 20 }, customCosts);
      const result = limiter.consume('conn-1', 'my.method');
      expect(result.allowed).toBe(true);
      // 20 - 10 = 10
      expect(result.remaining).toBe(10);
    });

    it('should use the default METHOD_COST_MAP when no custom costs are given', () => {
      limiter = new RateLimiter({ maxTokens: 100 });
      const result = limiter.consume('conn-1', 'prompt.submit');
      // prompt.submit costs 5 from METHOD_COST_MAP
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95);
    });
  });

  // -------------------------------------------------------------------------
  // Token bucket algorithm -- basic consume
  // -------------------------------------------------------------------------

  describe('consume - basic token bucket', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 2,
        tokensPerRequest: 1,
      });
    });

    it('should allow a request when tokens are available', () => {
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it('should create a new bucket on first consume for a connection', () => {
      expect(limiter.getBucketState('conn-new')).toBeNull();
      limiter.consume('conn-new');
      expect(limiter.getBucketState('conn-new')).not.toBeNull();
    });

    it('should deny when tokens are exhausted', () => {
      // Drain all 10 tokens
      for (let i = 0; i < 10; i++) {
        const r = limiter.consume('conn-1');
        expect(r.allowed).toBe(true);
      }

      const denied = limiter.consume('conn-1');
      expect(denied.allowed).toBe(false);
      expect(denied.remaining).toBe(0);
      expect(denied.retryAfterMs).toBeDefined();
      expect(denied.retryAfterMs).toBeGreaterThan(0);
    });

    it('should return remaining as a floored integer', () => {
      // Consume 1 token from a full bucket of 10
      const result = limiter.consume('conn-1');
      expect(Number.isInteger(result.remaining)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Per-method cost
  // -------------------------------------------------------------------------

  describe('per-method cost', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxTokens: 20,
        refillRatePerSecond: 5,
        tokensPerRequest: 1,
      });
    });

    it('should use the default tokensPerRequest for unknown methods', () => {
      const result = limiter.consume('conn-1', 'some.unknown.method');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 20 - 1
    });

    it('should use per-method cost from METHOD_COST_MAP', () => {
      const result = limiter.consume('conn-1', 'prompt.submit');
      // prompt.submit costs 5
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15); // 20 - 5
    });

    it('should use per-method cost for session.create', () => {
      const result = limiter.consume('conn-1', 'session.create');
      // session.create costs 3
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(17); // 20 - 3
    });

    it('should use per-method cost for memory.store', () => {
      const result = limiter.consume('conn-1', 'memory.store');
      // memory.store costs 2
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(18); // 20 - 2
    });

    it('should use default cost when method parameter is undefined', () => {
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 20 - 1
    });

    it('should deny a high-cost method if bucket has fewer tokens than cost', () => {
      // Drain to 4 tokens
      for (let i = 0; i < 16; i++) {
        limiter.consume('conn-1');
      }
      const state = limiter.getBucketState('conn-1');
      expect(state?.tokens).toBe(4);

      // prompt.submit costs 5 -- should be denied
      const result = limiter.consume('conn-1', 'prompt.submit');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Burst handling
  // -------------------------------------------------------------------------

  describe('burst handling', () => {
    it('should allow burst up to maxTokens in rapid succession', () => {
      limiter = new RateLimiter({
        maxTokens: 50,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      // Burst all 50 tokens at once
      for (let i = 0; i < 50; i++) {
        const result = limiter.consume('conn-burst');
        expect(result.allowed).toBe(true);
      }

      // 51st should be denied
      const denied = limiter.consume('conn-burst');
      expect(denied.allowed).toBe(false);
    });

    it('should handle burst of expensive methods', () => {
      limiter = new RateLimiter({
        maxTokens: 15,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      // prompt.submit costs 5 each, so 3 bursts = 15
      for (let i = 0; i < 3; i++) {
        const result = limiter.consume('conn-burst', 'prompt.submit');
        expect(result.allowed).toBe(true);
      }

      // 4th should be denied
      const denied = limiter.consume('conn-burst', 'prompt.submit');
      expect(denied.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Token refill (lazy, time-based)
  // -------------------------------------------------------------------------

  describe('token refill', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should refill tokens based on elapsed time', () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 5,
        tokensPerRequest: 1,
      });

      // Drain all 10 tokens
      for (let i = 0; i < 10; i++) {
        limiter.consume('conn-1');
      }
      expect(limiter.consume('conn-1').allowed).toBe(false);

      // Advance 1 second -> +5 tokens
      vi.advanceTimersByTime(1000);
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      // Should have refilled 5 tokens, then consumed 1 -> remaining = 4
      expect(result.remaining).toBe(4);
    });

    it('should not exceed maxTokens during refill', () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 100,
        tokensPerRequest: 1,
      });

      // Consume 1 token
      limiter.consume('conn-1');

      // Advance 10 seconds -- would add 1000 tokens but clamped to 10
      vi.advanceTimersByTime(10_000);
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      // Clamped to 10, then consumed 1 -> 9
      expect(result.remaining).toBe(9);
    });

    it('should partially refill after fractional seconds', () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 10,
        tokensPerRequest: 1,
      });

      // Drain all tokens
      for (let i = 0; i < 10; i++) {
        limiter.consume('conn-1');
      }

      // Advance 500ms -> should refill 5 tokens (10/sec * 0.5s)
      vi.advanceTimersByTime(500);
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      // 5 refilled, 1 consumed -> 4
      expect(result.remaining).toBe(4);
    });

    it('should resume allowing requests after sufficient time passes', () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      // Drain bucket
      for (let i = 0; i < 5; i++) {
        limiter.consume('conn-1');
      }
      expect(limiter.consume('conn-1').allowed).toBe(false);

      // Wait 3 seconds -> refill 3 tokens
      vi.advanceTimersByTime(3000);
      expect(limiter.consume('conn-1').allowed).toBe(true);
      expect(limiter.consume('conn-1').allowed).toBe(true);
      expect(limiter.consume('conn-1').allowed).toBe(true);
      expect(limiter.consume('conn-1').allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // retryAfterMs calculation
  // -------------------------------------------------------------------------

  describe('retryAfterMs', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should compute retryAfterMs based on deficit and refill rate', () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        refillRatePerSecond: 10,
        tokensPerRequest: 1,
      });

      // Drain all 5 tokens
      for (let i = 0; i < 5; i++) {
        limiter.consume('conn-1');
      }

      const denied = limiter.consume('conn-1');
      expect(denied.allowed).toBe(false);
      // deficit = 1 - 0 = 1 token. At 10/sec, retryAfterMs = ceil(1/10 * 1000) = 100
      expect(denied.retryAfterMs).toBe(100);
    });

    it('should compute larger retryAfterMs for expensive methods', () => {
      limiter = new RateLimiter({
        maxTokens: 3,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      // Drain all 3 tokens
      for (let i = 0; i < 3; i++) {
        limiter.consume('conn-1');
      }

      // prompt.submit costs 5, bucket has 0 tokens
      // deficit = 5 - 0 = 5 tokens. At 1/sec: retryAfterMs = ceil(5/1 * 1000) = 5000
      const denied = limiter.consume('conn-1', 'prompt.submit');
      expect(denied.allowed).toBe(false);
      expect(denied.retryAfterMs).toBe(5000);
    });

    it('should compute retryAfterMs for partial deficit', () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 2,
        tokensPerRequest: 1,
      });

      // Drain to 2 tokens remaining
      for (let i = 0; i < 8; i++) {
        limiter.consume('conn-1');
      }

      // prompt.submit costs 5, but only 2 tokens left
      // deficit = 5 - 2 = 3. At 2/sec: retryAfterMs = ceil(3/2 * 1000) = 1500
      const denied = limiter.consume('conn-1', 'prompt.submit');
      expect(denied.allowed).toBe(false);
      expect(denied.retryAfterMs).toBe(1500);
    });
  });

  // -------------------------------------------------------------------------
  // Connection management
  // -------------------------------------------------------------------------

  describe('connection management', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });
    });

    it('should isolate buckets per connection', () => {
      limiter.consume('conn-a');
      limiter.consume('conn-a');

      const stateA = limiter.getBucketState('conn-a');
      expect(stateA?.tokens).toBe(8);

      const stateB = limiter.getBucketState('conn-b');
      expect(stateB).toBeNull();

      limiter.consume('conn-b');
      const stateBAfter = limiter.getBucketState('conn-b');
      expect(stateBAfter?.tokens).toBe(9);
    });

    it('should remove a connection bucket via removeConnection', () => {
      limiter.consume('conn-1');
      expect(limiter.getBucketState('conn-1')).not.toBeNull();

      limiter.removeConnection('conn-1');
      expect(limiter.getBucketState('conn-1')).toBeNull();
    });

    it('should handle removeConnection for unknown connection gracefully', () => {
      // Should not throw
      limiter.removeConnection('nonexistent');
    });

    it('should track connectionCount', () => {
      expect(limiter.connectionCount).toBe(0);

      limiter.consume('conn-a');
      expect(limiter.connectionCount).toBe(1);

      limiter.consume('conn-b');
      expect(limiter.connectionCount).toBe(2);

      limiter.removeConnection('conn-a');
      expect(limiter.connectionCount).toBe(1);
    });

    it('should give a fresh bucket after reconnection', () => {
      // Drain connection
      for (let i = 0; i < 10; i++) {
        limiter.consume('conn-1');
      }
      expect(limiter.consume('conn-1').allowed).toBe(false);

      // Disconnect and reconnect
      limiter.removeConnection('conn-1');
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // fresh bucket with 10 tokens - 1
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('should clear all buckets on reset', () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      limiter.consume('conn-a');
      limiter.consume('conn-b');
      limiter.consume('conn-c');
      expect(limiter.connectionCount).toBe(3);

      limiter.reset();
      expect(limiter.connectionCount).toBe(0);
      expect(limiter.getBucketState('conn-a')).toBeNull();
      expect(limiter.getBucketState('conn-b')).toBeNull();
      expect(limiter.getBucketState('conn-c')).toBeNull();
    });

    it('should be safe to call reset multiple times', () => {
      limiter = new RateLimiter();
      limiter.reset();
      limiter.reset();
      expect(limiter.connectionCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getBucketState monitoring
  // -------------------------------------------------------------------------

  describe('getBucketState', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxTokens: 20,
        refillRatePerSecond: 5,
        tokensPerRequest: 1,
      });
    });

    it('should return null for unknown connections', () => {
      expect(limiter.getBucketState('nobody')).toBeNull();
    });

    it('should return current tokens and maxTokens', () => {
      limiter.consume('conn-1');
      limiter.consume('conn-1');
      const state = limiter.getBucketState('conn-1');
      expect(state).toEqual({ tokens: 18, maxTokens: 20 });
    });

    it('should floor the token count', () => {
      // Tokens should always be reported as integers
      limiter.consume('conn-1');
      const state = limiter.getBucketState('conn-1');
      expect(Number.isInteger(state?.tokens)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // DEFAULT_RATE_LIMIT_CONFIG export
  // -------------------------------------------------------------------------

  describe('DEFAULT_RATE_LIMIT_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.maxTokens).toBe(100);
      expect(DEFAULT_RATE_LIMIT_CONFIG.refillRatePerSecond).toBe(20);
      expect(DEFAULT_RATE_LIMIT_CONFIG.tokensPerRequest).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // METHOD_COST_MAP export
  // -------------------------------------------------------------------------

  describe('METHOD_COST_MAP', () => {
    it('should define costs for expensive methods', () => {
      expect(METHOD_COST_MAP['prompt.submit']).toBe(5);
      expect(METHOD_COST_MAP['session.create']).toBe(3);
      expect(METHOD_COST_MAP['agent.spawn']).toBe(3);
      expect(METHOD_COST_MAP['team.create']).toBe(3);
      expect(METHOD_COST_MAP['memory.store']).toBe(2);
      expect(METHOD_COST_MAP['memory.query']).toBe(2);
      expect(METHOD_COST_MAP['config.set']).toBe(2);
    });

    it('should not define costs for cheap/read-only methods', () => {
      expect(METHOD_COST_MAP['health.ping']).toBeUndefined();
      expect(METHOD_COST_MAP['session.list']).toBeUndefined();
      expect(METHOD_COST_MAP['rpc.discover']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle zero-token bucket config', () => {
      limiter = new RateLimiter({
        maxTokens: 0,
        refillRatePerSecond: 10,
        tokensPerRequest: 1,
      });

      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(false);
    });

    it('should handle very high refill rate', () => {
      vi.useFakeTimers();
      limiter = new RateLimiter({
        maxTokens: 1000,
        refillRatePerSecond: 1_000_000,
        tokensPerRequest: 1,
      });

      // Drain bucket
      for (let i = 0; i < 1000; i++) {
        limiter.consume('conn-1');
      }

      // After 1 ms, should refill 1000 tokens (1M/sec * 0.001s = 1000, capped at 1000)
      vi.advanceTimersByTime(1);
      const result = limiter.consume('conn-1');
      expect(result.allowed).toBe(true);
    });

    it('should handle many concurrent connections', () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        refillRatePerSecond: 1,
        tokensPerRequest: 1,
      });

      for (let i = 0; i < 200; i++) {
        const result = limiter.consume(`conn-${i}`);
        expect(result.allowed).toBe(true);
      }
      expect(limiter.connectionCount).toBe(200);
    });
  });
});
