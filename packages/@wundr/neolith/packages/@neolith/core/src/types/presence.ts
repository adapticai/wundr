/**
 * @genesis/core - Presence Type Definitions
 *
 * Type definitions for real-time presence tracking including users,
 * VPs (Virtual Persons), channels, and daemon connectivity.
 *
 * @packageDocumentation
 */

// =============================================================================
// Presence Status Types
// =============================================================================

/**
 * Presence status indicating user or Orchestrator availability.
 */
export type PresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

/**
 * Device type for presence metadata.
 */
export type DeviceType = 'web' | 'desktop' | 'mobile';

// =============================================================================
// User Presence Types
// =============================================================================

/**
 * User presence information.
 */
export interface UserPresence {
  /** Unique user identifier */
  userId: string;

  /** Current presence status */
  status: PresenceStatus;

  /** Last activity timestamp */
  lastSeen: Date;

  /** Optional custom status message */
  customStatus?: string;

  /** Additional presence metadata */
  metadata?: PresenceMetadata;
}

/**
 * Additional metadata for user presence.
 */
export interface PresenceMetadata {
  /** Device type the user is connected from */
  device?: DeviceType;

  /** User agent string */
  userAgent?: string;

  /** Geographic location (optional, privacy-aware) */
  location?: string;

  /** Session identifier */
  sessionId?: string;

  /** Connection timestamp */
  connectedAt?: Date;
}

// =============================================================================
// VP/Daemon Presence Types
// =============================================================================

/**
 * Orchestrator (Virtual Person) presence information.
 */
export interface OrchestratorPresence {
  /** Unique Orchestrator identifier */
  orchestratorId: string;

  /** Current presence status */
  status: PresenceStatus;

  /** Last heartbeat from the daemon */
  lastHeartbeat: Date;

  /** Daemon process information */
  daemonInfo: DaemonInfo;
}

/**
 * Information about the Orchestrator daemon process.
 */
export interface DaemonInfo {
  /** Daemon version string */
  version: string;

  /** Hostname where the daemon is running */
  hostname: string;

  /** Process ID of the daemon */
  processId: number;

  /** When the daemon was started */
  startedAt: Date;

  /** Optional endpoint URL for direct communication */
  endpoint?: string;

  /** Capabilities supported by this daemon */
  capabilities?: string[];

  /** Current load/capacity metrics */
  metrics?: DaemonMetrics;
}

/**
 * Daemon performance metrics.
 */
export interface DaemonMetrics {
  /** Number of active conversations */
  activeConversations: number;

  /** CPU usage percentage */
  cpuUsage?: number;

  /** Memory usage in bytes */
  memoryUsage?: number;

  /** Average response time in milliseconds */
  avgResponseTimeMs?: number;
}

// =============================================================================
// Channel Presence Types
// =============================================================================

/**
 * Channel presence information.
 */
export interface ChannelPresence {
  /** Channel identifier */
  channelId: string;

  /** Number of online members */
  onlineCount: number;

  /** List of online user IDs */
  onlineUserIds: string[];

  /** Last activity timestamp in the channel */
  lastActivity: Date;
}

// =============================================================================
// Presence Event Types
// =============================================================================

/**
 * Types of presence change events.
 */
export type PresenceEventType =
  | 'user.online'
  | 'user.offline'
  | 'user.status_changed'
  | 'user.metadata_updated'
  | 'vp.online'
  | 'vp.offline'
  | 'vp.heartbeat'
  | 'channel.user_joined'
  | 'channel.user_left';

/**
 * Base presence event structure.
 */
export interface BasePresenceEvent {
  /** Event type */
  type: PresenceEventType;

  /** Event timestamp */
  timestamp: Date;
}

/**
 * User presence change event.
 */
export interface UserPresenceEvent extends BasePresenceEvent {
  type: 'user.online' | 'user.offline' | 'user.status_changed' | 'user.metadata_updated';

  /** User ID associated with the event */
  userId: string;

  /** Previous presence state */
  previousStatus?: PresenceStatus;

  /** New presence state */
  currentStatus: PresenceStatus;

  /** Additional event data */
  metadata?: PresenceMetadata;
}

/**
 * Orchestrator presence change event.
 */
export interface OrchestratorPresenceEvent extends BasePresenceEvent {
  type: 'vp.online' | 'vp.offline' | 'vp.heartbeat';

  /** OrchestratorID associated with the event */
  orchestratorId: string;

  /** Previous presence state */
  previousStatus?: PresenceStatus;

  /** New presence state */
  currentStatus: PresenceStatus;

  /** Daemon information */
  daemonInfo?: DaemonInfo;
}

/**
 * Channel presence change event.
 */
export interface ChannelPresenceEvent extends BasePresenceEvent {
  type: 'channel.user_joined' | 'channel.user_left';

  /** Channel ID */
  channelId: string;

  /** User ID who joined/left */
  userId: string;

  /** Current online count after the change */
  onlineCount: number;
}

/**
 * Union type for all presence events.
 */
export type PresenceEvent = UserPresenceEvent | OrchestratorPresenceEvent | ChannelPresenceEvent;

/**
 * @deprecated Use OrchestratorPresenceEvent instead
 */
export type VPPresenceEvent = OrchestratorPresenceEvent;

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback for user presence changes.
 */
export type PresenceCallback = (event: UserPresenceEvent) => void;

/**
 * Callback for Orchestrator presence changes.
 */
export type OrchestratorPresenceCallback = (event: OrchestratorPresenceEvent) => void;

/**
 * Callback for channel presence changes.
 */
export type ChannelPresenceCallback = (event: ChannelPresenceEvent) => void;

/**
 * @deprecated Use OrchestratorPresenceCallback instead
 */
export type VPPresenceCallback = OrchestratorPresenceCallback;

/**
 * Unsubscribe function returned by subscription methods.
 */
export type UnsubscribeFunction = () => void;

// =============================================================================
// Redis Key Patterns
// =============================================================================

/**
 * Redis key patterns for presence data.
 * These are used internally by the presence service.
 */
export const PRESENCE_KEY_PATTERNS = {
  /** User presence hash: presence:user:{userId} */
  USER_PRESENCE: 'presence:user:',

  /** Orchestrator presence hash: presence:vp:{vpId} */
  VP_PRESENCE: 'presence:vp:',

  /** Channel members set: presence:channel:{channelId}:members */
  CHANNEL_MEMBERS: 'presence:channel:',
  CHANNEL_MEMBERS_SUFFIX: ':members',

  /** Heartbeat TTL key: presence:heartbeat:{userId} */
  HEARTBEAT: 'presence:heartbeat:',

  /** Pub/sub channel for user presence: presence:events:user:{userId} */
  USER_EVENTS: 'presence:events:user:',

  /** Pub/sub channel for channel presence: presence:events:channel:{channelId} */
  CHANNEL_EVENTS: 'presence:events:channel:',

  /** Pub/sub channel for Orchestrator presence: presence:events:vp:{vpId} */
  VP_EVENTS: 'presence:events:vp:',

  /** Global presence events channel */
  GLOBAL_EVENTS: 'presence:events:global',
} as const;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Presence service configuration.
 */
export interface PresenceConfig {
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatIntervalMs: number;

  /** TTL for presence keys in seconds (default: 60) */
  presenceTtlSeconds: number;

  /** Whether to enable pub/sub for presence events (default: true) */
  enablePubSub: boolean;

  /** Maximum number of presence records to return in bulk queries */
  maxBulkQuerySize: number;
}

/**
 * Default presence configuration.
 */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  heartbeatIntervalMs: 30000, // 30 seconds
  presenceTtlSeconds: 60, // 60 seconds
  enablePubSub: true,
  maxBulkQuerySize: 100,
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid PresenceStatus.
 */
export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return typeof value === 'string' && ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'].includes(value);
}

/**
 * Type guard to check if a value is a UserPresence object.
 */
export function isUserPresence(value: unknown): value is UserPresence {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.userId === 'string' &&
    isPresenceStatus(obj.status) &&
    obj.lastSeen instanceof Date
  );
}

/**
 * Type guard to check if a value is a OrchestratorPresence object.
 */
export function isVPPresence(value: unknown): value is OrchestratorPresence {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.orchestratorId === 'string' &&
    isPresenceStatus(obj.status) &&
    obj.lastHeartbeat instanceof Date &&
    typeof obj.daemonInfo === 'object'
  );
}

/**
 * Type guard to check if a value is a valid DeviceType.
 */
export function isDeviceType(value: unknown): value is DeviceType {
  return typeof value === 'string' && ['web', 'desktop', 'mobile'].includes(value);
}

/**
 * Type guard to check if a value is a UserPresenceEvent.
 */
export function isUserPresenceEvent(event: PresenceEvent): event is UserPresenceEvent {
  return event.type.startsWith('user.');
}

/**
 * Type guard to check if a value is a OrchestratorPresenceEvent.
 */
export function isVPPresenceEvent(event: PresenceEvent): event is OrchestratorPresenceEvent {
  return event.type.startsWith('vp.');
}

/**
 * Type guard to check if a value is a ChannelPresenceEvent.
 */
export function isChannelPresenceEvent(event: PresenceEvent): event is ChannelPresenceEvent {
  return event.type.startsWith('channel.');
}
