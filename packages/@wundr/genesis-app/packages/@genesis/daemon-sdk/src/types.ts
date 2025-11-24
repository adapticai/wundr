/**
 * Genesis Daemon SDK Types
 * Type definitions for daemon communication
 */

/**
 * Configuration for the Daemon client
 */
export interface DaemonConfig {
  /** Base URL for the daemon HTTP API */
  baseUrl: string;
  /** WebSocket URL for real-time communication */
  wsUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Optional client identifier */
  clientId?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
}

/**
 * Authentication response from the daemon
 */
export interface AuthResponse {
  /** Access token for authenticated requests */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (e.g., "Bearer") */
  tokenType: string;
  /** Authenticated client identifier */
  clientId: string;
  /** Granted scopes/permissions */
  scopes: string[];
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  /** New access token */
  accessToken: string;
  /** New expiration time in seconds */
  expiresIn: number;
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Message types for daemon communication
 */
export enum MessageType {
  /** Text message */
  TEXT = 'text',
  /** Command message */
  COMMAND = 'command',
  /** Event notification */
  EVENT = 'event',
  /** Status update */
  STATUS = 'status',
  /** Heartbeat/ping */
  HEARTBEAT = 'heartbeat',
  /** Acknowledgment */
  ACK = 'ack',
  /** Error message */
  ERROR = 'error',
}

/**
 * Base message structure
 */
export interface BaseMessage {
  /** Unique message identifier */
  id: string;
  /** Message type */
  type: MessageType;
  /** Message timestamp (ISO 8601) */
  timestamp: string;
  /** Message priority */
  priority?: MessagePriority;
  /** Correlation ID for request/response matching */
  correlationId?: string;
}

/**
 * Text message
 */
export interface TextMessage extends BaseMessage {
  type: MessageType.TEXT;
  /** Message content */
  content: string;
  /** Sender identifier */
  senderId: string;
  /** Recipient identifier(s) */
  recipientIds: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Command message
 */
export interface CommandMessage extends BaseMessage {
  type: MessageType.COMMAND;
  /** Command name */
  command: string;
  /** Command arguments */
  args: Record<string, unknown>;
  /** Target agent/service */
  target: string;
}

/**
 * Event message
 */
export interface EventMessage extends BaseMessage {
  type: MessageType.EVENT;
  /** Event name */
  eventName: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Event source */
  source: string;
}

/**
 * Status message
 */
export interface StatusMessage extends BaseMessage {
  type: MessageType.STATUS;
  /** Status code */
  code: string;
  /** Status description */
  description: string;
  /** Additional status data */
  data?: Record<string, unknown>;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  /** Error code */
  errorCode: string;
  /** Error message */
  errorMessage: string;
  /** Error details */
  details?: Record<string, unknown>;
}

/**
 * Union type for all message types
 */
export type DaemonMessage =
  | TextMessage
  | CommandMessage
  | EventMessage
  | StatusMessage
  | ErrorMessage
  | BaseMessage;

/**
 * Event types emitted by the daemon client
 */
export enum DaemonEventType {
  /** Connection established */
  CONNECTED = 'connected',
  /** Connection closed */
  DISCONNECTED = 'disconnected',
  /** Reconnecting attempt */
  RECONNECTING = 'reconnecting',
  /** Authentication successful */
  AUTHENTICATED = 'authenticated',
  /** Authentication failed */
  AUTH_FAILED = 'auth_failed',
  /** Message received */
  MESSAGE = 'message',
  /** Error occurred */
  ERROR = 'error',
  /** Presence update */
  PRESENCE = 'presence',
  /** Heartbeat received */
  HEARTBEAT = 'heartbeat',
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Presence status
 */
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

/**
 * Presence information
 */
export interface PresenceInfo {
  /** Client identifier */
  clientId: string;
  /** Current status */
  status: PresenceStatus;
  /** Last activity timestamp */
  lastActivity: string;
  /** Custom status message */
  statusMessage?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Message priority */
  priority?: MessagePriority;
  /** Timeout for acknowledgment */
  timeout?: number;
  /** Whether to wait for acknowledgment */
  waitForAck?: boolean;
  /** Retry count on failure */
  retries?: number;
}

/**
 * Event handler type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Daemon client events map
 */
export interface DaemonClientEvents {
  [DaemonEventType.CONNECTED]: void;
  [DaemonEventType.DISCONNECTED]: { code: number; reason: string };
  [DaemonEventType.RECONNECTING]: { attempt: number; maxAttempts: number };
  [DaemonEventType.AUTHENTICATED]: AuthResponse;
  [DaemonEventType.AUTH_FAILED]: { error: string };
  [DaemonEventType.MESSAGE]: DaemonMessage;
  [DaemonEventType.ERROR]: Error;
  [DaemonEventType.PRESENCE]: PresenceInfo;
  [DaemonEventType.HEARTBEAT]: { timestamp: string };
}
