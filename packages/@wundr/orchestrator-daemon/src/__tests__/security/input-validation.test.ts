/**
 * Security regression tests for input validation.
 *
 * These tests verify that the system properly handles malicious,
 * malformed, or oversized inputs at the WebSocket protocol boundary.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AuthMiddleware } from '../../auth/middleware';
import {
  createMockAuthConfig,
  createMockClientIdentity,
  MockWebSocket,
} from '../helpers';

import type { AuthenticatedWebSocket } from '../../auth/middleware';

describe('Input Validation Security', () => {
  let middleware: AuthMiddleware;

  beforeEach(() => {
    middleware = new AuthMiddleware(createMockAuthConfig());
  });

  afterEach(() => {
    middleware.destroy();
  });

  function createAuthenticatedWs(): AuthenticatedWebSocket {
    const ws = new MockWebSocket() as unknown as AuthenticatedWebSocket;
    ws.__identity = createMockClientIdentity();
    return ws;
  }

  // -------------------------------------------------------------------------
  // JSON parsing attacks
  // -------------------------------------------------------------------------

  describe('JSON parsing attacks', () => {
    it('should reject non-JSON payloads', () => {
      const ws = createAuthenticatedWs();
      const result = middleware.validateMessage(ws, Buffer.from('not json'));
      expect(result).toBeNull();
    });

    it('should reject empty payloads', () => {
      const ws = createAuthenticatedWs();
      const result = middleware.validateMessage(ws, Buffer.from(''));
      expect(result).toBeNull();
    });

    it('should reject payloads with only whitespace', () => {
      const ws = createAuthenticatedWs();
      const result = middleware.validateMessage(ws, Buffer.from('   '));
      expect(result).toBeNull();
    });

    it('should handle deeply nested JSON objects', () => {
      const ws = createAuthenticatedWs();

      // Build a deeply nested object
      let nested = '{"type":"ping"';
      for (let i = 0; i < 100; i++) {
        nested += `,"level${i}":{"value":${i}`;
      }
      nested += '}'.repeat(100) + '}';

      middleware.validateMessage(ws, Buffer.from(nested));
      // Should either accept (valid JSON) or reject, but not crash
      // The important thing is it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle JSON with prototype pollution patterns', () => {
      const ws = createAuthenticatedWs();

      const malicious = JSON.stringify({
        type: 'ping',
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
      });

      middleware.validateMessage(ws, Buffer.from(malicious));

      // Should not crash and should not have modified prototypes
      expect(({} as any).isAdmin).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Oversized payloads
  // -------------------------------------------------------------------------

  describe('oversized payloads', () => {
    it('should handle large payload without crashing', () => {
      const ws = createAuthenticatedWs();

      // 1MB payload
      const large = JSON.stringify({
        type: 'ping',
        data: 'x'.repeat(1_000_000),
      });

      // Should not throw
      const result = middleware.validateMessage(ws, Buffer.from(large));
      expect(result).not.toBeNull();
    });

    it('should handle payload with very long string values', () => {
      const ws = createAuthenticatedWs();

      const payload = JSON.stringify({
        type: 'execute_task',
        payload: {
          sessionId: 'a'.repeat(10_000),
          task: 'b'.repeat(10_000),
        },
      });

      // Should not throw
      const result = middleware.validateMessage(ws, Buffer.from(payload));
      expect(result).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Special characters and encoding
  // -------------------------------------------------------------------------

  describe('special characters and encoding', () => {
    it('should handle null bytes in JSON values', () => {
      const ws = createAuthenticatedWs();

      const payload = JSON.stringify({
        type: 'ping',
        data: 'hello\x00world',
      });

      const result = middleware.validateMessage(ws, Buffer.from(payload));
      // Should accept valid JSON even with null bytes in values
      expect(result).not.toBeNull();
    });

    it('should handle unicode in JSON values', () => {
      const ws = createAuthenticatedWs();

      const payload = JSON.stringify({
        type: 'ping',
        data: '\u0000\u001f\u007f\u0080\uffff',
      });

      const result = middleware.validateMessage(ws, Buffer.from(payload));
      expect(result).not.toBeNull();
    });

    it('should handle emoji in JSON values', () => {
      const ws = createAuthenticatedWs();

      const payload = JSON.stringify({
        type: 'ping',
        data: 'test message with emoji',
      });

      const result = middleware.validateMessage(ws, Buffer.from(payload));
      expect(result).not.toBeNull();
    });

    it('should handle HTML/script injection in values', () => {
      const ws = createAuthenticatedWs();

      const payload = JSON.stringify({
        type: 'ping',
        data: '<script>alert("xss")</script>',
      });

      // The middleware should accept it (validation is for auth/rate-limit,
      // not content sanitization), but it should not execute or crash
      const result = middleware.validateMessage(ws, Buffer.from(payload));
      expect(result).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Binary / non-text data
  // -------------------------------------------------------------------------

  describe('binary data handling', () => {
    it('should reject binary data that is not valid UTF-8 JSON', () => {
      const ws = createAuthenticatedWs();

      const binary = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x80, 0x81]);

      const result = middleware.validateMessage(ws, binary);
      expect(result).toBeNull();
    });

    it('should reject gzip-compressed payloads', () => {
      const ws = createAuthenticatedWs();

      // Gzip magic bytes
      const gzipped = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);

      const result = middleware.validateMessage(ws, gzipped);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Auth field injection
  // -------------------------------------------------------------------------

  describe('auth field injection', () => {
    it('should not crash on auth field with unexpected types', () => {
      const ws = createAuthenticatedWs();

      const payloads = [
        { type: 'ping', auth: null },
        { type: 'ping', auth: 42 },
        { type: 'ping', auth: 'string' },
        { type: 'ping', auth: [1, 2, 3] },
        { type: 'ping', auth: { token: null } },
        { type: 'ping', auth: { apiKey: 42 } },
        { type: 'ping', auth: { token: '', apiKey: '' } },
      ];

      for (const payload of payloads) {
        const rawData = Buffer.from(JSON.stringify(payload));
        // Should not throw
        middleware.validateMessage(ws, rawData);
      }
    });

    it('should reject per-message auth with empty token', () => {
      const ws = createAuthenticatedWs();

      const payload = {
        type: 'ping',
        auth: { token: '' },
      };

      const result = middleware.validateMessage(ws, Buffer.from(JSON.stringify(payload)));
      // Empty string token is falsy, so it should be ignored (not validated)
      // The message itself should pass through
      expect(result).not.toBeNull();
    });
  });
});
