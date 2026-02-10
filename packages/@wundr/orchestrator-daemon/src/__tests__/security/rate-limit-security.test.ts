/**
 * Security regression tests for rate limiting.
 *
 * These tests verify that the rate limiter properly defends against
 * denial-of-service patterns and resource exhaustion attacks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuthMiddleware } from '../../auth/middleware';
import { RateLimiter } from '../../auth/rate-limiter';
import {
  createMockAuthConfig,
  createMockClientIdentity,
  MockWebSocket,
} from '../helpers';

import type { AuthenticatedWebSocket } from '../../auth/middleware';


describe('Rate Limit Security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Message flood protection
  // -------------------------------------------------------------------------

  describe('message flood protection', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 10,
        windowMs: 1_000,
        maxConnectionsPerClient: 5,
      });
    });

    afterEach(() => {
      limiter.destroy();
    });

    it('should enforce strict message limits under burst traffic', () => {
      let allowed = 0;
      let rejected = 0;

      for (let i = 0; i < 100; i++) {
        if (limiter.checkMessageRate('burst-client')) {
          allowed++;
        } else {
          rejected++;
        }
      }

      expect(allowed).toBe(10);
      expect(rejected).toBe(90);
    });

    it('should not allow rate limit circumvention with timing', () => {
      vi.useFakeTimers();

      // Send max messages
      for (let i = 0; i < 10; i++) {
        limiter.checkMessageRate('timing-attacker');
      }

      // Advance time by less than window
      vi.advanceTimersByTime(500);

      // Should still be blocked
      expect(limiter.checkMessageRate('timing-attacker')).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(600);

      // Now should be allowed
      expect(limiter.checkMessageRate('timing-attacker')).toBe(true);

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // Connection flood protection
  // -------------------------------------------------------------------------

  describe('connection flood protection', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({
        maxMessages: 100,
        windowMs: 60_000,
        maxConnectionsPerClient: 3,
      });
    });

    afterEach(() => {
      limiter.destroy();
    });

    it('should prevent connection flooding from a single client', () => {
      expect(limiter.addConnection('flood-client')).toBe(true);
      expect(limiter.addConnection('flood-client')).toBe(true);
      expect(limiter.addConnection('flood-client')).toBe(true);

      // 4th connection should be rejected
      expect(limiter.addConnection('flood-client')).toBe(false);

      // 5th, 6th... all rejected
      expect(limiter.addConnection('flood-client')).toBe(false);
      expect(limiter.addConnection('flood-client')).toBe(false);
    });

    it('should not allow connection count to grow via imbalanced add/remove', () => {
      // The connection count should always reflect the actual state
      limiter.addConnection('careful-client');
      limiter.addConnection('careful-client');

      // Remove 3 times (one more than added)
      limiter.removeConnection('careful-client');
      limiter.removeConnection('careful-client');
      limiter.removeConnection('careful-client');

      // Count should be 0, not negative
      expect(limiter.getConnectionCount('careful-client')).toBe(0);

      // Should still be able to add 3 new connections
      expect(limiter.addConnection('careful-client')).toBe(true);
      expect(limiter.addConnection('careful-client')).toBe(true);
      expect(limiter.addConnection('careful-client')).toBe(true);
      expect(limiter.addConnection('careful-client')).toBe(false);
    });

    it('should isolate connection limits per client', () => {
      // Fill up client-a
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');
      limiter.addConnection('client-a');

      // client-b should be independent
      expect(limiter.addConnection('client-b')).toBe(true);
      expect(limiter.addConnection('client-b')).toBe(true);
      expect(limiter.addConnection('client-b')).toBe(true);
      expect(limiter.addConnection('client-b')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Resource exhaustion via many unique clients
  // -------------------------------------------------------------------------

  describe('many unique clients', () => {
    let limiter: RateLimiter;

    afterEach(() => {
      limiter?.destroy();
    });

    it('should handle 1000 unique clients without performance degradation', () => {
      limiter = new RateLimiter({
        maxMessages: 5,
        windowMs: 60_000,
        maxConnectionsPerClient: 3,
      });

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        limiter.checkMessageRate(`client-${i}`);
        limiter.addConnection(`client-${i}`);
      }

      const elapsed = Date.now() - start;

      // Should complete in under 1 second (generous threshold)
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // -------------------------------------------------------------------------
  // Middleware integration: rate limits applied to WebSocket messages
  // -------------------------------------------------------------------------

  describe('middleware rate limit enforcement', () => {
    let middleware: AuthMiddleware;

    beforeEach(() => {
      middleware = new AuthMiddleware(
        createMockAuthConfig({
          rateLimitMaxMessages: 3,
          rateLimitWindowMs: 60_000,
        }),
      );
    });

    afterEach(() => {
      middleware.destroy();
    });

    it('should reject WebSocket messages after rate limit is hit', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity({ clientId: 'ws-flood' });

      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));

      // First 3 should pass
      expect(middleware.validateMessage(ws, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws, msg)).not.toBeNull();

      // 4th should be rate limited
      expect(middleware.validateMessage(ws, msg)).toBeNull();

      // Verify error was sent
      const mockWs = ws as unknown as MockWebSocket;
      const errors = mockWs.allSentJson<{ error: string }>();
      const rateLimitError = errors.find((e) => e.error === 'rate_limit_exceeded');
      expect(rateLimitError).toBeDefined();
    });

    it('should track rate limits per client identity, not per socket', () => {
      // Two sockets with the same client identity
      const ws1 = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws1.__identity = createMockClientIdentity({ clientId: 'shared-identity' });

      const ws2 = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws2.__identity = createMockClientIdentity({ clientId: 'shared-identity' });

      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));

      // 2 messages from ws1
      expect(middleware.validateMessage(ws1, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws1, msg)).not.toBeNull();

      // 1 message from ws2 (same identity) should hit the limit
      expect(middleware.validateMessage(ws2, msg)).not.toBeNull();

      // ws2's next message should be rate limited
      expect(middleware.validateMessage(ws2, msg)).toBeNull();
    });

    it('should allow different clients independently', () => {
      const ws1 = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws1.__identity = createMockClientIdentity({ clientId: 'client-x' });

      const ws2 = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws2.__identity = createMockClientIdentity({ clientId: 'client-y' });

      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));

      // Exhaust client-x
      middleware.validateMessage(ws1, msg);
      middleware.validateMessage(ws1, msg);
      middleware.validateMessage(ws1, msg);
      expect(middleware.validateMessage(ws1, msg)).toBeNull();

      // client-y should be unaffected
      expect(middleware.validateMessage(ws2, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws2, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws2, msg)).not.toBeNull();
    });
  });
});
