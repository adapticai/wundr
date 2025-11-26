/**
 * VP Daemon API Types
 *
 * Type definitions for VP daemon integration API endpoints.
 * Supports daemon registration, authentication, heartbeat, and session management.
 *
 * @module types/daemon
 */

/**
 * Daemon registration request payload
 */
export interface DaemonRegistration {
  /** VP identifier */
  vpId: string;
  /** Organization identifier */
  organizationId: string;
  /** Daemon API key for authentication */
  apiKey: string;
  /** Daemon instance information */
  daemonInfo: DaemonInfo;
}

/**
 * Daemon instance information
 */
export interface DaemonInfo {
  /** Unique daemon instance identifier */
  instanceId: string;
  /** Daemon version (semantic versioning) */
  version: string;
  /** Hostname or IP address */
  host: string;
  /** Port number (1-65535) */
  port: number;
  /** Communication protocol */
  protocol: 'http' | 'https' | 'ws' | 'wss';
  /** ISO 8601 timestamp when daemon started */
  startedAt: string;
  /** Optional daemon capabilities */
  capabilities?: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Optional registration timestamp */
  registeredAt?: string;
}

/**
 * Daemon registration response
 */
export interface DaemonRegistrationResponse {
  /** Success indicator */
  success: boolean;
  /** Response data */
  data: {
    /** VP identifier */
    vpId: string;
    /** Organization identifier */
    organizationId: string;
    /** ISO 8601 timestamp of registration */
    registeredAt: string;
    /** Updated daemon info with server details */
    daemonInfo: DaemonInfo;
    /** Heartbeat interval in milliseconds */
    heartbeatInterval: number;
    /** Health check endpoint path */
    healthCheckEndpoint: string;
  };
  /** Success message */
  message: string;
}

/**
 * Daemon heartbeat request payload
 */
export interface DaemonHeartbeat {
  /** Optional session identifier */
  sessionId?: string;
  /** Current daemon status */
  status?: 'active' | 'idle' | 'busy';
  /** Optional performance metrics */
  metrics?: DaemonMetrics;
}

/**
 * Daemon performance metrics
 */
export interface DaemonMetrics {
  /** Memory usage in megabytes */
  memoryUsageMB?: number;
  /** CPU usage percentage (0-100) */
  cpuUsagePercent?: number;
  /** Active connection count */
  activeConnections?: number;
  /** Total messages processed */
  messagesProcessed?: number;
  /** Error count */
  errorsCount?: number;
  /** Uptime in seconds */
  uptimeSeconds?: number;
  /** ISO 8601 timestamp of last task completion */
  lastTaskCompletedAt?: string;
  /** Current queue depth */
  queueDepth?: number;
}

/**
 * Daemon heartbeat response
 */
export interface DaemonHeartbeatResponse {
  /** Success indicator */
  success: boolean;
  /** Server timestamp (ISO 8601) */
  serverTime: string;
  /** Next expected heartbeat timestamp (ISO 8601) */
  nextHeartbeat: string;
  /** Heartbeat interval in milliseconds */
  heartbeatIntervalMs: number;
}

/**
 * Session creation request payload
 */
export interface SessionCreate {
  /** VP identifier */
  vpId: string;
  /** Session type */
  type: 'daemon' | 'user' | 'system';
  /** Optional session metadata */
  metadata?: SessionMetadata;
  /** Session timeout in seconds (default: 7 days) */
  timeoutSeconds?: number;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** User agent string */
  userAgent?: string;
  /** IP address */
  ipAddress?: string;
  /** Geographic location */
  location?: string;
  /** Device type */
  deviceType?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Session update request payload
 */
export interface SessionUpdate {
  /** Session identifier */
  sessionId: string;
  /** Updated session status */
  status?: SessionStatus;
  /** Updated metadata */
  metadata?: Partial<SessionMetadata>;
  /** Extend session TTL */
  extendTTL?: boolean;
  /** Last activity timestamp (ISO 8601) */
  lastActivityAt?: string;
}

/**
 * Session status enumeration
 */
export type SessionStatus = 'active' | 'idle' | 'expired' | 'terminated';

/**
 * Session data structure
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** VP identifier */
  vpId: string;
  /** Session type */
  type: 'daemon' | 'user' | 'system';
  /** Current session status */
  status: SessionStatus;
  /** ISO 8601 timestamp of session creation */
  createdAt: string;
  /** ISO 8601 timestamp of last activity */
  lastActivityAt: string;
  /** ISO 8601 timestamp when session expires */
  expiresAt: string;
  /** Session metadata */
  metadata?: SessionMetadata;
  /** ISO 8601 timestamp of last heartbeat */
  lastHeartbeat?: string;
  /** Last reported status from heartbeat */
  lastStatus?: 'active' | 'idle' | 'busy';
}

/**
 * Session list response
 */
export interface SessionListResponse {
  /** Array of sessions */
  sessions: Session[];
  /** Total session count */
  total: number;
  /** Pagination cursor for next page */
  nextCursor?: string;
}

/**
 * Session create response
 */
export interface SessionCreateResponse {
  /** Success indicator */
  success: boolean;
  /** Created session data */
  session: Session;
  /** Success message */
  message: string;
}

/**
 * Session update response
 */
export interface SessionUpdateResponse {
  /** Success indicator */
  success: boolean;
  /** Updated session data */
  session: Session;
  /** Success message */
  message: string;
}

/**
 * Session delete response
 */
export interface SessionDeleteResponse {
  /** Success indicator */
  success: boolean;
  /** Success message */
  message: string;
}

/**
 * Daemon authentication credentials
 */
export interface DaemonAuthCredentials {
  /** API key */
  apiKey: string;
  /** API secret */
  apiSecret: string;
  /** Optional scopes */
  scopes?: string[];
}

/**
 * Daemon authentication response
 */
export interface DaemonAuthResponse {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** ISO 8601 expiration timestamp */
  expiresAt: string;
  /** Session identifier */
  sessionId: string;
  /** VP information */
  vp: {
    id: string;
    discipline: string | null;
    role: string | null;
    status: string;
  };
}

/**
 * Standard error response
 */
export interface DaemonErrorResponse {
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error code */
    code: string;
    /** Optional error details */
    details?: Record<string, unknown>;
  };
}

/**
 * Daemon status information
 */
export interface DaemonStatus {
  /** VP identifier */
  vpId: string;
  /** Daemon instance ID */
  daemonId: string;
  /** Current status */
  status: 'online' | 'offline' | 'degraded';
  /** Last heartbeat timestamp (ISO 8601) */
  lastHeartbeat?: string;
  /** Current metrics */
  metrics?: DaemonMetrics;
  /** Session information */
  session?: {
    id: string;
    createdAt: string;
    lastActivityAt: string;
  };
}
