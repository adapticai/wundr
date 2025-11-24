/**
 * @genesis/core - Daemon Type Definitions
 *
 * Type definitions for VP daemon authentication, authorization,
 * and communication with the Genesis platform.
 *
 * This module defines the type system for daemon-based authentication,
 * including credentials management, JWT tokens, sessions, and events.
 *
 * @packageDocumentation
 */

// =============================================================================
// Daemon Scope Types
// =============================================================================

/**
 * OAuth2-like scopes for daemon permissions.
 * These control what operations a daemon can perform on behalf of a VP.
 */
export type DaemonScope =
  | 'messages:read'     // Read messages in channels
  | 'messages:write'    // Send messages to channels
  | 'channels:read'     // List and view channel information
  | 'channels:join'     // Join/leave channels
  | 'users:read'        // View user information
  | 'presence:read'     // Read presence status
  | 'presence:write'    // Update presence status
  | 'files:read'        // Read file metadata
  | 'files:write'       // Upload files
  | 'calls:join'        // Join voice/video calls
  | 'calls:manage'      // Create/manage calls
  | 'vp:status'         // Update VP status
  | 'vp:config'         // Read VP configuration
  | 'admin:read'        // Admin read operations
  | 'admin:write';      // Admin write operations

/**
 * Predefined scope sets for common use cases.
 */
export const DAEMON_SCOPE_SETS = {
  /** Basic messaging capabilities */
  messaging: ['messages:read', 'messages:write', 'channels:read'] as DaemonScope[],
  /** Full communication capabilities */
  communication: [
    'messages:read',
    'messages:write',
    'channels:read',
    'channels:join',
    'presence:read',
    'presence:write',
  ] as DaemonScope[],
  /** All standard VP capabilities */
  standard: [
    'messages:read',
    'messages:write',
    'channels:read',
    'channels:join',
    'users:read',
    'presence:read',
    'presence:write',
    'files:read',
    'vp:status',
    'vp:config',
  ] as DaemonScope[],
  /** Full access for enterprise VPs */
  full: [
    'messages:read',
    'messages:write',
    'channels:read',
    'channels:join',
    'users:read',
    'presence:read',
    'presence:write',
    'files:read',
    'files:write',
    'calls:join',
    'calls:manage',
    'vp:status',
    'vp:config',
  ] as DaemonScope[],
} as const;

// =============================================================================
// Daemon Token Types
// =============================================================================

/**
 * Token type enumeration.
 */
export type DaemonTokenType = 'access' | 'refresh';

/**
 * Daemon authentication token.
 * Issued after successful authentication, used for API authorization.
 */
export interface DaemonToken {
  /** The JWT or opaque token string */
  token: string;

  /** Token type (access or refresh) */
  type: DaemonTokenType;

  /** When the token expires */
  expiresAt: Date;

  /** The daemon instance ID this token was issued to */
  daemonId: string;

  /** The VP ID this token authenticates */
  vpId: string;

  /** The workspace ID context */
  workspaceId: string;

  /** Scopes granted to this token */
  scopes: DaemonScope[];

  /** Organization ID for multi-tenant validation */
  organizationId?: string;

  /** Session ID for tracking */
  sessionId?: string;
}

/**
 * Token pair returned after authentication.
 */
export interface DaemonTokenPair {
  /** Short-lived access token */
  accessToken: DaemonToken;

  /** Long-lived refresh token */
  refreshToken: DaemonToken;
}

/**
 * JWT payload for daemon tokens.
 */
export interface DaemonTokenPayload {
  /** Subject - VP ID */
  sub: string;

  /** Issuer - Genesis platform */
  iss: string;

  /** Audience - Genesis API */
  aud: string;

  /** Issued at timestamp */
  iat: number;

  /** Expiration timestamp */
  exp: number;

  /** Not before timestamp */
  nbf?: number;

  /** JWT ID for revocation tracking */
  jti: string;

  /** Daemon instance ID */
  daemonId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Organization ID */
  organizationId?: string;

  /** Granted scopes */
  scopes: DaemonScope[];

  /** Token type */
  type: DaemonTokenType;
}

// =============================================================================
// Daemon Authentication Types
// =============================================================================

/**
 * Credentials for daemon authentication.
 */
export interface DaemonCredentials {
  /** VP's API key */
  apiKey: string;

  /** Daemon instance ID (unique per daemon process) */
  daemonId: string;

  /** Requested scopes (must not exceed VP's allowed scopes) */
  requestedScopes?: DaemonScope[];

  /** Additional metadata about the daemon */
  metadata?: DaemonMetadata;
}

/**
 * Metadata about the daemon instance.
 */
export interface DaemonMetadata {
  /** Daemon software version */
  version: string;

  /** Hostname or IP */
  host: string;

  /** Platform/OS information */
  platform?: string;

  /** Runtime information (e.g., Node.js version) */
  runtime?: string;

  /** Capabilities this daemon instance supports */
  capabilities?: string[];

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Result of a successful daemon authentication.
 */
export interface DaemonAuthResult {
  /** Token pair for API access */
  tokens: DaemonTokenPair;

  /** VP information */
  vp: {
    id: string;
    name: string;
    discipline: string;
    role: string;
  };

  /** Workspace information */
  workspace: {
    id: string;
    name: string;
  };

  /** Granted scopes (may be less than requested) */
  grantedScopes: DaemonScope[];

  /** Session information */
  session: {
    id: string;
    createdAt: Date;
    expiresAt: Date;
  };
}

// =============================================================================
// Daemon Session Types
// =============================================================================

/**
 * Daemon session status.
 */
export type DaemonSessionStatus =
  | 'active'      // Session is active and in use
  | 'idle'        // Session is valid but not recently active
  | 'expired'     // Session has expired
  | 'revoked'     // Session was explicitly revoked
  | 'terminated'; // Session was terminated due to error or policy

/**
 * Active daemon session.
 */
export interface DaemonSession {
  /** Unique session ID */
  id: string;

  /** Daemon instance ID */
  daemonId: string;

  /** VP ID */
  vpId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Organization ID */
  organizationId?: string;

  /** Session status */
  status: DaemonSessionStatus;

  /** Granted scopes for this session */
  scopes: DaemonScope[];

  /** When the session was created */
  createdAt: Date;

  /** When the session was last active */
  lastActiveAt: Date;

  /** When the session expires */
  expiresAt: Date;

  /** IP address of the daemon */
  ipAddress?: string;

  /** User agent of the daemon */
  userAgent?: string;

  /** Daemon metadata */
  metadata?: DaemonMetadata;

  /** Metrics from the session */
  metrics?: DaemonMetrics;
}

// =============================================================================
// Daemon Event Types
// =============================================================================

/**
 * Event types that daemons can receive or emit.
 */
export type DaemonEventType =
  // Message events
  | 'message.received'
  | 'message.sent'
  | 'message.updated'
  | 'message.deleted'
  | 'message.reaction'
  // Channel events
  | 'channel.joined'
  | 'channel.left'
  | 'channel.updated'
  | 'channel.member_added'
  | 'channel.member_removed'
  // Presence events
  | 'presence.updated'
  | 'presence.user_online'
  | 'presence.user_offline'
  // Call events
  | 'call.started'
  | 'call.ended'
  | 'call.participant_joined'
  | 'call.participant_left'
  // VP events
  | 'vp.status_changed'
  | 'vp.config_updated'
  | 'vp.mentioned'
  // System events
  | 'system.heartbeat_ack'
  | 'system.rate_limited'
  | 'system.maintenance'
  | 'system.reconnect_required';

/**
 * Base daemon event structure.
 */
export interface DaemonEvent {
  /** Unique event ID */
  id: string;

  /** Event type */
  type: DaemonEventType;

  /** Daemon ID that should receive this event */
  daemonId: string;

  /** VP ID the event is for */
  vpId: string;

  /** Event payload */
  payload: Record<string, unknown>;

  /** When the event was created */
  timestamp: Date;

  /** Workspace context */
  workspaceId?: string;

  /** Channel context */
  channelId?: string;

  /** Whether the event requires acknowledgment */
  requiresAck?: boolean;

  /** Event priority (higher = more important) */
  priority?: number;
}

// =============================================================================
// Daemon Configuration Types
// =============================================================================

/**
 * Runtime configuration for a daemon.
 */
export interface DaemonConfig {
  /** VP ID this config is for */
  vpId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Operational settings */
  settings: {
    /** Maximum concurrent WebSocket connections */
    maxConcurrentConnections: number;

    /** Heartbeat interval in milliseconds */
    heartbeatIntervalMs: number;

    /** Message rate limit per minute */
    messageRateLimitPerMinute: number;

    /** Whether to auto-reconnect on disconnect */
    autoReconnect: boolean;

    /** Log level for daemon operations */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  /** Feature flags */
  features: {
    /** Can send/receive messages */
    messaging: boolean;

    /** Can update presence */
    presence: boolean;

    /** Can join calls */
    calls: boolean;

    /** Can access files */
    fileAccess: boolean;
  };
}

// =============================================================================
// Daemon Metrics Types
// =============================================================================

/**
 * Metrics reported by a daemon.
 */
export interface DaemonMetrics {
  /** Messages sent this session */
  messagesSent?: number;

  /** Messages received this session */
  messagesReceived?: number;

  /** API calls made this session */
  apiCalls?: number;

  /** Errors encountered this session */
  errors?: number;

  /** Average response time in ms */
  avgResponseTimeMs?: number;

  /** Current memory usage in bytes */
  memoryUsageBytes?: number;

  /** Uptime in seconds */
  uptimeSeconds?: number;

  /** Last heartbeat timestamp */
  lastHeartbeat?: Date;

  /** Custom metrics */
  custom?: Record<string, number | string>;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a string is a valid daemon scope.
 */
export function isDaemonScope(value: string): value is DaemonScope {
  const validScopes: DaemonScope[] = [
    'messages:read',
    'messages:write',
    'channels:read',
    'channels:join',
    'users:read',
    'presence:read',
    'presence:write',
    'files:read',
    'files:write',
    'calls:join',
    'calls:manage',
    'vp:status',
    'vp:config',
    'admin:read',
    'admin:write',
  ];
  return validScopes.includes(value as DaemonScope);
}

/**
 * Check if a value is a valid daemon token.
 */
export function isDaemonToken(value: unknown): value is DaemonToken {
  if (typeof value !== 'object' || value === null) return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.token === 'string' &&
    (token.type === 'access' || token.type === 'refresh') &&
    token.expiresAt instanceof Date &&
    typeof token.daemonId === 'string' &&
    typeof token.vpId === 'string' &&
    typeof token.workspaceId === 'string' &&
    Array.isArray(token.scopes)
  );
}

/**
 * Check if a value is a valid daemon session.
 */
export function isDaemonSession(value: unknown): value is DaemonSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === 'string' &&
    typeof session.daemonId === 'string' &&
    typeof session.vpId === 'string' &&
    typeof session.workspaceId === 'string' &&
    typeof session.status === 'string'
  );
}

/**
 * Check if a value is a valid daemon event.
 */
export function isDaemonEvent(value: unknown): value is DaemonEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.daemonId === 'string' &&
    typeof event.vpId === 'string' &&
    typeof event.payload === 'object'
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default token expiration times.
 */
export const DAEMON_TOKEN_EXPIRY = {
  /** Access token lifetime in seconds (1 hour) */
  accessTokenSeconds: 3600,

  /** Refresh token lifetime in seconds (7 days) */
  refreshTokenSeconds: 604800,

  /** Session lifetime in seconds (24 hours) */
  sessionSeconds: 86400,
} as const;

/**
 * Redis key patterns for daemon data.
 */
export const DAEMON_REDIS_KEYS = {
  /** Session key pattern */
  session: (sessionId: string) => `daemon:session:${sessionId}`,

  /** Sessions by VP */
  vpSessions: (vpId: string) => `daemon:vp:${vpId}:sessions`,

  /** Sessions by daemon */
  daemonSessions: (daemonId: string) => `daemon:instance:${daemonId}:sessions`,

  /** Revoked tokens set */
  revokedTokens: 'daemon:tokens:revoked',

  /** Rate limit key */
  rateLimit: (daemonId: string, action: string) => `daemon:rate:${daemonId}:${action}`,

  /** Event queue */
  eventQueue: (daemonId: string) => `daemon:events:${daemonId}`,

  /** Metrics */
  metrics: (daemonId: string) => `daemon:metrics:${daemonId}`,

  /** Active daemon flag */
  active: (daemonId: string) => `daemon:active:${daemonId}`,

  /** Refresh token storage */
  refreshToken: (daemonId: string) => `daemon:refresh:${daemonId}`,
} as const;

// =============================================================================
// Daemon Registration Types (for new daemon onboarding)
// =============================================================================

/**
 * Input for registering a new daemon.
 * Used when a VP daemon first connects to the Genesis platform.
 */
export interface DaemonRegistration {
  /** VP to associate with daemon */
  vpId: string;

  /** Workspace to associate with daemon */
  workspaceId: string;

  /** Hostname where daemon runs */
  hostname: string;

  /** Daemon software version */
  version: string;

  /** List of capabilities (e.g., 'messaging', 'calls') */
  capabilities: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Full daemon credentials returned at registration.
 * The apiSecret is only returned once at registration time.
 */
export interface DaemonRegistrationCredentials {
  /** Unique daemon identifier */
  daemonId: string;

  /** API key for authentication (dk_ prefixed) */
  apiKey: string;

  /** API secret (only returned at registration) */
  apiSecret: string;

  /** Associated workspace identifier */
  workspaceId: string;

  /** Associated VP identifier */
  vpId: string;

  /** Credential creation timestamp */
  createdAt: Date;

  /** Optional expiration timestamp */
  expiresAt?: Date;

  /** Whether credentials are active */
  isActive: boolean;
}

// =============================================================================
// Daemon Auth Request/Response Types
// =============================================================================

/**
 * Authentication request from daemon using API key/secret.
 */
export interface DaemonAuthRequest {
  /** API key (dk_ prefixed) */
  apiKey: string;

  /** API secret */
  apiSecret: string;

  /** Optional scope restrictions */
  scopes?: DaemonScope[];
}

/**
 * Authentication response to daemon with JWT tokens.
 */
export interface DaemonAuthResponse {
  /** JWT access token */
  accessToken: string;

  /** JWT refresh token */
  refreshToken: string;

  /** Access token lifetime in seconds */
  expiresIn: number;

  /** Token type (always Bearer) */
  tokenType: 'Bearer';

  /** Granted scopes */
  scopes: DaemonScope[];

  /** Daemon identifier */
  daemonId: string;

  /** VP identifier */
  vpId: string;
}

/**
 * Refresh token request from daemon.
 */
export interface DaemonRefreshRequest {
  /** Current refresh token */
  refreshToken: string;
}

/**
 * Connection status types for daemon sessions.
 */
export type DaemonConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'active'
  | 'idle'
  | 'disconnected'
  | 'error';

/**
 * Daemon heartbeat message.
 */
export interface DaemonHeartbeat {
  /** Daemon identifier */
  daemonId: string;

  /** Active session identifier */
  sessionId: string;

  /** Heartbeat timestamp */
  timestamp: Date;

  /** Current daemon status */
  status: DaemonConnectionStatus;

  /** Optional performance metrics */
  metrics?: DaemonMetrics;
}

/**
 * Error codes for daemon authentication failures.
 */
export type DaemonAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'DAEMON_DISABLED'
  | 'CREDENTIALS_EXPIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_REVOKED'
  | 'TOKEN_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'INSUFFICIENT_SCOPE';

/**
 * Credentials without the secret (for API responses).
 */
export type DaemonCredentialsWithoutSecret = Omit<DaemonRegistrationCredentials, 'apiSecret'> & {
  apiSecret: '[REDACTED]';
};
