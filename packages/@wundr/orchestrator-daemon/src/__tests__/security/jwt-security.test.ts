/**
 * Security regression tests for JWT handling.
 *
 * These tests verify that common JWT attack vectors are properly
 * defended against.  Each test is named after the attack it prevents.
 *
 * References:
 *  - OWASP JWT Cheat Sheet
 *  - RFC 7519 (JSON Web Token)
 *  - CVE-2015-9235 (algorithm confusion)
 */

import { createHmac } from 'node:crypto';

import { describe, it, expect, vi, afterEach } from 'vitest';

import { Authenticator } from '../../auth/authenticator';
import { signJwt, verifyJwt } from '../../auth/jwt';
import {
  createMockAuthConfig,
  createMockIncomingMessage,
  createMockJwtPayload,
  TEST_JWT_SECRET,
} from '../helpers';

const ISSUER = 'wundr-orchestrator';
const AUDIENCE = 'wundr-daemon';

describe('JWT Security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Algorithm confusion attacks
  // -------------------------------------------------------------------------

  describe('algorithm confusion (CVE-2015-9235)', () => {
    it('should reject "none" algorithm (bypass signature verification)', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify(createMockJwtPayload())
      ).toString('base64url');

      // No signature, or empty signature
      const tokenNoSig = `${header}.${payload}.`;
      const tokenEmptySig = `${header}.${payload}.e30`;

      expect(verifyJwt(tokenNoSig, TEST_JWT_SECRET, ISSUER, AUDIENCE).ok).toBe(
        false
      );
      expect(
        verifyJwt(tokenEmptySig, TEST_JWT_SECRET, ISSUER, AUDIENCE).ok
      ).toBe(false);
    });

    it('should reject RS256 (asymmetric key confusion with HMAC secret)', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify(createMockJwtPayload())
      ).toString('base64url');

      // An attacker might try to sign with the public key as HMAC secret
      const sigInput = `${header}.${payload}`;
      const sig = createHmac('sha256', TEST_JWT_SECRET)
        .update(sigInput)
        .digest()
        .toString('base64url');
      const token = `${sigInput}.${sig}`;

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should only accept HS256 algorithm', () => {
      const algorithms = [
        'HS384',
        'HS512',
        'RS256',
        'RS384',
        'RS512',
        'ES256',
        'PS256',
        'none',
      ];

      for (const alg of algorithms) {
        const header = Buffer.from(
          JSON.stringify({ alg, typ: 'JWT' })
        ).toString('base64url');
        const payload = Buffer.from(
          JSON.stringify(createMockJwtPayload())
        ).toString('base64url');
        const sig = Buffer.from('fake-signature').toString('base64url');
        const token = `${header}.${payload}.${sig}`;

        const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
        expect(result.ok).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Signature manipulation
  // -------------------------------------------------------------------------

  describe('signature manipulation', () => {
    it('should detect single-bit flip in signature', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(payload, TEST_JWT_SECRET);

      // Flip a single character in the signature
      const parts = token.split('.');
      const sig = parts[2]!;
      const flipped = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
      const tampered = `${parts[0]}.${parts[1]}.${flipped}`;

      const result = verifyJwt(tampered, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should detect payload field modification', () => {
      const payload = createMockJwtPayload({ sub: 'legitimate-user' });
      const token = signJwt(payload, TEST_JWT_SECRET);

      // Attacker tries to change sub to "admin"
      const parts = token.split('.');
      const modifiedPayload = { ...payload, sub: 'admin' };
      const newPayloadEncoded = Buffer.from(
        JSON.stringify(modifiedPayload)
      ).toString('base64url');
      const tampered = `${parts[0]}.${newPayloadEncoded}.${parts[2]}`;

      const result = verifyJwt(tampered, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should detect scope escalation in payload', () => {
      const payload = createMockJwtPayload({ scopes: ['read'] });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const parts = token.split('.');
      const escalatedPayload = {
        ...payload,
        scopes: ['read', 'admin', 'delete'],
      };
      const newPayloadEncoded = Buffer.from(
        JSON.stringify(escalatedPayload)
      ).toString('base64url');
      const tampered = `${parts[0]}.${newPayloadEncoded}.${parts[2]}`;

      const result = verifyJwt(tampered, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Token reuse / replay
  // -------------------------------------------------------------------------

  describe('token expiration enforcement', () => {
    it('should reject token immediately after expiry', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createMockJwtPayload({ exp: now - 1 });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_expired');
      }
    });

    it('should reject token with exp=0 (epoch)', () => {
      const payload = createMockJwtPayload({ exp: 0 });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should reject token with negative exp', () => {
      const payload = createMockJwtPayload({ exp: -1 });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Issuer / audience spoofing
  // -------------------------------------------------------------------------

  describe('issuer and audience spoofing', () => {
    it('should reject token from a different issuer (cross-service attack)', () => {
      const payload = createMockJwtPayload({ iss: 'malicious-service' });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_issuer_mismatch');
      }
    });

    it('should reject token intended for different audience', () => {
      const payload = createMockJwtPayload({ aud: 'different-service' });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_audience_mismatch');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Malformed input handling
  // -------------------------------------------------------------------------

  describe('malformed input resilience', () => {
    it('should handle extremely long token gracefully', () => {
      const longPayload = 'A'.repeat(100_000);
      const token = `header.${longPayload}.signature`;

      // Should not throw, just return error
      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should handle null bytes in token', () => {
      const token = 'header\x00.payload\x00.signature\x00';
      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should handle unicode in token parts', () => {
      const token = '\u0000.\u0000.\u0000';
      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });

    it('should handle empty parts', () => {
      const result = verifyJwt('..', TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: Authenticator + JWT security
  // -------------------------------------------------------------------------

  describe('authenticator JWT integration security', () => {
    it('should not leak internal error details to clients', () => {
      const auth = new Authenticator(createMockAuthConfig({ mode: 'jwt' }));

      const req = createMockIncomingMessage({
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      const result = auth.authenticateConnection(req);

      expect(result.ok).toBe(false);
      // Reason should be a code, not a stack trace
      expect(result.reason).toMatch(/^jwt_/);
      expect(result.reason).not.toContain('Error');
      expect(result.reason).not.toContain('at ');
    });
  });
});
