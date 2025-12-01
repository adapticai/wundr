/**
 * @genesis/core - Heartbeat Type Definitions
 *
 * Type definitions for Orchestrator daemon heartbeat system including
 * registration, health monitoring, and recovery.
 *
 * @packageDocumentation
 */

// =============================================================================
// Heartbeat Core Types
// =============================================================================

/**
 * Information about a daemon instance for heartbeat registration.
 * This is more detailed than the presence DaemonInfo.
 */
export interface HeartbeatDaemonInfo {
  /** Unique identifier for the daemon instance */
  instanceId: string;

  /** Version of the daemon software */
  version: string;

  /** Hostname or IP address where the daemon is running */
  host: string;

  /** Port the daemon is listening on */
  port: number;

  /** Protocol used by the daemon (http, https, ws, wss) */
  protocol: 'http' | 'https' | 'ws' | 'wss';

  /** Start time of the daemon instance */
  startedAt: Date;

  /** Capabilities supported by this daemon instance */
  capabilities?: string[];

  /** Additional metadata about the daemon */
  metadata?: Record<string, unknown>;
}

/**
 * Metrics sent with each heartbeat.
 * Provides real-time operational data about the Orchestrator daemon.
 */
export interface HeartbeatMetrics {
  /** CPU usage percentage (0-100) */
  cpuUsage: number;

  /** Memory usage percentage (0-100) */
  memoryUsage: number;

  /** Number of active connections/sessions */
  activeConnections: number;

  /** Number of messages waiting in the queue */
  messageQueueSize: number;

  /** Timestamp of the last processed message */
  lastMessageAt?: Date;

  /** Average response time in milliseconds */
  avgResponseTimeMs?: number;

  /** Total messages processed since daemon start */
  totalMessagesProcessed?: number;

  /** Number of errors since daemon start */
  errorCount?: number;

  /** Custom metrics specific to the Orchestrator */
  custom?: Record<string, number | string>;
}

/**
 * Record of a single heartbeat.
 * Stored in Redis for health tracking.
 */
export interface HeartbeatRecord {
  /** OrchestratorID this heartbeat belongs to */
  orchestratorId: string;

  /** Organization ID the Orchestrator belongs to */
  organizationId: string;

  /** Timestamp when the heartbeat was received */
  timestamp: Date;

  /** Metrics included with the heartbeat */
  metrics: HeartbeatMetrics;

  /** Information about the daemon sending the heartbeat */
  daemonInfo: HeartbeatDaemonInfo;

  /** Sequence number for ordering */
  sequenceNumber: number;
}

/**
 * Health status of a Orchestrator daemon.
 */
export interface HealthStatus {
  /** Whether the Orchestrator is considered healthy */
  healthy: boolean;

  /** Detailed status classification */
  status: HealthStatusType;

  /** Last successful heartbeat timestamp */
  lastHeartbeat?: Date;

  /** Number of consecutive missed heartbeats */
  missedHeartbeats: number;

  /** Human-readable description of the status */
  details?: string;

  /** Timestamp when the Orchestrator became unhealthy (if applicable) */
  unhealthySince?: Date;

  /** Whether the Orchestrator is currently in recovery mode */
  recovering?: boolean;

  /** Latest metrics from the last heartbeat */
  latestMetrics?: HeartbeatMetrics;
}

/**
 * Possible health status types.
 */
export type HealthStatusType =
  | 'healthy' // Normal operation, heartbeats received on schedule
  | 'degraded' // Heartbeats delayed or metrics indicate issues
  | 'unhealthy' // Multiple missed heartbeats
  | 'recovering' // Previously unhealthy, now receiving heartbeats
  | 'unknown'; // No heartbeat data available

// =============================================================================
// Heartbeat Input Types
// =============================================================================

/**
 * Input for registering a daemon.
 */
export interface RegisterDaemonInput {
  /** OrchestratorID the daemon is serving */
  orchestratorId: string;

  /** Information about the daemon */
  daemonInfo: HeartbeatDaemonInfo;

  /** Organization ID for validation */
  organizationId: string;
}

/**
 * Input for sending a heartbeat.
 */
export interface SendHeartbeatInput {
  /** OrchestratorID sending the heartbeat */
  orchestratorId: string;

  /** Optional metrics to include */
  metrics?: Partial<HeartbeatMetrics>;

  /** Optional daemon info update */
  daemonInfo?: Partial<HeartbeatDaemonInfo>;
}

/**
 * Input for unregistering a daemon.
 */
export interface UnregisterDaemonInput {
  /** OrchestratorID to unregister */
  orchestratorId: string;

  /** Reason for unregistering */
  reason?: 'shutdown' | 'error' | 'maintenance' | 'unknown';
}

// =============================================================================
// Heartbeat Configuration Types
// =============================================================================

/**
 * Configuration for the heartbeat system.
 */
export interface HeartbeatConfig {
  /** Expected heartbeat interval in milliseconds */
  heartbeatIntervalMs: number;

  /** Number of missed heartbeats before marking unhealthy */
  unhealthyThreshold: number;

  /** Number of consecutive heartbeats needed to recover */
  recoveryThreshold: number;

  /** Whether to automatically deactivate unhealthy VPs */
  autoDeactivate: boolean;

  /** Time-to-live for heartbeat records in seconds */
  heartbeatTTLSeconds: number;

  /** Maximum history entries to keep per Orchestrator */
  maxHistoryEntries: number;

  /** Interval for health check monitoring in milliseconds */
  monitorIntervalMs: number;

  /** Whether to emit events for status changes */
  emitEvents: boolean;
}

/**
 * Default heartbeat configuration.
 */
export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  heartbeatIntervalMs: 30000, // 30 seconds
  unhealthyThreshold: 3, // 3 missed = unhealthy
  recoveryThreshold: 2, // 2 consecutive = recovered
  autoDeactivate: false, // Don't auto-deactivate
  heartbeatTTLSeconds: 300, // 5 minutes TTL
  maxHistoryEntries: 100, // Keep 100 history entries
  monitorIntervalMs: 30000, // Check every 30 seconds
  emitEvents: true, // Emit status change events
};

// =============================================================================
// Heartbeat Event Types
// =============================================================================

/**
 * Types of heartbeat-related events.
 */
export type HeartbeatEventType =
  | 'daemon.registered'
  | 'daemon.unregistered'
  | 'heartbeat.received'
  | 'vp.healthy'
  | 'vp.degraded'
  | 'vp.unhealthy'
  | 'vp.recovering'
  | 'vp.recovered';

/**
 * Base heartbeat event structure.
 */
export interface HeartbeatEvent {
  /** Event type */
  type: HeartbeatEventType;

  /** OrchestratorID the event relates to */
  orchestratorId: string;

  /** Organization ID */
  organizationId: string;

  /** Event timestamp */
  timestamp: Date;

  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Event emitted when a daemon is registered.
 */
export interface DaemonRegisteredEvent extends HeartbeatEvent {
  type: 'daemon.registered';
  data: {
    daemonInfo: HeartbeatDaemonInfo;
  };
}

/**
 * Event emitted when a daemon is unregistered.
 */
export interface DaemonUnregisteredEvent extends HeartbeatEvent {
  type: 'daemon.unregistered';
  data: {
    reason?: string;
    lastHeartbeat?: Date;
  };
}

/**
 * Event emitted when Orchestrator becomes unhealthy.
 */
export interface OrchestratorUnhealthyEvent extends HeartbeatEvent {
  type: 'vp.unhealthy';
  data: {
    status: HealthStatus;
    missedHeartbeats: number;
    lastHeartbeat?: Date;
  };
}

/**
 * Event emitted when Orchestrator recovers.
 */
export interface OrchestratorRecoveredEvent extends HeartbeatEvent {
  type: 'vp.recovered';
  data: {
    downtime: number; // milliseconds
    recoveryHeartbeats: number;
  };
}

// =============================================================================
// Heartbeat Callback Types
// =============================================================================

/**
 * Callback for Orchestrator unhealthy events.
 */
export type OnOrchestratorUnhealthyCallback = (
  orchestratorId: string,
  status: HealthStatus
) => void | Promise<void>;

/**
 * Callback for Orchestrator recovered events.
 */
export type OnOrchestratorRecoveredCallback = (
  orchestratorId: string
) => void | Promise<void>;

/**
 * Callback for daemon registered events.
 */
export type OnDaemonRegisteredCallback = (
  orchestratorId: string,
  daemonInfo: HeartbeatDaemonInfo
) => void | Promise<void>;

/**
 * Callback for daemon unregistered events.
 */
export type OnDaemonUnregisteredCallback = (
  orchestratorId: string,
  reason?: string
) => void | Promise<void>;

// =============================================================================
// Redis Key Patterns
// =============================================================================

/**
 * Redis key patterns used for heartbeat storage.
 */
export const HEARTBEAT_REDIS_KEYS = {
  /** Latest heartbeat for a VP: heartbeat:{orchestratorId} */
  heartbeat: (orchestratorId: string) => `heartbeat:${orchestratorId}`,

  /** Heartbeat history for a VP: heartbeat:history:{orchestratorId} */
  history: (orchestratorId: string) => `heartbeat:history:${orchestratorId}`,

  /** Daemon info for a VP: daemon:{orchestratorId} */
  daemon: (orchestratorId: string) => `daemon:${orchestratorId}`,

  /** Health status for a VP: health:{orchestratorId} */
  health: (orchestratorId: string) => `health:${orchestratorId}`,

  /** Set of all registered OrchestratorIDs: registered:orchestrators */
  registeredOrchestrators: () => 'registered:orchestrators',

  /** Set of VPs by organization: org:{orgId}:orchestrators */
  orgOrchestrators: (orgId: string) => `org:${orgId}:orchestrators`,

  /** Lock for a VP: lock:heartbeat:{orchestratorId} */
  lock: (orchestratorId: string) => `lock:heartbeat:${orchestratorId}`,
} as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid HeartbeatDaemonInfo.
 */
export function isHeartbeatDaemonInfo(
  value: unknown
): value is HeartbeatDaemonInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.instanceId === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.host === 'string' &&
    typeof obj.port === 'number' &&
    ['http', 'https', 'ws', 'wss'].includes(obj.protocol as string)
  );
}

/**
 * Type guard to check if a value is a valid HeartbeatMetrics.
 */
export function isHeartbeatMetrics(value: unknown): value is HeartbeatMetrics {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.cpuUsage === 'number' &&
    typeof obj.memoryUsage === 'number' &&
    typeof obj.activeConnections === 'number' &&
    typeof obj.messageQueueSize === 'number'
  );
}

/**
 * Type guard to check if a value is a valid HealthStatus.
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.healthy === 'boolean' &&
    ['healthy', 'degraded', 'unhealthy', 'recovering', 'unknown'].includes(
      obj.status as string
    ) &&
    typeof obj.missedHeartbeats === 'number'
  );
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Default metrics when not provided.
 */
export const DEFAULT_HEARTBEAT_METRICS: HeartbeatMetrics = {
  cpuUsage: 0,
  memoryUsage: 0,
  activeConnections: 0,
  messageQueueSize: 0,
};

/**
 * Default health status for new VPs.
 */
export const DEFAULT_HEALTH_STATUS: HealthStatus = {
  healthy: false,
  status: 'unknown',
  missedHeartbeats: 0,
};
