/**
 * @neolith/daemon-sdk
 *
 * TypeScript SDK for connecting the Neolith web app to the orchestrator
 * daemon's WebSocket server (protocol v2).
 *
 * Main exports:
 *   - DaemonClient          – WebSocket client with auth, request/response, events, reconnect
 *   - DaemonSessionManager  – Session lifecycle management
 *   - DaemonHealthMonitor   – Health polling, metrics, and change notifications
 *
 * Legacy exports (genesis daemon v1 API):
 *   - DaemonClient (legacy)
 *   - AuthManager, AuthenticationError
 */

// ---------------------------------------------------------------------------
// Protocol v2 client (primary)
// ---------------------------------------------------------------------------

export {
  DaemonClient,
  DaemonError,
  ConnectionError,
  RequestTimeoutError,
  type ConnectionState,
  type EventCallback,
  type MessageCallback,
  type StateChangeCallback,
  type DaemonClientOptions,
} from './daemon-client.js';

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

export {
  DaemonSessionManager,
  type SpawnSessionConfig,
  type SessionListResult,
  type StreamHandlers,
  type SessionCreateParams,
  type SessionInfo,
  type SessionListParams,
  type SessionStopParams,
} from './session-manager.js';

// ---------------------------------------------------------------------------
// Health monitor
// ---------------------------------------------------------------------------

export {
  DaemonHealthMonitor,
  type DaemonHealthStatus,
  type HealthCheckResult,
  type DaemonStatusSnapshot,
  type HealthChangeCallback,
  type HealthMonitorOptions,
} from './health-monitor.js';

// ---------------------------------------------------------------------------
// Protocol types (wire format)
// ---------------------------------------------------------------------------

export type {
  // Frames
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ProtocolFrame,
  ErrorShape,

  // Auth
  AuthType,
  AuthConnectParams,
  ClientInfo,
  HelloPayload,

  // Session
  SessionType,
  SessionStatus,
  TaskType,
  TaskPriority,
  SessionCreateParams as SessionCreateProtocolParams,
  SessionResumeParams,
  SessionStopParams as SessionStopProtocolParams,
  SessionListParams as SessionListProtocolParams,
  SessionStatusParams,

  // Health
  HealthPingParams,
  HealthPongPayload,
  HealthStatusPayload,
  HealthMetrics,
  HeartbeatPayload,
  SubsystemHealth,

  // Streams
  StreamChunkType,
  StreamStartPayload,
  StreamChunkPayload,
  StreamEndPayload,
  StreamErrorPayload,

  // Subscriptions
  SubscribeParams,
  SubscribeResult,
  UnsubscribeParams,
} from './protocol.js';

export {
  PROTOCOL_VERSION,
  CLIENT_VERSION,
  CLIENT_ID,
  CLIENT_PLATFORM,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Legacy genesis daemon client (v1 API)
// ---------------------------------------------------------------------------

export { DaemonClient as LegacyDaemonClient } from './client.js';
export {
  AuthManager,
  AuthenticationError,
  createAuthHeader,
  validateApiKey,
} from './auth.js';

export type {
  // Configuration
  DaemonConfig,

  // Authentication
  AuthResponse,
  TokenRefreshResponse,

  // Messages
  BaseMessage,
  TextMessage,
  CommandMessage,
  EventMessage,
  StatusMessage,
  ErrorMessage,
  DaemonMessage,
  SendMessageOptions,

  // Events
  DaemonClientEvents,
  EventHandler,

  // Presence
  PresenceInfo,
} from './types.js';

export {
  MessageType,
  MessagePriority,
  DaemonEventType,
  ConnectionState as LegacyConnectionState,
  PresenceStatus,
} from './types.js';
