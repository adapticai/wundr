/**
 * Type definitions for Multi-Orchestrator Federation
 */

import type { Task } from '../types';
import type { WebSocket } from 'ws';

/**
 * Orchestrator capabilities for federation
 */
export interface OrchestratorCapabilities {
  /** Maximum concurrent sessions this orchestrator can handle */
  maxSessions: number;
  /** Supported task types */
  supportedTaskTypes: Array<'code' | 'research' | 'analysis' | 'custom'>;
  /** Available memory tiers */
  memoryTiers: Array<'scratchpad' | 'episodic' | 'semantic'>;
  /** Token budget limits */
  tokenBudget: {
    subscription: string;
    api: string;
    remaining: number;
  };
  /** Resource limits */
  resourceLimits: {
    maxHeapMB: number;
    maxContextTokens: number;
  };
  /** Specialized capabilities */
  specializations?: string[];
}

/**
 * Connection status for federated orchestrators
 */
export type OrchestratorStatus =
  | 'connected'
  | 'disconnected'
  | 'degraded'
  | 'overloaded'
  | 'maintenance';

/**
 * Connection information for a federated orchestrator
 */
export interface OrchestratorConnection {
  /** Unique identifier for the orchestrator */
  id: string;
  /** WebSocket connection to the orchestrator */
  socket: WebSocket;
  /** Orchestrator capabilities */
  capabilities: OrchestratorCapabilities;
  /** Current connection status */
  status: OrchestratorStatus;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Number of active sessions */
  activeSessions: number;
  /** Connection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to delegate a task from one orchestrator to another
 */
export interface DelegationRequest {
  /** ID of the requesting orchestrator */
  fromOrchestratorId: string;
  /** ID of the target orchestrator */
  toOrchestratorId: string;
  /** Task to be delegated */
  task: Task;
  /** Priority level for the delegation */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Required capabilities for the task */
  requiredCapabilities?: Partial<OrchestratorCapabilities>;
  /** Context to transfer with the task */
  context?: SharedContext;
  /** Timeout for the delegation in milliseconds */
  timeout?: number;
  /** Callback URL or identifier for result notification */
  callbackId?: string;
}

/**
 * Result of a delegation request
 */
export interface DelegationResult {
  /** Whether the delegation was successful */
  success: boolean;
  /** ID of the delegated session if successful */
  sessionId?: string;
  /** Error message if delegation failed */
  error?: string;
  /** Reason for failure */
  reason?: 'capability_mismatch' | 'overloaded' | 'unreachable' | 'rejected' | 'timeout';
  /** Timestamp of the result */
  timestamp: Date;
  /** Additional metadata about the result */
  metadata?: Record<string, unknown>;
}

/**
 * Shared context for cross-orchestrator task delegation
 */
export interface SharedContext {
  /** Scratchpad memory for immediate context */
  scratchpad?: Record<string, unknown>;
  /** Relevant episodic memories */
  episodic?: Array<{
    id: string;
    content: string;
    timestamp: Date;
    type: 'interaction' | 'observation' | 'decision' | 'knowledge';
  }>;
  /** Relevant semantic knowledge */
  semantic?: Array<{
    id: string;
    content: string;
    timestamp: Date;
    type: 'interaction' | 'observation' | 'decision' | 'knowledge';
  }>;
  /** Task history and lineage */
  taskHistory?: Array<{
    taskId: string;
    orchestratorId: string;
    timestamp: Date;
    outcome: 'completed' | 'failed' | 'delegated';
  }>;
}

/**
 * Configuration for the federation system
 */
export interface FederationConfig {
  /** Enable federation features */
  enabled: boolean;
  /** Maximum number of federated orchestrators */
  maxOrchestrators: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Timeout for heartbeat before marking as disconnected */
  heartbeatTimeout: number;
  /** Enable automatic capability discovery */
  autoDiscovery: boolean;
  /** Allow automatic task delegation */
  autoDelegation: boolean;
  /** Federation network topology */
  topology: 'mesh' | 'hub-spoke' | 'hierarchical';
  /** Load balancing strategy */
  loadBalancing: 'round-robin' | 'least-loaded' | 'capability-based' | 'random';
}

/**
 * Event types for federation system
 */
export type FederationEvent =
  | { type: 'orchestrator:registered'; orchestrator: OrchestratorConnection }
  | { type: 'orchestrator:unregistered'; orchestratorId: string }
  | { type: 'orchestrator:status_changed'; orchestratorId: string; status: OrchestratorStatus }
  | { type: 'orchestrator:heartbeat'; orchestratorId: string; timestamp: Date }
  | { type: 'task:delegated'; delegation: DelegationRequest; result: DelegationResult }
  | { type: 'task:completed'; sessionId: string; orchestratorId: string }
  | { type: 'task:failed'; sessionId: string; orchestratorId: string; error: string }
  | { type: 'context:shared'; fromOrchestrator: string; toOrchestrator: string; size: number }
  | { type: 'federation:broadcast'; message: FederationBroadcast }
  | { type: 'federation:error'; error: string; orchestratorId?: string };

/**
 * Broadcast message for federation-wide communication
 */
export interface FederationBroadcast {
  /** Source orchestrator ID */
  sourceId: string;
  /** Message type */
  messageType: 'status_update' | 'capability_change' | 'load_alert' | 'shutdown_notice' | 'custom';
  /** Message payload */
  payload: Record<string, unknown>;
  /** Timestamp of the broadcast */
  timestamp: Date;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Metrics for federation monitoring
 */
export interface FederationMetrics {
  /** Total number of registered orchestrators */
  totalOrchestrators: number;
  /** Number of active orchestrators */
  activeOrchestrators: number;
  /** Total delegations performed */
  totalDelegations: number;
  /** Successful delegations */
  successfulDelegations: number;
  /** Failed delegations */
  failedDelegations: number;
  /** Average delegation latency in milliseconds */
  averageDelegationLatency: number;
  /** Total context transfers */
  totalContextTransfers: number;
  /** Total broadcasts sent */
  totalBroadcasts: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Extended types for OrchestratorConnection class
 */

/**
 * Orchestrator capability types for task delegation
 */
export type OrchestratorCapability =
  | 'code-generation'
  | 'research'
  | 'analysis'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'security'
  | 'data-processing'
  | 'ml-training'
  | 'custom';

/**
 * Federation message types for WebSocket communication
 */
export type FederationMessageType =
  | 'delegation'
  | 'callback'
  | 'broadcast'
  | 'heartbeat'
  | 'status';

/**
 * Connection status types
 */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'active'
  | 'idle'
  | 'degraded'
  | 'disconnected'
  | 'error';

/**
 * Federation message interface for WebSocket communication
 */
export interface FederationMessage {
  type: FederationMessageType;
  payload: unknown;
  from: string;
  to: string;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Delegation response payload
 */
export interface DelegationResponse {
  taskId: string;
  accepted: boolean;
  reason?: string;
  estimatedCompletion?: Date;
  assignedResources?: {
    sessions: number;
    tokens: number;
  };
}

/**
 * Task callback payload
 */
export interface TaskCallback {
  taskId: string;
  status: 'completed' | 'failed' | 'progress';
  result?: unknown;
  error?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Broadcast message payload
 */
export interface BroadcastPayload {
  topic: string;
  data: unknown;
  ttl?: number;
}

/**
 * Heartbeat payload
 */
export interface HeartbeatPayload {
  orchestratorId: string;
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'overloaded';
  activeConnections: number;
}

/**
 * Connection health info
 */
export interface ConnectionHealth {
  status: ConnectionStatus;
  uptime: number;
  lastHeartbeat: Date;
  latency?: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

/**
 * Serialized message format for WebSocket
 */
export interface SerializedMessage {
  type: FederationMessageType;
  payload: string; // JSON stringified payload
  from: string;
  to: string;
  timestamp: string; // ISO string
  correlationId?: string;
}

/**
 * Delegation record for task tracking (extended version for TaskDelegator)
 */
export interface DelegationRecord {
  delegationId: string;
  status: DelegationStatus;
  fromOrchestrator: string;
  toOrchestrator: string;
  task: Task;
  startedAt: Date;
  completedAt?: Date;
  result?: DelegationResult;
  error?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Delegation status types
 */
export type DelegationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Delegation callback for progress updates
 */
export interface DelegationCallback {
  delegationId: string;
  status: DelegationStatus;
  result?: DelegationResult;
  timestamp: Date;
  data?: unknown;
  error?: string;
}

/**
 * Delegation context for task execution
 */
export interface DelegationContext {
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  requiredCapabilities?: string[];
  preferredOrchestrators?: string[];
  excludedOrchestrators?: string[];
  parentTaskId?: string;
  depth?: number;
  maxDepth?: number;
  history?: string[]; // Array of orchestrator IDs in delegation chain
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrator information for selection
 */
export interface OrchestratorInfo {
  id: string;
  name: string;
  tier: number;
  capabilities: string[];
  currentLoad: number;
  maxLoad: number;
  available: boolean;
  lastSeen: Date;
  responseTime?: number;
  successRate?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Capability score for orchestrator selection
 */
export interface CapabilityScore {
  orchestratorId: string;
  score: number;
  matchedCapabilities?: OrchestratorCapability[];
  missingCapabilities?: OrchestratorCapability[];
  loadFactor?: number;
  priorityFactor?: number;
  breakdown?: {
    capabilityMatch: number;
    loadFactor: number;
    availabilityFactor: number;
    priorityBonus: number;
  };
  reasons?: string[];
}

/**
 * Orchestrator metadata for registry (adds missing fields)
 */
export interface OrchestratorMetadata {
  id: string;
  name: string;
  tier: number;
  capabilities: string[];
  currentSessions: number;
  maxSessions: number;
  tokensUsed: number;
  tokenLimit: number;
  region: string;
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: Date;
  registeredAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrator metrics for monitoring
 */
export interface OrchestratorMetrics {
  id: string;
  load: number;
  sessions: number;
  tokensUsed: number;
  tokenLimit: number;
  tokenUtilization: number;
  status: string;
  lastHeartbeat: Date;
  uptime: number;
}

/**
 * Federation registry configuration
 */
export interface FederationRegistryConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix: string;
  };
  heartbeatTimeout: number;
  staleTimeout: number;
  cleanupInterval: number;
}

/**
 * Federation registry events
 */
export interface FederationRegistryEvents {
  'orchestrator:registered': (metadata: OrchestratorMetadata) => void;
  'orchestrator:deregistered': (id: string) => void;
  'orchestrator:status_changed': (id: string, oldStatus: string, newStatus: string) => void;
  'orchestrator:stale': (id: string, lastHeartbeat: Date) => void;
  'orchestrator:unhealthy': (id: string, lastHeartbeat: Date) => void;
  'heartbeat:received': (id: string, timestamp: Date) => void;
}

/**
 * Orchestrator query parameters
 */
export interface OrchestratorQuery {
  capabilities?: string[];
  region?: string;
  status?: string[];
  minAvailableSessions?: number;
  minAvailableTokens?: number;
}
