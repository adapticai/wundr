/**
 * Tests for the RateLimiter class (src/auth/rate-limiter.ts).
 *
 * Covers:
 *  - Message rate limiting within a sliding window
 *  - Connection concurrency limits
 *  - Remaining message allowance calculation
 *  - Stale bucket cleanup
 *  - Multiple clients in isolation
 *  - Destroy / teardown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RateLimiter } from '../../../auth/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  // -------------------------------------------------------------------------
  // Message rate limiting
  // -------------------------------------------------------------------------

  describe('message rate limiting', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 5,
        windowMs: 10_000,
        maxConnectionsPerClient: 10,
      });
    });

    it('should allow messages within the limit', () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.checkMessageRate('client-a')).toBe(true);
      }
    });

    it('should reject messages exceeding the limit', () => {
      for (let i = 0; i < 5; i++) {
        limiter.checkMessageRate('client-a');
      }
      expect(limiter.checkMessageRate('client-a')).toBe(false);
    });

    it('should track clients independently', () => {
      // Fill up client-a
      for (let i = 0; i < 5; i++) {
        limiter.checkMessageRate('client-a');
      }
      expect(limiter.checkMessageRate('client-a')).toBe(false);

      // client-b should still have allowance
      expect(limiter.checkMessageRate('client-b')).toBe(true);
    });

    it('should reset allowance after the window expires', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        limiter.checkMessageRate('client-a');
      }
      expect(limiter.checkMessageRate('client-a')).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(11_000);

      expect(limiter.checkMessageRate('client-a')).toBe(true);

      vi.useRealTimers();
    });

    it('should slide the window (oldest messages fall off)', () => {
      vi.useFakeTimers();

      // Send 3 messages at time 0
      for (let i = 0; i < 3; i++) {
        limiter.checkMessageRate('client-a');
      }

      // Advance 6 seconds
      vi.advanceTimersByTime(6_000);

      // Send 2 more (total 5, but 3 are within the last 10s)
      expect(limiter.checkMessageRate('client-a')).toBe(true);
      expect(limiter.checkMessageRate('client-a')).toBe(true);

      // Advance 5 more seconds (first 3 fall off)
      vi.advanceTimersByTime(5_000);

      // Now only 2 remain in window, so we can send 3 more
      expect(limiter.checkMessageRate('client-a')).toBe(true);
      expect(limiter.checkMessageRate('client-a')).toBe(true);
      expect(limiter.checkMessageRate('client-a')).toBe(true);
      expect(limiter.checkMessageRate('client-a')).toBe(false);

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // Remaining messages
  // -------------------------------------------------------------------------

  describe('getRemainingMessages', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 10,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });
    });

    it('should return maxMessages for unknown client', () => {
      expect(limiter.getRemainingMessages('unknown')).toBe(10);
    });

    it('should decrement as messages are sent', () => {
      limiter.checkMessageRate('client-a');
      limiter.checkMessageRate('client-a');
      limiter.checkMessageRate('client-a');

      expect(limiter.getRemainingMessages('client-a')).toBe(7);
    });

    it('should return 0 when limit is reached', () => {
      for (let i = 0; i < 10; i++) {
        limiter.checkMessageRate('client-a');
      }

      expect(limiter.getRemainingMessages('client-a')).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Connection concurrency
  // -------------------------------------------------------------------------

  describe('connection concurrency', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 100,
        windowMs: 60_000,
        maxConnectionsPerClient: 3,
      });
    });

    it('should allow connections within the limit', () => {
      expect(limiter.addConnection('client-a')).toBe(true);
      expect(limiter.addConnection('client-a')).toBe(true);
      expect(limiter.addConnection('client-a')).toBe(true);
    });

    it('should reject connections exceeding the limit', () => {
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');

      expect(limiter.addConnection('client-a')).toBe(false);
    });

    it('should allow connections after removal', () => {
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');

      expect(limiter.addConnection('client-a')).toBe(false);

      limiter.removeConnection('client-a');

      expect(limiter.addConnection('client-a')).toBe(true);
    });

    it('should track connection counts independently per client', () => {
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');

      // client-b is independent
      expect(limiter.addConnection('client-b')).toBe(true);
    });

    it('should not go below 0 connections on over-removal', () => {
      limiter.addConnection('client-a');
      limiter.removeConnection('client-a');
      limiter.removeConnection('client-a'); // extra removal

      expect(limiter.getConnectionCount('client-a')).toBe(0);
    });

    it('should handle removeConnection for unknown client gracefully', () => {
      // Should not throw
      limiter.removeConnection('unknown-client');
      expect(limiter.getConnectionCount('unknown-client')).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getConnectionCount
  // -------------------------------------------------------------------------

  describe('getConnectionCount', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 100,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });
    });

    it('should return 0 for unknown client', () => {
      expect(limiter.getConnectionCount('unknown')).toBe(0);
    });

    it('should reflect current connection count', () => {
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');

      expect(limiter.getConnectionCount('client-a')).toBe(2);

      limiter.removeConnection('client-a');

      expect(limiter.getConnectionCount('client-a')).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Destroy / cleanup
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('should clear all buckets', () => {
      limiter = new RateLimiter({
        maxMessages: 100,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });

      limiter.addConnection('client-a');
      limiter.checkMessageRate('client-a');

      limiter.destroy();

      // After destroy, counts should be 0
      expect(limiter.getConnectionCount('client-a')).toBe(0);
      expect(limiter.getRemainingMessages('client-a')).toBe(100);
    });

    it('should be safe to call destroy multiple times', () => {
      limiter = new RateLimiter({
        maxMessages: 100,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });

      limiter.destroy();
      limiter.destroy(); // should not throw
    });
  });

  // -------------------------------------------------------------------------
  // Stress / edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle high message volume', () => {
      limiter = new RateLimiter({
        maxMessages: 1000,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });

      for (let i = 0; i < 1000; i++) {
        expect(limiter.checkMessageRate('heavy-client')).toBe(true);
      }
      expect(limiter.checkMessageRate('heavy-client')).toBe(false);
    });

    it('should handle many unique clients', () => {
      limiter = new RateLimiter({
        maxMessages: 5,
        windowMs: 60_000,
        maxConnectionsPerClient: 10,
      });

      for (let i = 0; i < 100; i++) {
        expect(limiter.checkMessageRate(`client-${i}`)).toBe(true);
      }
    });
  });
});
