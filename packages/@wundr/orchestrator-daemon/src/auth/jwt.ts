/**
 * Minimal HMAC-SHA256 JWT implementation using only Node.js crypto.
 *
 * We intentionally avoid third-party JWT libraries to keep the
 * dependency surface minimal.  This module supports HS256 only, which
 * is the only algorithm the orchestrator daemon needs for
 * service-to-service auth.
 *
 * Timing-safe comparison is used for signature verification to prevent
 * timing side-channel attacks (pattern borrowed from OpenClaw gateway).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { JwtPayloadSchema } from './types';

import type { JwtPayload } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(data: Buffer): string {
  return data.toString('base64url');
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

function jsonBase64UrlEncode(obj: unknown): string {
  return base64UrlEncode(Buffer.from(JSON.stringify(obj), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Create a signed JWT (HS256).
 *
 * @param payload - Claims to embed.
 * @param secret  - HMAC-SHA256 secret (must be >= 32 chars).
 * @returns Encoded JWT string.
 */
export function signJwt(payload: JwtPayload, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = jsonBase64UrlEncode(header);
  const payloadEncoded = jsonBase64UrlEncode(payload);
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export type JwtVerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: string };

/**
 * Verify and decode a JWT (HS256).
 *
 * Performs:
 *  1. Structural validation (three dot-separated parts).
 *  2. Header algorithm check (must be HS256).
 *  3. Timing-safe signature comparison.
 *  4. Expiration check.
 *  5. Issuer / audience validation.
 *  6. Zod schema validation of the payload.
 *
 * @param token    - The raw JWT string.
 * @param secret   - HMAC-SHA256 secret.
 * @param issuer   - Expected `iss` claim.
 * @param audience - Expected `aud` claim.
 */
export function verifyJwt(
  token: string,
  secret: string,
  issuer: string,
  audience: string,
): JwtVerifyResult {
  // 1. Structural check
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'jwt_malformed' };
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts as [string, string, string];

  // 2. Header algorithm check
  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerEncoded).toString('utf-8'));
  } catch {
    return { ok: false, reason: 'jwt_header_invalid' };
  }

  if (header.alg !== 'HS256') {
    return { ok: false, reason: 'jwt_algorithm_unsupported' };
  }

  // 3. Signature verification (timing-safe)
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  const actualSignature = base64UrlDecode(signatureEncoded);

  if (expectedSignature.length !== actualSignature.length) {
    return { ok: false, reason: 'jwt_signature_invalid' };
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return { ok: false, reason: 'jwt_signature_invalid' };
  }

  // 4. Decode payload
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(base64UrlDecode(payloadEncoded).toString('utf-8'));
  } catch {
    return { ok: false, reason: 'jwt_payload_invalid' };
  }

  // 5. Zod validation
  const parsed = JwtPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, reason: 'jwt_payload_schema_invalid' };
  }

  const payload = parsed.data;

  // 6. Expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { ok: false, reason: 'jwt_expired' };
  }

  // 7. Issuer
  if (payload.iss !== issuer) {
    return { ok: false, reason: 'jwt_issuer_mismatch' };
  }

  // 8. Audience
  if (payload.aud !== audience) {
    return { ok: false, reason: 'jwt_audience_mismatch' };
  }

  return { ok: true, payload };
}

// ---------------------------------------------------------------------------
// Token generation helper
// ---------------------------------------------------------------------------

/**
 * Convenience: create a fully-formed signed token for a given subject.
 */
export function createToken(params: {
  sub: string;
  secret: string;
  issuer: string;
  audience: string;
  expiresInSeconds: number;
  scopes?: string[];
  claims?: Record<string, unknown>;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: params.sub,
    iss: params.issuer,
    aud: params.audience,
    iat: now,
    exp: now + params.expiresInSeconds,
    scopes: params.scopes,
    claims: params.claims,
  };
  return signJwt(payload, params.secret);
}
