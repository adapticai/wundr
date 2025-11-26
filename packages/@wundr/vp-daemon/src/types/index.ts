/**
 * Type definitions for VP Daemon
 */

import { z } from 'zod';

/**
 * Daemon configuration schema
 */
export const DaemonConfigSchema = z.object({
  name: z.string().default('vp-daemon'),
  port: z.number().int().min(1024).max(65535).default(8787),
  host: z.string().default('127.0.0.1'),
  maxSessions: z.number().int().positive().default(100),
  heartbeatInterval: z.number().int().positive().default(30000),
  shutdownTimeout: z.number().int().positive().default(10000),
  verbose: z.boolean().default(false),
});

export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

/**
 * VP Charter schema
 */
export const VPCharterSchema = z.object({
  name: z.string(),
  role: z.string(),
  tier: z.number(),
  identity: z.object({
    name: z.string(),
    email: z.string(),
    avatar: z.string().optional(),
    slackHandle: z.string().optional(),
  }),
  responsibilities: z.array(z.string()),
  resourceLimits: z.object({
    maxSessions: z.number(),
    tokenBudget: z.object({
      subscription: z.string(),
      api: z.string(),
    }),
    memory: z.object({
      maxHeapMB: z.number(),
      maxContextTokens: z.number(),
    }),
  }),
  measurableObjectives: z.record(z.string()),
  hardConstraints: z.array(z.string()),
  safetyHeuristics: z.object({
    autoApprove: z.array(z.string()),
    alwaysReject: z.array(z.string()),
    escalate: z.array(z.string()),
  }),
});

export type VPCharter = z.infer<typeof VPCharterSchema>;

/**
 * Task definition
 */
export interface Task {
  id: string;
  type: 'code' | 'research' | 'analysis' | 'custom';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Session definition
 */
export interface Session {
  id: string;
  vpId: string;
  task: Task;
  type: 'claude-code' | 'claude-flow';
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'terminated';
  startedAt: Date;
  endedAt?: Date;
  memoryContext: MemoryContext;
  metrics: SessionMetrics;
}

/**
 * Memory context for sessions
 */
export interface MemoryContext {
  scratchpad: Record<string, unknown>;
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: Date;
  type: 'interaction' | 'observation' | 'decision' | 'knowledge';
  metadata?: Record<string, unknown>;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  tokensUsed: number;
  duration: number;
  tasksCompleted: number;
  errorsEncountered: number;
  averageResponseTime: number;
}

/**
 * Daemon status
 */
export interface DaemonStatus {
  status: 'initializing' | 'running' | 'degraded' | 'stopped';
  uptime: number;
  activeSessions: number;
  queuedTasks: number;
  metrics: DaemonMetrics;
  subsystems: Record<string, SubsystemStatus>;
}

/**
 * Subsystem status
 */
export interface SubsystemStatus {
  status: 'running' | 'degraded' | 'error' | 'stopped';
  lastCheck: Date;
  errors?: string[];
}

/**
 * Daemon metrics
 */
export interface DaemonMetrics {
  totalSessionsSpawned: number;
  totalTasksProcessed: number;
  totalTokensUsed: number;
  averageSessionDuration: number;
  activeSessions: number;
  successRate: number;
}

/**
 * WebSocket message types
 */
export type WSMessage =
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'spawn_session'; payload: SpawnSessionPayload }
  | { type: 'session_status'; payload: { sessionId: string } }
  | { type: 'daemon_status' }
  | { type: 'stop_session'; payload: { sessionId: string } }
  | { type: 'health_check' };

export interface SpawnSessionPayload {
  vpId: string;
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
  sessionType: 'claude-code' | 'claude-flow';
  memoryProfile?: string;
}

/**
 * WebSocket response types
 */
export type WSResponse =
  | { type: 'error'; error: string }
  | { type: 'pong' }
  | { type: 'session_spawned'; session: Session }
  | { type: 'session_status_update'; session: Session }
  | { type: 'daemon_status_update'; status: DaemonStatus }
  | { type: 'health_check_response'; healthy: boolean };

/**
 * Memory tier types
 */
export type MemoryTier = 'scratchpad' | 'episodic' | 'semantic';

/**
 * Memory configuration
 */
export interface MemoryConfig {
  version: string;
  tiers: {
    scratchpad: TierConfig;
    episodic: TierConfig;
    semantic: TierConfig;
  };
  compaction: {
    enabled: boolean;
    threshold: number;
    strategy: string;
  };
  retrieval: {
    strategy: string;
    maxResults: number;
    similarityThreshold: number;
  };
}

export interface TierConfig {
  description: string;
  maxSize: string;
  ttl: string;
  persistence: 'session' | 'local' | 'permanent';
}
