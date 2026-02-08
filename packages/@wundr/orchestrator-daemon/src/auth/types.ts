/**
 * Authentication types and Zod schemas for WebSocket auth.
 *
 * Defines the configuration surface, token payloads, per-connection
 * identity, and all message-level auth envelopes used by the auth
 * middleware.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Auth configuration schema.
 *
 * Secrets are NEVER hardcoded -- they come from environment variables or
 * an external config file parsed at daemon startup.
 */
export const AuthConfigSchema = z.object({
  /** Auth mode: jwt, api-key, or both. */
  mode: z.enum(['jwt', 'api-key', 'both']).default('both'),

  /** HMAC-SHA256 secret used to sign / verify JWTs. */
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),

  /** JWT issuer claim (iss). */
  jwtIssuer: z.string().default('wundr-orchestrator'),

  /** JWT audience claim (aud). */
  jwtAudience: z.string().default('wundr-daemon'),

  /** Token lifetime in seconds. Default: 1 hour. */
  jwtExpiresInSeconds: z.number().int().positive().default(3600),

  /**
   * Allowed API keys.  Each key maps to a client identifier so logs can
   * attribute actions to a specific caller.
   */
  apiKeys: z.array(
    z.object({
      /** The raw API key value (stored hashed at rest in production). */
      key: z.string().min(32, 'API key must be at least 32 characters'),
      /** Human-readable label for the holder of this key. */
      clientId: z.string(),
      /** Optional list of scopes this key is allowed. Empty = all. */
      scopes: z.array(z.string()).default([]),
    }),
  ).default([]),

  /** Whether to allow unauthenticated connections from loopback addresses. */
  allowLoopback: z.boolean().default(false),

  /** Rate-limit: max messages per window per client. */
  rateLimitMaxMessages: z.number().int().positive().default(100),

  /** Rate-limit: sliding window duration in milliseconds. */
  rateLimitWindowMs: z.number().int().positive().default(60_000),

  /** Rate-limit: max concurrent connections per client identity. */
  maxConnectionsPerClient: z.number().int().positive().default(10),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// ---------------------------------------------------------------------------
// JWT payload
// ---------------------------------------------------------------------------

export const JwtPayloadSchema = z.object({
  /** Subject -- the authenticated principal. */
  sub: z.string(),
  /** Issuer. */
  iss: z.string(),
  /** Audience. */
  aud: z.string(),
  /** Issued-at (epoch seconds). */
  iat: z.number(),
  /** Expiration (epoch seconds). */
  exp: z.number(),
  /** Optional scopes. */
  scopes: z.array(z.string()).optional(),
  /** Optional arbitrary claims. */
  claims: z.record(z.unknown()).optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ---------------------------------------------------------------------------
// Client identity (attached to every authenticated connection)
// ---------------------------------------------------------------------------

export interface ClientIdentity {
  /** The authenticated client id (JWT sub or API-key clientId). */
  clientId: string;
  /** How the client authenticated. */
  method: 'jwt' | 'api-key' | 'loopback';
  /** Scopes available to this client. Empty array = unrestricted. */
  scopes: string[];
  /** When the identity was established. */
  authenticatedAt: Date;
  /** For JWT auth, when the token expires. */
  expiresAt?: Date;
}

// ---------------------------------------------------------------------------
// Auth result
// ---------------------------------------------------------------------------

export interface AuthResult {
  ok: boolean;
  identity?: ClientIdentity;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Authenticated WebSocket message envelope
// ---------------------------------------------------------------------------

/**
 * Every message from a client MAY carry an auth token for per-message
 * validation.  The `auth` field is optional -- connections that were
 * authenticated at upgrade time may omit it if the server policy allows.
 */
export const AuthenticatedMessageSchema = z.object({
  auth: z.object({
    token: z.string().optional(),
    apiKey: z.string().optional(),
  }).optional(),
});

export type AuthenticatedMessage = z.infer<typeof AuthenticatedMessageSchema>;

// ---------------------------------------------------------------------------
// Rate-limit tracker entry
// ---------------------------------------------------------------------------

export interface RateLimitEntry {
  /** Timestamps of messages inside the current window. */
  timestamps: number[];
  /** Number of active connections for this client. */
  connectionCount: number;
}
