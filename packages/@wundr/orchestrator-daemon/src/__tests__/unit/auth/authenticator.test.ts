/**
 * Tests for the Authenticator class (src/auth/authenticator.ts).
 *
 * Covers:
 *  - JWT-based connection authentication
 *  - API-key-based connection authentication
 *  - Loopback bypass
 *  - Credentials extracted from headers
 *  - Credentials extracted from query parameters
 *  - Per-message authentication
 *  - Missing / invalid credentials
 *  - Auth mode enforcement (jwt-only, api-key-only, both)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { Authenticator } from '../../../auth/authenticator';
import { createToken } from '../../../auth/jwt';
import {
  createMockAuthConfig,
  createMockIncomingMessage,
  TEST_JWT_SECRET,
  TEST_API_KEY,
} from '../../helpers';
import { FIXTURES } from '../../helpers/test-fixtures';

const ISSUER = 'wundr-orchestrator';
const AUDIENCE = 'wundr-daemon';

describe('Authenticator', () => {
  // -------------------------------------------------------------------------
  // JWT authentication
  // -------------------------------------------------------------------------

  describe('JWT authentication', () => {
    let auth: Authenticator;

    beforeEach(() => {
      auth = new Authenticator(createMockAuthConfig({ mode: 'jwt' }));
    });

    it('should authenticate with a valid bearer token', () => {
      const token = createToken({
        sub: 'service-a',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('service-a');
      expect(result.identity?.method).toBe('jwt');
      expect(result.identity?.expiresAt).toBeDefined();
    });

    it('should authenticate with token in query parameter', () => {
      const token = createToken({
        sub: 'browser-client',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        url: `/?token=${token}`,
        headers: { host: 'localhost:8787' },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('browser-client');
    });

    it('should reject an expired JWT', () => {
      const token = createToken({
        sub: 'service-a',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: -100, // already expired
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('jwt_expired');
    });

    it('should reject a JWT signed with the wrong secret', () => {
      const token = createToken({
        sub: 'service-a',
        secret: 'wrong-secret-that-is-at-least-32-characters!',
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('jwt_signature_invalid');
    });

    it('should ignore API key when mode is jwt-only', () => {
      const req = createMockIncomingMessage({
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('credentials_missing');
    });

    it('should preserve scopes from JWT payload', () => {
      const token = createToken({
        sub: 'scoped-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
        scopes: ['read', 'execute'],
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.scopes).toEqual(['read', 'execute']);
    });
  });

  // -------------------------------------------------------------------------
  // API key authentication
  // -------------------------------------------------------------------------

  describe('API key authentication', () => {
    let auth: Authenticator;

    beforeEach(() => {
      auth = new Authenticator(createMockAuthConfig({ mode: 'api-key' }));
    });

    it('should authenticate with valid x-api-key header', () => {
      const req = createMockIncomingMessage({
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('test-client');
      expect(result.identity?.method).toBe('api-key');
    });

    it('should authenticate with API key in query parameter', () => {
      const req = createMockIncomingMessage({
        url: `/?apiKey=${TEST_API_KEY}`,
        headers: { host: 'localhost:8787' },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('test-client');
    });

    it('should reject invalid API key', () => {
      const req = createMockIncomingMessage({
        headers: { 'x-api-key': 'invalid-key-that-is-long-enough-for-the-minimum' },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('api_key_invalid');
    });

    it('should match correct key among multiple configured keys', () => {
      const secondKey = 'second-api-key-at-least-32-characters-long!';
      auth = new Authenticator(
        createMockAuthConfig({
          mode: 'api-key',
          apiKeys: [
            { key: TEST_API_KEY, clientId: 'alpha', scopes: [] },
            { key: secondKey, clientId: 'bravo', scopes: ['read'] },
          ],
        }),
      );

      const req = createMockIncomingMessage({
        headers: { 'x-api-key': secondKey },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('bravo');
      expect(result.identity?.scopes).toEqual(['read']);
    });

    it('should ignore JWT when mode is api-key-only', () => {
      const token = createToken({
        sub: 'service-a',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('credentials_missing');
    });
  });

  // -------------------------------------------------------------------------
  // Both mode
  // -------------------------------------------------------------------------

  describe('both mode', () => {
    let auth: Authenticator;

    beforeEach(() => {
      auth = new Authenticator(createMockAuthConfig({ mode: 'both' }));
    });

    it('should authenticate with JWT in both mode', () => {
      const token = createToken({
        sub: 'jwt-client',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        headers: { authorization: `Bearer ${token}` },
      });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(true);
      expect(result.identity?.method).toBe('jwt');
    });

    it('should authenticate with API key in both mode', () => {
      const req = createMockIncomingMessage({
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(true);
      expect(result.identity?.method).toBe('api-key');
    });

    it('should prefer JWT over API key when both are provided', () => {
      const token = createToken({
        sub: 'jwt-user',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const req = createMockIncomingMessage({
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-key': TEST_API_KEY,
        },
      });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(true);
      expect(result.identity?.method).toBe('jwt');
      expect(result.identity?.clientId).toBe('jwt-user');
    });
  });

  // -------------------------------------------------------------------------
  // Loopback bypass
  // -------------------------------------------------------------------------

  describe('loopback bypass', () => {
    it('should allow unauthenticated connections from 127.0.0.1 when enabled', () => {
      const auth = new Authenticator(createMockAuthConfig({ allowLoopback: true }));

      const req = createMockIncomingMessage({ remoteAddress: '127.0.0.1' });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('loopback');
      expect(result.identity?.method).toBe('loopback');
    });

    it('should allow unauthenticated connections from ::1 (IPv6 loopback)', () => {
      const auth = new Authenticator(createMockAuthConfig({ allowLoopback: true }));

      const req = createMockIncomingMessage({ remoteAddress: '::1' });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(true);
      expect(result.identity?.method).toBe('loopback');
    });

    it('should allow connections from IPv4-mapped loopback (::ffff:127.0.0.1)', () => {
      const auth = new Authenticator(createMockAuthConfig({ allowLoopback: true }));

      const req = createMockIncomingMessage({ remoteAddress: '::ffff:127.0.0.1' });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(true);
    });

    it('should reject loopback when allowLoopback is false', () => {
      const auth = new Authenticator(createMockAuthConfig({ allowLoopback: false }));

      const req = createMockIncomingMessage({ remoteAddress: '127.0.0.1' });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(false);
    });

    it('should not treat external IPs as loopback', () => {
      const auth = new Authenticator(createMockAuthConfig({ allowLoopback: true }));

      const req = createMockIncomingMessage({ remoteAddress: '192.168.1.100' });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('credentials_missing');
    });
  });

  // -------------------------------------------------------------------------
  // Missing / malformed credentials
  // -------------------------------------------------------------------------

  describe('missing credentials', () => {
    let auth: Authenticator;

    beforeEach(() => {
      auth = new Authenticator(createMockAuthConfig());
    });

    it('should reject request with no auth headers', () => {
      const req = createMockIncomingMessage();

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('credentials_missing');
    });

    it('should reject malformed Authorization header (missing Bearer prefix)', () => {
      const req = createMockIncomingMessage({
        headers: { authorization: 'Token some-token' },
      });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(false);
    });

    it('should reject Authorization header with empty Bearer value', () => {
      const req = createMockIncomingMessage({
        headers: { authorization: 'Bearer ' },
      });

      const result = auth.authenticateConnection(req);
      expect(result.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Per-message authentication
  // -------------------------------------------------------------------------

  describe('authenticateMessage', () => {
    let auth: Authenticator;

    beforeEach(() => {
      auth = new Authenticator(createMockAuthConfig({ mode: 'both' }));
    });

    it('should authenticate message with valid JWT token', () => {
      const token = createToken({
        sub: 'msg-user',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const result = auth.authenticateMessage({ token });

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('msg-user');
    });

    it('should authenticate message with valid API key', () => {
      const result = auth.authenticateMessage({ apiKey: TEST_API_KEY });

      expect(result.ok).toBe(true);
      expect(result.identity?.clientId).toBe('test-client');
    });

    it('should reject message with no credentials', () => {
      const result = auth.authenticateMessage({});

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('message_credentials_missing');
    });

    it('should reject message with expired JWT token', () => {
      const token = createToken({
        sub: 'msg-user',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: -100,
      });

      const result = auth.authenticateMessage({ token });
      expect(result.ok).toBe(false);
    });
  });
});
