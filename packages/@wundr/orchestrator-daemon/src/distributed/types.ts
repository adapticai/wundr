/**
 * Distributed Session Management Types
 * Phase 5.2: Types for distributed daemon orchestration
 */

import type { Session, Task } from '../types';

/**
 * Node status enumeration
 */
export type NodeStatus = 'healthy' | 'degraded' | 'unreachable' | 'draining';

/**
 * Daemon node in the cluster
 */
export interface DaemonNode {
  id: string;
  host: string;
  port: number;
  status: NodeStatus;
  sessions: Set<string>;
  load: NodeLoad;
  lastHeartbeat: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Node load metrics
 */
export interface NodeLoad {
  activeSessions: number;
  cpuUsage: number;
  memoryUsage: number;
  tokenRate: number;
  errorRate: number;
}

/**
 * Request to spawn a new session
 */
export interface SpawnSessionRequest {
  orchestratorId: string;
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
  sessionType: 'claude-code' | 'claude-flow';
  memoryProfile?: string;
  preferredNodeId?: string;
  constraints?: SessionConstraints;
}

/**
 * Session placement constraints
 */
export interface SessionConstraints {
  minMemoryMB?: number;
  maxLatencyMs?: number;
  affinityNodeId?: string;
  antiAffinitySessionIds?: string[];
  requiresGpu?: boolean;
}

/**
 * Result of session migration
 */
export interface SessionMigrationResult {
  success: boolean;
  sessionId: string;
  fromNode: string;
  toNode: string;
  duration: number;
  error?: string;
  metadata?: {
    memoryTransferred: number;
    stateChecksum: string;
    rollbackAvailable: boolean;
  };
}

/**
 * Cluster-wide status
 */
export interface ClusterStatus {
  totalNodes: number;
  healthyNodes: number;
  degradedNodes: number;
  unreachableNodes: number;
  totalSessions: number;
  nodes: NodeHealth[];
  loadBalancing: {
    strategy: 'round-robin' | 'least-loaded' | 'weighted' | 'hash-based';
    rebalanceInProgress: boolean;
    lastRebalance?: Date;
  };
}

/**
 * Individual node health status
 */
export interface NodeHealth {
  nodeId: string;
  host: string;
  port: number;
  status: NodeStatus;
  uptime: number;
  sessions: number;
  load: NodeLoad;
  capacity: {
    maxSessions: number;
    availableSessions: number;
    utilizationPercent: number;
  };
  lastHealthCheck: Date;
  errors?: string[];
}

/**
 * Session location mapping
 */
export interface SessionLocation {
  sessionId: string;
  nodeId: string;
  assignedAt: Date;
  isPinned: boolean;
  migrationHistory?: SessionMigration[];
}

/**
 * Session migration history entry
 */
export interface SessionMigration {
  fromNode: string;
  toNode: string;
  migratedAt: Date;
  reason: 'rebalance' | 'node-failure' | 'manual' | 'optimization';
  duration: number;
}

/**
 * Load balancing strategy
 */
export interface LoadBalancingStrategy {
  selectNode(
    nodes: DaemonNode[],
    request: SpawnSessionRequest
  ): DaemonNode | null;
  shouldRebalance(nodes: DaemonNode[]): boolean;
  calculateMigrations(nodes: DaemonNode[]): SessionMigrationPlan[];
}

/**
 * Session migration plan
 */
export interface SessionMigrationPlan {
  sessionId: string;
  fromNode: string;
  toNode: string;
  priority: number;
  reason: string;
}

/**
 * Distributed session manager configuration
 */
export interface DistributedSessionConfig {
  clusterName: string;
  redisUrl: string;
  heartbeatInterval: number;
  healthCheckTimeout: number;
  migrationTimeout: number;
  rebalanceInterval: number;
  loadBalancingStrategy:
    | 'round-robin'
    | 'least-loaded'
    | 'weighted'
    | 'hash-based';
}

/**
 * Session spawn result
 */
export interface SessionSpawnResult {
  success: boolean;
  session?: Session;
  nodeId?: string;
  error?: string;
  queuePosition?: number;
}
