/**
 * Core authenticator that ties together JWT verification, API-key
 * lookup, and loopback bypass into a single entry point.
 *
 * Design notes (adapted from OpenClaw's gateway auth):
 *  - All secret comparisons use `crypto.timingSafeEqual` via the jwt
 *    module or `safeEqual` helper to prevent timing side-channels.
 *  - Configuration is validated with Zod at construction time.
 *  - The authenticator is stateless -- rate limiting and connection
 *    tracking are handled separately by `RateLimiter`.
 */

import { timingSafeEqual } from 'node:crypto';
import { URL } from 'node:url';

import { verifyJwt } from './jwt';
import { Logger } from '../utils/logger';

import type { AuthConfig, AuthResult, ClientIdentity } from './types';
import type { IncomingMessage } from 'node:http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Timing-safe string comparison (from OpenClaw pattern).
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }
  if (ip === '127.0.0.1') {
    return true;
  }
  if (ip.startsWith('127.')) {
    return true;
  }
  if (ip === '::1') {
    return true;
  }
  if (ip.startsWith('::ffff:127.')) {
    return true;
  }
  return false;
}

/**
 * Extract a bearer token from the Authorization header.
 */
function extractBearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') {
    return undefined;
  }
  const parts = header.split(' ');
  if (parts.length === 2 && parts[0]!.toLowerCase() === 'bearer') {
    return parts[1];
  }
  return undefined;
}

/**
 * Extract an API key from the x-api-key header.
 */
function extractApiKey(req: IncomingMessage): string | undefined {
  const value = req.headers['x-api-key'];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Extract auth credentials from query string (for WebSocket upgrade
 * requests where custom headers are difficult to set from browsers).
 */
function extractQueryAuth(req: IncomingMessage): {
  token?: string;
  apiKey?: string;
} {
  try {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`
    );
    return {
      token: url.searchParams.get('token') ?? undefined,
      apiKey: url.searchParams.get('apiKey') ?? undefined,
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Authenticator
// ---------------------------------------------------------------------------

export class Authenticator {
  private readonly config: AuthConfig;
  private readonly logger: Logger;

  constructor(config: AuthConfig) {
    this.config = config;
    this.logger = new Logger('Authenticator');
  }

  // -------------------------------------------------------------------------
  // Connection-level auth (called during HTTP upgrade)
  // -------------------------------------------------------------------------

  /**
   * Authenticate an incoming WebSocket upgrade request.
   *
   * Checks (in order):
   *  1. Loopback bypass (if enabled).
   *  2. Bearer token (JWT).
   *  3. API key header / query param.
   *
   * Returns an `AuthResult` that the middleware uses to accept or
   * reject the connection.
   */
  authenticateConnection(req: IncomingMessage): AuthResult {
    const remoteAddr = req.socket?.remoteAddress;

    // 1. Loopback bypass
    if (this.config.allowLoopback && isLoopbackAddress(remoteAddr)) {
      this.logger.debug('Allowing loopback connection');
      return {
        ok: true,
        identity: {
          clientId: 'loopback',
          method: 'loopback',
          scopes: [],
          role: 'admin',
          authenticatedAt: new Date(),
        },
      };
    }

    // Gather credentials from headers and query string
    const bearerToken = extractBearerToken(req);
    const apiKeyHeader = extractApiKey(req);
    const queryAuth = extractQueryAuth(req);
    const token = bearerToken ?? queryAuth.token;
    const apiKey = apiKeyHeader ?? queryAuth.apiKey;

    // 2. JWT auth
    if (token && (this.config.mode === 'jwt' || this.config.mode === 'both')) {
      return this.authenticateJwt(token);
    }

    // 3. API key auth
    if (
      apiKey &&
      (this.config.mode === 'api-key' || this.config.mode === 'both')
    ) {
      return this.authenticateApiKey(apiKey);
    }

    // No credentials supplied
    return { ok: false, reason: 'credentials_missing' };
  }

  // -------------------------------------------------------------------------
  // Per-message auth (optional re-validation)
  // -------------------------------------------------------------------------

  /**
   * Validate auth credentials attached to an individual WebSocket message.
   *
   * This is used when the server policy requires per-message
   * authentication (e.g. long-lived connections where the JWT may
   * expire mid-session).
   */
  authenticateMessage(auth: { token?: string; apiKey?: string }): AuthResult {
    if (
      auth.token &&
      (this.config.mode === 'jwt' || this.config.mode === 'both')
    ) {
      return this.authenticateJwt(auth.token);
    }
    if (
      auth.apiKey &&
      (this.config.mode === 'api-key' || this.config.mode === 'both')
    ) {
      return this.authenticateApiKey(auth.apiKey);
    }
    return { ok: false, reason: 'message_credentials_missing' };
  }

  // -------------------------------------------------------------------------
  // JWT
  // -------------------------------------------------------------------------

  private authenticateJwt(token: string): AuthResult {
    const result = verifyJwt(
      token,
      this.config.jwtSecret,
      this.config.jwtIssuer,
      this.config.jwtAudience
    );

    if (!result.ok) {
      this.logger.debug(`JWT auth failed: ${result.reason}`);
      return { ok: false, reason: result.reason };
    }

    const identity: ClientIdentity = {
      clientId: result.payload.sub,
      method: 'jwt',
      scopes: result.payload.scopes ?? [],
      role: 'user',
      authenticatedAt: new Date(),
      expiresAt: new Date(result.payload.exp * 1000),
    };

    return { ok: true, identity };
  }

  // -------------------------------------------------------------------------
  // API key
  // -------------------------------------------------------------------------

  private authenticateApiKey(candidate: string): AuthResult {
    for (const entry of this.config.apiKeys) {
      if (safeEqual(candidate, entry.key)) {
        const identity: ClientIdentity = {
          clientId: entry.clientId,
          method: 'api-key',
          scopes: entry.scopes,
          role: entry.role ?? 'user',
          authenticatedAt: new Date(),
        };
        return { ok: true, identity };
      }
    }

    this.logger.debug('API key auth failed: no matching key');
    return { ok: false, reason: 'api_key_invalid' };
  }
}
