/**
 * Tests for the JWT module (src/auth/jwt.ts).
 *
 * Covers:
 *  - Token signing and verification (happy path)
 *  - Expiration enforcement
 *  - Issuer / audience mismatch detection
 *  - Tampered signatures
 *  - Malformed tokens
 *  - Algorithm confusion prevention
 *  - Zod payload validation
 *  - createToken convenience function
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { signJwt, verifyJwt, createToken } from '../../../auth/jwt';
import { createMockJwtPayload, TEST_JWT_SECRET } from '../../helpers';

const ISSUER = 'wundr-orchestrator';
const AUDIENCE = 'wundr-daemon';

describe('JWT module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // signJwt + verifyJwt round-trip
  // -------------------------------------------------------------------------

  describe('signJwt / verifyJwt round-trip', () => {
    it('should sign and verify a valid token', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.sub).toBe(payload.sub);
        expect(result.payload.iss).toBe(ISSUER);
        expect(result.payload.aud).toBe(AUDIENCE);
      }
    });

    it('should preserve optional scopes in the round-trip', () => {
      const payload = createMockJwtPayload({ scopes: ['read', 'write'] });
      const token = signJwt(payload, TEST_JWT_SECRET);
      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.scopes).toEqual(['read', 'write']);
      }
    });

    it('should preserve optional claims in the round-trip', () => {
      const payload = createMockJwtPayload({
        claims: { role: 'admin', tier: 1 },
      });
      const token = signJwt(payload, TEST_JWT_SECRET);
      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.claims).toEqual({ role: 'admin', tier: 1 });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Structural validation
  // -------------------------------------------------------------------------

  describe('structural validation', () => {
    it('should reject token with fewer than 3 parts', () => {
      const result = verifyJwt('only.two', TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_malformed');
      }
    });

    it('should reject token with more than 3 parts', () => {
      const result = verifyJwt('a.b.c.d', TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_malformed');
      }
    });

    it('should reject empty string', () => {
      const result = verifyJwt('', TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_malformed');
      }
    });

    it('should reject token with invalid base64url header', () => {
      const result = verifyJwt(
        '!!!.payload.signature',
        TEST_JWT_SECRET,
        ISSUER,
        AUDIENCE
      );
      expect(result.ok).toBe(false);
      // Could be header_invalid or signature mismatch -- either is acceptable
    });
  });

  // -------------------------------------------------------------------------
  // Algorithm checks
  // -------------------------------------------------------------------------

  describe('algorithm validation', () => {
    it('should reject tokens with algorithm other than HS256', () => {
      // Build a token with HS384 header manually
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS384', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify(createMockJwtPayload())
      ).toString('base64url');
      const fakeSignature = Buffer.from('fake').toString('base64url');
      const token = `${header}.${payload}.${fakeSignature}`;

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_algorithm_unsupported');
      }
    });

    it('should reject tokens with "none" algorithm (algorithm confusion attack)', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify(createMockJwtPayload())
      ).toString('base64url');
      const token = `${header}.${payload}.`;

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_algorithm_unsupported');
      }
    });

    it('should reject tokens with RS256 algorithm (key confusion attack)', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'RS256', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify(createMockJwtPayload())
      ).toString('base64url');
      const fakeSignature = Buffer.from('fake').toString('base64url');
      const token = `${header}.${payload}.${fakeSignature}`;

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_algorithm_unsupported');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Signature verification
  // -------------------------------------------------------------------------

  describe('signature verification', () => {
    it('should reject token signed with different secret', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(
        payload,
        'different-secret-that-is-at-least-32-chars!'
      );

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_signature_invalid');
      }
    });

    it('should reject token with tampered payload', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(payload, TEST_JWT_SECRET);

      // Tamper: replace the payload part with a different sub
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...payload, sub: 'attacker' })
      ).toString('base64url');
      const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const result = verifyJwt(tampered, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_signature_invalid');
      }
    });

    it('should reject token with tampered header', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(payload, TEST_JWT_SECRET);
      const parts = token.split('.');

      // Change header while keeping same signature
      const differentHeader = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'injected' })
      ).toString('base64url');
      const tampered = `${differentHeader}.${parts[1]}.${parts[2]}`;

      const result = verifyJwt(tampered, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_signature_invalid');
      }
    });

    it('should reject token with truncated signature', () => {
      const payload = createMockJwtPayload();
      const token = signJwt(payload, TEST_JWT_SECRET);
      const parts = token.split('.');

      // Truncate signature
      const truncated = `${parts[0]}.${parts[1]}.${parts[2]!.slice(0, 5)}`;

      const result = verifyJwt(truncated, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_signature_invalid');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Expiration
  // -------------------------------------------------------------------------

  describe('expiration', () => {
    it('should reject an expired token', () => {
      const past = Math.floor(Date.now() / 1000) - 100;
      const payload = createMockJwtPayload({ exp: past });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_expired');
      }
    });

    it('should reject a token that expires at the current second', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = createMockJwtPayload({ exp: now });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_expired');
      }
    });

    it('should accept a token that expires in the future', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const payload = createMockJwtPayload({ exp: future });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Issuer / Audience
  // -------------------------------------------------------------------------

  describe('issuer and audience', () => {
    it('should reject token with wrong issuer', () => {
      const payload = createMockJwtPayload({ iss: 'wrong-issuer' });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_issuer_mismatch');
      }
    });

    it('should reject token with wrong audience', () => {
      const payload = createMockJwtPayload({ aud: 'wrong-audience' });
      const token = signJwt(payload, TEST_JWT_SECRET);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_audience_mismatch');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Payload validation (Zod)
  // -------------------------------------------------------------------------

  describe('payload schema validation', () => {
    it('should reject payload missing required fields', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
      ).toString('base64url');
      const invalidPayload = Buffer.from(
        JSON.stringify({ sub: 'test' })
      ).toString('base64url');

      // Sign it with the correct secret so the signature passes
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createHmac } = require('node:crypto');
      const signingInput = `${header}.${invalidPayload}`;
      const signature = createHmac('sha256', TEST_JWT_SECRET)
        .update(signingInput)
        .digest();
      const token = `${signingInput}.${signature.toString('base64url')}`;

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('jwt_payload_schema_invalid');
      }
    });
  });

  // -------------------------------------------------------------------------
  // createToken convenience function
  // -------------------------------------------------------------------------

  describe('createToken', () => {
    it('should create a valid token that can be verified', () => {
      const token = createToken({
        sub: 'my-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.sub).toBe('my-service');
      }
    });

    it('should include scopes when provided', () => {
      const token = createToken({
        sub: 'my-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
        scopes: ['admin', 'write'],
      });

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.scopes).toEqual(['admin', 'write']);
      }
    });

    it('should include custom claims when provided', () => {
      const token = createToken({
        sub: 'my-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
        claims: { tier: 2, region: 'us-east-1' },
      });

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.claims).toEqual({ tier: 2, region: 'us-east-1' });
      }
    });

    it('should set iat to current time', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = createToken({
        sub: 'my-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 3600,
      });
      const after = Math.floor(Date.now() / 1000);

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.iat).toBeGreaterThanOrEqual(before);
        expect(result.payload.iat).toBeLessThanOrEqual(after);
      }
    });

    it('should set exp to iat + expiresInSeconds', () => {
      const token = createToken({
        sub: 'my-service',
        secret: TEST_JWT_SECRET,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresInSeconds: 7200,
      });

      const result = verifyJwt(token, TEST_JWT_SECRET, ISSUER, AUDIENCE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.exp - result.payload.iat).toBe(7200);
      }
    });
  });
});
