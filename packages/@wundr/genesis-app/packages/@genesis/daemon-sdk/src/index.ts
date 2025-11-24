/**
 * Genesis Daemon SDK
 * SDK for communicating with the Genesis Daemon service
 */

// Main client
export { DaemonClient } from './client.js';

// Authentication
export {
  AuthManager,
  AuthenticationError,
  createAuthHeader,
  validateApiKey,
} from './auth.js';

// Types
export {
  // Configuration
  type DaemonConfig,

  // Authentication
  type AuthResponse,
  type TokenRefreshResponse,

  // Messages
  type BaseMessage,
  type TextMessage,
  type CommandMessage,
  type EventMessage,
  type StatusMessage,
  type ErrorMessage,
  type DaemonMessage,
  type SendMessageOptions,
  MessageType,
  MessagePriority,

  // Events
  DaemonEventType,
  type DaemonClientEvents,
  type EventHandler,

  // Connection
  ConnectionState,

  // Presence
  type PresenceInfo,
  PresenceStatus,
} from './types.js';
