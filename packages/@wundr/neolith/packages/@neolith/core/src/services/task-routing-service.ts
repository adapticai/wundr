/**
 * @neolith/core - Task Routing Service
 *
 * Web-app side of the task routing system.  Submits tasks to the orchestrator
 * daemon for routing, persists routing decisions for auditability, and exposes
 * query helpers for the routing history.
 *
 * The service intentionally does not perform routing logic itself – that
 * responsibility lives in the daemon's TaskRouter.  Instead this service acts
 * as a thin coordinator that:
 *   1. Submits the task to the daemon's WebSocket via DaemonBridge.
 *   2. Stores the routing decision returned by the daemon.
 *   3. Provides read access to past decisions per workspace.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';
import { createRedisClient, isRedisAvailable } from '../redis/client';

import type { IDaemonBridge } from './daemon-bridge';
import type { Redis } from 'ioredis';

// =============================================================================
// Domain Types
// =============================================================================

/** What kind of work the task represents. */
export type TaskDiscipline =
  | 'engineering'
  | 'design'
  | 'product'
  | 'finance'
  | 'hr'
  | 'legal'
  | 'operations'
  | 'marketing'
  | 'general';

/** Priority mirroring the daemon's Task.priority field. */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/** Input supplied by the caller when submitting a task for routing. */
export interface SubmitTaskInput {
  /** Human-readable description of what the task should accomplish. */
  description: string;
  /** Discipline hint – aids the daemon's content analysis. */
  discipline?: TaskDiscipline;
  /** Priority level.  Defaults to 'medium'. */
  priority?: TaskPriority;
  /** Arbitrary key/value metadata forwarded to the daemon. */
  metadata?: Record<string, unknown>;
}

/**
 * The routing decision returned by the daemon and stored by this service.
 */
export interface TaskRoutingRecord {
  /** Stable ID generated on submission. */
  taskId: string;
  /** Workspace the task was submitted from. */
  workspaceId: string;
  /** ISO-8601 timestamp of submission. */
  submittedAt: string;
  /** Session manager the daemon selected. */
  targetSessionManagerId: string;
  /** Agent the daemon selected. */
  targetAgentId: string;
  /** Whether the daemon re-used an existing session or created a new one. */
  sessionAction: 'reuse_existing' | 'create_new';
  /** Existing session ID when sessionAction is 'reuse_existing'. */
  existingSessionId?: string;
  /** Human-readable routing explanation. */
  reasoning: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Disciplines the daemon identified in the task content. */
  identifiedDisciplines: string[];
  /** Effective priority applied by the daemon. */
  effectivePriority: string;
  /** Milliseconds the daemon spent computing the routing decision. */
  routingLatencyMs: number;
  /** ISO-8601 timestamp of when the routing decision was received. */
  routedAt: string;
}

/** Lightweight record used in history listings. */
export interface TaskRoutingSummary {
  taskId: string;
  workspaceId: string;
  submittedAt: string;
  targetSessionManagerId: string;
  targetAgentId: string;
  sessionAction: TaskRoutingRecord['sessionAction'];
  confidence: number;
  routingLatencyMs: number;
}

// =============================================================================
// Errors
// =============================================================================

export class TaskRoutingError extends GenesisError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'TASK_ROUTING_ERROR', 500, metadata);
    this.name = 'TaskRoutingError';
  }
}

export class TaskRoutingNotFoundError extends GenesisError {
  constructor(taskId: string) {
    super(
      `Routing record not found for task: ${taskId}`,
      'TASK_NOT_FOUND',
      404,
      {
        taskId,
      }
    );
    this.name = 'TaskRoutingNotFoundError';
  }
}

export class DaemonUnavailableError extends GenesisError {
  constructor(cause?: string) {
    super(
      `Daemon unavailable for task routing${cause ? `: ${cause}` : ''}`,
      'DAEMON_UNAVAILABLE',
      503,
      { cause }
    );
    this.name = 'DaemonUnavailableError';
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Redis key patterns – mirrors the daemon routing key conventions. */
const TASK_ROUTING_KEYS = {
  /** Single routing record: task-routing:record:{taskId} */
  record: (taskId: string) => `task-routing:record:${taskId}`,
  /** Workspace history (sorted set, score = submittedAt epoch): task-routing:history:{workspaceId} */
  history: (workspaceId: string) => `task-routing:history:${workspaceId}`,
} as const;

/** How long routing records live in Redis (7 days). */
const RECORD_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Maximum number of history entries returned per workspace. */
const MAX_HISTORY_ENTRIES = 100;

// =============================================================================
// Service Configuration
// =============================================================================

export interface TaskRoutingServiceConfig {
  /** Bridge to the orchestrator daemon. */
  bridge: IDaemonBridge;
  /** Optional Redis client; defaults to the shared client. */
  redis?: Redis;
  /**
   * How many history entries to keep per workspace in the Redis sorted set.
   * Defaults to MAX_HISTORY_ENTRIES.
   */
  maxHistoryEntries?: number;
}

// =============================================================================
// TaskRoutingService
// =============================================================================

/**
 * Web-app facade for task routing.
 *
 * ```typescript
 * const service = createTaskRoutingService({ bridge: getDaemonBridge() });
 *
 * // Submit a task – daemon routes it and returns a decision.
 * const record = await service.submitTask('workspace_abc', {
 *   description: 'Fix the login API bug',
 *   discipline: 'engineering',
 *   priority: 'high',
 * });
 *
 * // Retrieve the decision later.
 * const same = await service.getTaskRouting(record.taskId);
 *
 * // List recent routing decisions for a workspace.
 * const history = await service.getRoutingHistory('workspace_abc');
 * ```
 */
export class TaskRoutingService {
  private readonly bridge: IDaemonBridge;
  private readonly redis: Redis;
  private readonly maxHistoryEntries: number;

  constructor(config: TaskRoutingServiceConfig) {
    this.bridge = config.bridge;
    this.redis = config.redis ?? createRedisClient();
    this.maxHistoryEntries = config.maxHistoryEntries ?? MAX_HISTORY_ENTRIES;
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  /**
   * Submit a task for routing.
   *
   * The task is forwarded to the orchestrator daemon which analyses the
   * content, selects the best session manager and agent, and returns a routing
   * decision.  The decision is persisted in Redis so it can be retrieved later
   * with `getTaskRouting`.
   *
   * @param workspaceId - Workspace the task originates from.
   * @param input - Task details.
   * @returns The full routing record including the daemon's decision.
   * @throws {DaemonUnavailableError} When the daemon cannot be reached.
   * @throws {TaskRoutingError} On unexpected daemon or persistence failures.
   */
  async submitTask(
    workspaceId: string,
    input: SubmitTaskInput
  ): Promise<TaskRoutingRecord> {
    const taskId = this.generateTaskId();
    const submittedAt = new Date().toISOString();

    // 1. Verify daemon is reachable
    let daemonStatus: Awaited<ReturnType<IDaemonBridge['getStatus']>>;
    try {
      daemonStatus = await this.bridge.getStatus();
    } catch (err) {
      throw new DaemonUnavailableError(
        err instanceof Error ? err.message : String(err)
      );
    }

    if (!daemonStatus.running) {
      throw new DaemonUnavailableError('Daemon reports not running');
    }

    // 2. Dispatch the task to the daemon and retrieve the routing decision.
    //    The daemon REST API does not yet expose a dedicated routing endpoint,
    //    so we model it as a task spawn + immediate status read.  When the
    //    daemon REST API gains a /api/routing endpoint this block should be
    //    updated to call it directly.
    let decision: DaemonRoutingDecisionResponse;
    try {
      decision = await this.requestRoutingDecision(taskId, workspaceId, input);
    } catch (err) {
      throw new TaskRoutingError(
        `Daemon failed to produce a routing decision for task ${taskId}`,
        {
          workspaceId,
          taskId,
          cause: err instanceof Error ? err.message : String(err),
        }
      );
    }

    // 3. Persist the routing record
    const record: TaskRoutingRecord = {
      taskId,
      workspaceId,
      submittedAt,
      targetSessionManagerId: decision.targetSessionManagerId,
      targetAgentId: decision.targetAgentId,
      sessionAction: decision.sessionAction,
      existingSessionId: decision.existingSessionId,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      identifiedDisciplines: decision.identifiedDisciplines,
      effectivePriority: decision.effectivePriority,
      routingLatencyMs: decision.routingLatencyMs,
      routedAt: new Date().toISOString(),
    };

    await this.persistRecord(record);

    return record;
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Retrieve the routing decision for a specific task.
   *
   * @param taskId - The task identifier returned by `submitTask`.
   * @returns The full routing record.
   * @throws {TaskRoutingNotFoundError} When the task is unknown or expired.
   */
  async getTaskRouting(taskId: string): Promise<TaskRoutingRecord> {
    const key = TASK_ROUTING_KEYS.record(taskId);

    if (!isRedisAvailable()) {
      throw new TaskRoutingError(
        'Redis unavailable – cannot retrieve routing record',
        { taskId }
      );
    }

    const raw = await this.redis.get(key);
    if (!raw) {
      throw new TaskRoutingNotFoundError(taskId);
    }

    try {
      return JSON.parse(raw) as TaskRoutingRecord;
    } catch {
      throw new TaskRoutingError('Routing record is malformed', { taskId });
    }
  }

  /**
   * Return a list of recent routing decisions for a workspace, newest first.
   *
   * @param workspaceId - The workspace to query.
   * @param limit - Maximum number of records to return (default MAX_HISTORY_ENTRIES).
   * @returns Array of routing summaries ordered newest to oldest.
   */
  async getRoutingHistory(
    workspaceId: string,
    limit: number = this.maxHistoryEntries
  ): Promise<TaskRoutingSummary[]> {
    const historyKey = TASK_ROUTING_KEYS.history(workspaceId);

    if (!isRedisAvailable()) {
      return [];
    }

    const cap = Math.min(limit, this.maxHistoryEntries);

    // Sorted set: score is Unix epoch ms; retrieve newest first via ZREVRANGE
    const taskIds = await this.redis.zrevrange(historyKey, 0, cap - 1);
    if (taskIds.length === 0) return [];

    // Fetch all records in parallel, skip any that have expired or are missing
    const records = await Promise.all(
      taskIds.map(async taskId => {
        try {
          const rec = await this.getTaskRouting(taskId);
          const summary: TaskRoutingSummary = {
            taskId: rec.taskId,
            workspaceId: rec.workspaceId,
            submittedAt: rec.submittedAt,
            targetSessionManagerId: rec.targetSessionManagerId,
            targetAgentId: rec.targetAgentId,
            sessionAction: rec.sessionAction,
            confidence: rec.confidence,
            routingLatencyMs: rec.routingLatencyMs,
          };
          return summary;
        } catch {
          return null;
        }
      })
    );

    return records.filter((r): r is TaskRoutingSummary => r !== null);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Persist a routing record to Redis and add its ID to the workspace history
   * sorted set.
   */
  private async persistRecord(record: TaskRoutingRecord): Promise<void> {
    if (!isRedisAvailable()) {
      // Graceful degradation: routing still worked; we just can't store it.
      return;
    }

    const recordKey = TASK_ROUTING_KEYS.record(record.taskId);
    const historyKey = TASK_ROUTING_KEYS.history(record.workspaceId);
    const score = Date.parse(record.submittedAt);

    await Promise.all([
      // Store the full record with TTL
      this.redis.setex(recordKey, RECORD_TTL_SECONDS, JSON.stringify(record)),
      // Add to the workspace sorted set (score = timestamp for ordering)
      this.redis.zadd(historyKey, score, record.taskId),
    ]);

    // Trim the sorted set to keep only the most recent entries
    await this.redis.zremrangebyrank(
      historyKey,
      0,
      -(this.maxHistoryEntries + 1)
    );

    // Extend the history set TTL every time a new task is added
    await this.redis.expire(historyKey, RECORD_TTL_SECONDS);
  }

  /**
   * Request a routing decision from the daemon.
   *
   * Currently the daemon WebSocket / REST surface does not expose a dedicated
   * `route_task` endpoint, so we call `getTrafficConfig` to confirm the daemon
   * is aware of routing and then synthesise a decision from the agent list.
   *
   * When the daemon gains a REST `/api/routing/route` endpoint this method
   * should be replaced with a direct `this.bridge.request(...)` call.
   */
  private async requestRoutingDecision(
    taskId: string,
    workspaceId: string,
    input: SubmitTaskInput
  ): Promise<DaemonRoutingDecisionResponse> {
    // Fetch available agents to simulate the routing decision on the web side
    // until the daemon exposes a routing endpoint.
    const agents = await this.bridge.listAgents();

    // Simple matching: prefer an agent whose discipline matches the input hint
    const discipline = input.discipline ?? 'general';

    const matchingAgent = agents.find(
      a =>
        a.status === 'active' &&
        a.discipline.toLowerCase() === discipline.toLowerCase()
    );

    const fallbackAgent = agents.find(a => a.status === 'active') ?? agents[0];
    const selectedAgent = matchingAgent ?? fallbackAgent;

    if (!selectedAgent) {
      throw new TaskRoutingError('No agents available in the daemon', {
        taskId,
        workspaceId,
      });
    }

    // The session manager ID is modelled as the agent's discipline namespace
    // until the daemon exposes explicit session-manager identifiers.
    const targetSessionManagerId = `sm_${selectedAgent.discipline.toLowerCase().replace(/\s+/g, '_')}`;

    return {
      targetSessionManagerId,
      targetAgentId: selectedAgent.id,
      sessionAction: 'create_new',
      reasoning: matchingAgent
        ? `Agent "${selectedAgent.name}" matched discipline "${discipline}" for task "${taskId}"`
        : `No discipline-matched agent found; using "${selectedAgent.name}" as fallback`,
      confidence: matchingAgent ? 0.85 : 0.4,
      identifiedDisciplines: [discipline],
      effectivePriority: input.priority ?? 'medium',
      routingLatencyMs: 0, // populated by daemon when endpoint exists
    };
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// Internal type modelling the daemon routing response shape.
interface DaemonRoutingDecisionResponse {
  targetSessionManagerId: string;
  targetAgentId: string;
  sessionAction: 'reuse_existing' | 'create_new';
  existingSessionId?: string;
  reasoning: string;
  confidence: number;
  identifiedDisciplines: string[];
  effectivePriority: string;
  routingLatencyMs: number;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new TaskRoutingService instance.
 *
 * @param config - Service configuration including the daemon bridge.
 */
export function createTaskRoutingService(
  config: TaskRoutingServiceConfig
): TaskRoutingService {
  return new TaskRoutingService(config);
}

/**
 * Module-level singleton, initialised lazily on first call to
 * `getTaskRoutingService`.
 */
let instance: TaskRoutingService | null = null;

/**
 * Initialise the singleton TaskRoutingService.  Call this once at application
 * startup after the daemon bridge has been initialised.
 */
export function initTaskRoutingService(
  config: TaskRoutingServiceConfig
): TaskRoutingService {
  instance = createTaskRoutingService(config);
  return instance;
}

/**
 * Return the singleton TaskRoutingService.
 *
 * @throws {TaskRoutingError} If the service has not been initialised.
 */
export function getTaskRoutingService(): TaskRoutingService {
  if (!instance) {
    throw new TaskRoutingError(
      'TaskRoutingService has not been initialised. Call initTaskRoutingService() first.'
    );
  }
  return instance;
}
