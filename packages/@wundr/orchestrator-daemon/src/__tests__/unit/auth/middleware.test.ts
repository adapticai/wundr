/**
 * Tests for the AuthMiddleware class (src/auth/middleware.ts).
 *
 * Covers:
 *  - validateMessage: identity check, rate limiting, JSON parsing, per-message auth
 *  - getIdentity: returns attached identity
 *  - getRemainingMessages: delegates to rate limiter
 *  - sendError: sends JSON error to open sockets
 *  - Token expiry detection on long-lived connections
 *  - destroy: cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createToken } from '../../../auth/jwt';
import { AuthMiddleware } from '../../../auth/middleware';
import {
  createMockAuthConfig,
  createMockClientIdentity,
  MockWebSocket,
  TEST_JWT_SECRET,
  TEST_API_KEY,
} from '../../helpers';

import type { AuthenticatedWebSocket } from '../../../auth/middleware';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;

  afterEach(() => {
    middleware?.destroy();
  });

  // -------------------------------------------------------------------------
  // validateMessage
  // -------------------------------------------------------------------------

  describe('validateMessage', () => {
    beforeEach(() => {
      middleware = new AuthMiddleware(createMockAuthConfig());
    });

    it('should accept a valid JSON message from an authenticated socket', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity();

      const payload = { type: 'ping' };
      const rawData = Buffer.from(JSON.stringify(payload));

      const result = middleware.validateMessage(ws, rawData);

      expect(result).not.toBeNull();
      expect(result?.payload).toEqual(payload);
      expect(result?.identity.clientId).toBe('test-client');
    });

    it('should reject message from socket without identity', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      // No __identity set

      const rawData = Buffer.from(JSON.stringify({ type: 'ping' }));

      const result = middleware.validateMessage(ws, rawData);

      expect(result).toBeNull();
      // Should have sent error
      const mockWs = ws as unknown as MockWebSocket;
      expect(mockWs.sentMessages.length).toBeGreaterThan(0);
      const error = JSON.parse(mockWs.sentMessages[0]!);
      expect(error.error).toBe('not_authenticated');
    });

    it('should reject invalid JSON', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity();

      const rawData = Buffer.from('not valid json {{}}');

      const result = middleware.validateMessage(ws, rawData);

      expect(result).toBeNull();
      const mockWs = ws as unknown as MockWebSocket;
      const error = JSON.parse(mockWs.sentMessages[0]!);
      expect(error.error).toBe('invalid_json');
    });

    it('should reject when rate limit is exceeded', () => {
      middleware = new AuthMiddleware(
        createMockAuthConfig({
          rateLimitMaxMessages: 2,
          rateLimitWindowMs: 60_000,
        })
      );

      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity({ clientId: 'rate-test' });

      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));

      // First two should pass
      expect(middleware.validateMessage(ws, msg)).not.toBeNull();
      expect(middleware.validateMessage(ws, msg)).not.toBeNull();

      // Third should be rate-limited
      const result = middleware.validateMessage(ws, msg);
      expect(result).toBeNull();

      const mockWs = ws as unknown as MockWebSocket;
      const lastError = JSON.parse(
        mockWs.sentMessages[mockWs.sentMessages.length - 1]!
      );
      expect(lastError.error).toBe('rate_limit_exceeded');
    });

    it('should validate per-message JWT token when present', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity();

      const validToken = createToken({
        sub: 'msg-user',
        secret: TEST_JWT_SECRET,
        issuer: 'wundr-orchestrator',
        audience: 'wundr-daemon',
        expiresInSeconds: 3600,
      });

      const payload = {
        type: 'ping',
        auth: { token: validToken },
      };
      const rawData = Buffer.from(JSON.stringify(payload));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).not.toBeNull();
    });

    it('should reject per-message auth with invalid token', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity();

      const payload = {
        type: 'ping',
        auth: { token: 'invalid.jwt.token' },
      };
      const rawData = Buffer.from(JSON.stringify(payload));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).toBeNull();
    });

    it('should validate per-message API key when present', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity();

      const payload = {
        type: 'ping',
        auth: { apiKey: TEST_API_KEY },
      };
      const rawData = Buffer.from(JSON.stringify(payload));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).not.toBeNull();
    });

    it('should reject expired token on long-lived connection', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity({
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      });

      const rawData = Buffer.from(JSON.stringify({ type: 'ping' }));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).toBeNull();

      const mockWs = ws as unknown as MockWebSocket;
      const lastError = JSON.parse(
        mockWs.sentMessages[mockWs.sentMessages.length - 1]!
      );
      expect(lastError.error).toBe('token_expired');

      // Should also close the socket
      expect(mockWs.closeCode).toBe(4001);
    });

    it('should not reject non-expired token on long-lived connection', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity({
        expiresAt: new Date(Date.now() + 3600_000), // expires in 1h
      });

      const rawData = Buffer.from(JSON.stringify({ type: 'ping' }));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).not.toBeNull();
    });

    it('should not send error if socket is not open', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      // No identity, and socket is closed
      (ws as unknown as MockWebSocket).readyState = MockWebSocket.CLOSED;

      const rawData = Buffer.from(JSON.stringify({ type: 'ping' }));

      const result = middleware.validateMessage(ws, rawData);
      expect(result).toBeNull();
      // No error sent because socket is closed
      expect((ws as unknown as MockWebSocket).sentMessages.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getIdentity
  // -------------------------------------------------------------------------

  describe('getIdentity', () => {
    beforeEach(() => {
      middleware = new AuthMiddleware(createMockAuthConfig());
    });

    it('should return attached identity', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      const identity = createMockClientIdentity({ clientId: 'my-client' });
      ws.__identity = identity;

      expect(middleware.getIdentity(ws)).toEqual(identity);
    });

    it('should return undefined for socket without identity', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;

      expect(middleware.getIdentity(ws)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getRemainingMessages
  // -------------------------------------------------------------------------

  describe('getRemainingMessages', () => {
    beforeEach(() => {
      middleware = new AuthMiddleware(
        createMockAuthConfig({ rateLimitMaxMessages: 10 })
      );
    });

    it('should return full allowance for new client', () => {
      expect(middleware.getRemainingMessages('new-client')).toBe(10);
    });

    it('should decrement after message validation', () => {
      const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
      ws.__identity = createMockClientIdentity({ clientId: 'count-client' });

      const msg = Buffer.from(JSON.stringify({ type: 'ping' }));
      middleware.validateMessage(ws, msg);
      middleware.validateMessage(ws, msg);

      expect(middleware.getRemainingMessages('count-client')).toBe(8);
    });
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------

  describe('destroy', () => {
    it('should clean up without errors', () => {
      middleware = new AuthMiddleware(createMockAuthConfig());
      expect(() => middleware.destroy()).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      middleware = new AuthMiddleware(createMockAuthConfig());
      middleware.destroy();
      expect(() => middleware.destroy()).not.toThrow();
    });
  });
});
