/**
 * Authentication types and Zod schemas for WebSocket auth.
 *
 * Defines the configuration surface, token payloads, per-connection
 * identity, role-based access control, session tracking, and all
 * message-level auth envelopes used by the auth middleware.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Role hierarchy for role-based access control.
 *
 * - `admin`    : Full access -- can spawn sessions, execute tasks, manage
 *                daemon configuration, and view all sessions.
 * - `user`     : Standard access -- can spawn sessions, execute tasks on
 *                own sessions, and view own session data.
 * - `readonly` : Read-only access -- can view session status, daemon
 *                status, and list sessions.  Cannot spawn or execute.
 */
export type Role = 'admin' | 'user' | 'readonly';

/** All valid roles ordered by privilege level (highest first). */
export const ROLES: readonly Role[] = ['admin', 'user', 'readonly'] as const;

/**
 * Maps each role to the set of message types it is allowed to send.
 * An empty array means "all types are allowed" (unrestricted).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  admin: [],  // unrestricted
  user: [
    'ping',
    'health_check',
    'spawn_session',
    'execute_task',
    'session_status',
    'stop_session',
    'list_sessions',
    'daemon_status',
    'token_refresh',
  ],
  readonly: [
    'ping',
    'health_check',
    'session_status',
    'list_sessions',
    'daemon_status',
    'token_refresh',
  ],
};

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
      /** Optional role override for this API key. Default: 'user'. */
      role: z.enum(['admin', 'user', 'readonly']).default('user'),
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

  /** Rate-limit: max upgrade requests per IP per window. Default: 20. */
  rateLimitMaxUpgradesPerIp: z.number().int().positive().default(20),

  /** Rate-limit: upgrade window duration in milliseconds. Default: 60s. */
  rateLimitUpgradeWindowMs: z.number().int().positive().default(60_000),

  /**
   * Token refresh: minimum remaining lifetime (seconds) before a refresh
   * is permitted.  Prevents abuse by only allowing refresh when the token
   * is close to expiry.  Default: token must have <= 5 minutes remaining.
   */
  tokenRefreshThresholdSeconds: z.number().int().nonnegative().default(300),
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
  /** Role assigned to this client for RBAC. Default: 'user'. */
  role: Role;
  /** When the identity was established. */
  authenticatedAt: Date;
  /** For JWT auth, when the token expires. */
  expiresAt?: Date;
  /** The remote IP address of the client (for per-IP rate limiting). */
  remoteIp?: string;
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

// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------

/**
 * Tracks which authenticated client owns which WebSocket sessions.
 * Enables attribution of sessions to users and enforces that users
 * can only interact with their own sessions (unless admin).
 */
export interface SessionOwnership {
  /** The session ID. */
  sessionId: string;
  /** The client ID that owns the session. */
  clientId: string;
  /** When the session was created by this client. */
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Token refresh request message envelope.
 */
export const TokenRefreshRequestSchema = z.object({
  type: z.literal('token_refresh'),
});

export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;

/**
 * Token refresh response sent back to the client.
 */
export interface TokenRefreshResponse {
  type: 'token_refresh_response';
  token: string;
  expiresAt: string;  // ISO 8601
}
