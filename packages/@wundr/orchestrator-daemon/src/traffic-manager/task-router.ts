/**
 * Task Router - Traffic Manager
 *
 * Determines which session manager and agent should handle an incoming task.
 * Works alongside the existing RoutingEngine by adapting daemon Task objects
 * into the traffic-manager's routing primitives (ContentAnalysis, discipline
 * matching) and then layering session-pool load awareness on top.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';

import { ContentAnalyzer } from './content-analyzer.js';
import { AgentRegistry } from './agent-registry.js';
import { MessagePriority } from './types.js';

import type { Task } from '../types/index.js';
import type { ContentAnalysis, AgentCapabilityProfile } from './types.js';
import type { SessionPool, SessionLoad } from './session-pool.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The outcome of a task routing decision.
 */
export interface TaskRoutingDecision {
  /** Session manager that will own this task's session. */
  targetSessionManagerId: string;
  /** Agent (capability profile) selected to execute the task. */
  targetAgentId: string;
  /** Whether an existing session was re-used or a new one is required. */
  sessionAction: 'reuse_existing' | 'create_new';
  /** Optional existing session ID when sessionAction is 'reuse_existing'. */
  existingSessionId?: string;
  /** Human-readable explanation of the routing choice. */
  reasoning: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Disciplines identified in the task content. */
  identifiedDisciplines: string[];
  /** Priority derived from the task payload. */
  effectivePriority: MessagePriority;
  /** Milliseconds spent computing the routing decision. */
  routingLatencyMs: number;
}

/**
 * Configuration for the TaskRouter.
 */
export interface TaskRouterConfig {
  /** Default session manager ID used when no better match is found. */
  defaultSessionManagerId: string;
  /** Prefer existing sessions when load is below this threshold (0–1). */
  reuseSessionLoadThreshold: number;
  /** Maximum sessions that can be open per session manager. */
  maxSessionsPerManager: number;
}

const DEFAULT_TASK_ROUTER_CONFIG: TaskRouterConfig = {
  defaultSessionManagerId: 'default',
  reuseSessionLoadThreshold: 0.7,
  maxSessionsPerManager: 10,
};

// Map daemon Task priority to traffic-manager MessagePriority
const TASK_PRIORITY_MAP: Record<Task['priority'], MessagePriority> = {
  low: MessagePriority.LOW,
  medium: MessagePriority.NORMAL,
  high: MessagePriority.HIGH,
  critical: MessagePriority.CRITICAL,
};

// Map daemon Task type to discipline keywords for content analysis
const TASK_TYPE_DISCIPLINES: Record<Task['type'], string[]> = {
  code: ['engineering'],
  research: ['product', 'operations'],
  analysis: ['finance', 'operations'],
  custom: [],
  general: [],
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface TaskRouterEvents {
  'task:routed': (decision: TaskRoutingDecision) => void;
  'task:routed_to_existing': (decision: TaskRoutingDecision) => void;
  'task:routed_to_new': (decision: TaskRoutingDecision) => void;
  'task:fallback': (decision: TaskRoutingDecision) => void;
}

// ---------------------------------------------------------------------------
// TaskRouter
// ---------------------------------------------------------------------------

/**
 * Routes incoming daemon Task objects to the appropriate session manager and
 * agent by combining content analysis with session-pool load awareness.
 */
export class TaskRouter extends EventEmitter<TaskRouterEvents> {
  private readonly analyzer: ContentAnalyzer;
  private readonly registry: AgentRegistry;
  private readonly sessionPool: SessionPool;
  private readonly config: TaskRouterConfig;

  constructor(
    registry: AgentRegistry,
    analyzer: ContentAnalyzer,
    sessionPool: SessionPool,
    config: Partial<TaskRouterConfig> = {}
  ) {
    super();
    this.registry = registry;
    this.analyzer = analyzer;
    this.sessionPool = sessionPool;
    this.config = { ...DEFAULT_TASK_ROUTER_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Primary entry point: decide which session manager and agent should handle
   * `task`, reusing or creating a session as appropriate.
   */
  routeTask(task: Task): TaskRoutingDecision {
    const start = Date.now();

    // Derive content analysis from the task description
    const analysis = this.analyzeTask(task);
    const effectivePriority = TASK_PRIORITY_MAP[task.priority];

    // Resolve the best agent for this task
    const agent = this.resolveAgent(task, analysis);

    // Determine session strategy
    const existingDecision = this.routeToExistingSession(task, analysis, agent);
    if (existingDecision) {
      const decision: TaskRoutingDecision = {
        ...existingDecision,
        effectivePriority,
        identifiedDisciplines: [...analysis.requiredDisciplines],
        routingLatencyMs: Date.now() - start,
      };
      this.emit('task:routed_to_existing', decision);
      this.emit('task:routed', decision);
      return decision;
    }

    const newDecision = this.routeToNewSession(task, analysis, agent);
    const decision: TaskRoutingDecision = {
      ...newDecision,
      effectivePriority,
      identifiedDisciplines: [...analysis.requiredDisciplines],
      routingLatencyMs: Date.now() - start,
    };

    this.emit('task:routed_to_new', decision);
    this.emit('task:routed', decision);
    return decision;
  }

  /**
   * Attempt to route `task` to an already-running session.
   * Returns null when no suitable existing session is available.
   */
  routeToExistingSession(
    task: Task,
    analysis: ContentAnalysis,
    agent: AgentCapabilityProfile | null
  ): Omit<
    TaskRoutingDecision,
    'effectivePriority' | 'identifiedDisciplines' | 'routingLatencyMs'
  > | null {
    if (!agent) return null;

    const loads = this.sessionPool.getSessionLoad();

    // Find session managers with idle capacity below the reuse threshold
    const candidateManagers = Object.entries(loads)
      .filter(([, load]) => {
        return (
          load.load < this.config.reuseSessionLoadThreshold &&
          load.activeSessions > 0 &&
          load.activeSessions < this.config.maxSessionsPerManager
        );
      })
      .sort(([, a], [, b]) => a.load - b.load);

    if (candidateManagers.length === 0) return null;

    const [bestManagerId] = candidateManagers[0]!;

    // Ask the pool for an idle session on that manager
    const existingSession =
      this.sessionPool.getIdleSession(bestManagerId) ?? null;
    if (!existingSession) return null;

    return {
      targetSessionManagerId: bestManagerId,
      targetAgentId: agent.id,
      sessionAction: 'reuse_existing',
      existingSessionId: existingSession.sessionId,
      reasoning: `Reusing idle session ${existingSession.sessionId} on manager ${bestManagerId} (load ${loads[bestManagerId]?.load.toFixed(2)}); agent "${agent.name}" matched discipline "${analysis.requiredDisciplines[0] ?? 'general'}" for task "${task.type}"`,
      confidence: 0.85,
    };
  }

  /**
   * Route `task` to a new session on the least-loaded session manager.
   */
  routeToNewSession(
    task: Task,
    analysis: ContentAnalysis,
    agent: AgentCapabilityProfile | null
  ): Omit<
    TaskRoutingDecision,
    'effectivePriority' | 'identifiedDisciplines' | 'routingLatencyMs'
  > {
    const loads = this.sessionPool.getSessionLoad();

    // Pick the session manager with the most headroom
    const bestManagerId = this.selectBestManager(loads);

    const agentId = agent?.id ?? this.config.defaultSessionManagerId;
    const agentName = agent?.name ?? 'default';
    const topDiscipline = analysis.requiredDisciplines[0] ?? 'general';

    const isFallback = !agent;
    const confidence = isFallback ? 0.3 : 0.75;

    const reasoning = isFallback
      ? `No discipline-matched agent found for task "${task.id}" (type="${task.type}"); routing to default on manager ${bestManagerId}`
      : `New session on manager ${bestManagerId}; agent "${agentName}" selected for discipline "${topDiscipline}" (task type="${task.type}", priority="${task.priority}")`;

    const decision: Omit<
      TaskRoutingDecision,
      'effectivePriority' | 'identifiedDisciplines' | 'routingLatencyMs'
    > = {
      targetSessionManagerId: bestManagerId,
      targetAgentId: agentId,
      sessionAction: 'create_new',
      reasoning,
      confidence,
    };

    if (isFallback) {
      // Emitting fallback is handled by the caller (routeTask)
    }

    return decision;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build a lightweight ContentAnalysis from a Task without requiring a full
   * NormalizedMessage. We synthesize the message text from the task description
   * and type to leverage the existing keyword-based ContentAnalyzer.
   */
  private analyzeTask(task: Task): ContentAnalysis {
    // Inject type-derived discipline terms alongside the free-text description
    const typeDisciplines = TASK_TYPE_DISCIPLINES[task.type] ?? [];
    const syntheticText = [task.description, ...typeDisciplines].join(' ');

    const syntheticMessage = {
      id: task.id,
      channelId: 'task-router' as const,
      platformMessageId: task.id,
      conversationId: 'task-router-internal',
      chatType: 'direct' as const,
      sender: {
        id: 'system',
        displayName: 'TaskRouter',
        isSelf: false,
        isBot: true,
      },
      content: {
        text: syntheticText,
        rawText: syntheticText,
        attachments: [] as const,
        mentions: [] as const,
        mentionsSelf: false,
      },
      timestamp: new Date(),
      raw: {},
    };

    return this.analyzer.analyze(
      syntheticMessage as Parameters<ContentAnalyzer['analyze']>[0]
    );
  }

  /**
   * Find the best available agent for this task by:
   * 1. Explicit @mention in task description
   * 2. Assigned agent on the task (task.assignedTo)
   * 3. Best discipline match
   * 4. Load-balanced fallback
   */
  private resolveAgent(
    task: Task,
    analysis: ContentAnalysis
  ): AgentCapabilityProfile | null {
    // 1. @mention
    for (const name of analysis.mentionedAgentNames) {
      const agent = this.registry
        .listAgents()
        .find(a => a.name.toLowerCase() === name.toLowerCase());
      if (agent && agent.status === 'available') return agent;
    }

    // 2. Explicit assignment
    if (task.assignedTo) {
      const assigned = this.registry.getAgent(task.assignedTo);
      if (assigned && assigned.status === 'available') return assigned;
    }

    // 3. Discipline match weighted by seniority and load
    if (analysis.requiredDisciplines.length > 0) {
      const match = this.bestDisciplineMatch(analysis.requiredDisciplines);
      if (match) return match;
    }

    // 4. Lowest-load available agent
    const available = this.registry.listAvailable();
    if (available.length > 0) {
      return available.reduce((best, a) =>
        a.currentLoad < best.currentLoad ? a : best
      );
    }

    return null;
  }

  /**
   * Select the agent with the best capability match across the given
   * disciplines, preferring available agents then low load.
   */
  private bestDisciplineMatch(
    disciplines: readonly string[]
  ): AgentCapabilityProfile | null {
    const candidates: AgentCapabilityProfile[] = [];
    for (const discipline of disciplines) {
      candidates.push(...this.registry.findByDiscipline(discipline));
    }
    if (candidates.length === 0) return null;

    return (
      candidates.sort((a, b) => {
        const aAvail = a.status === 'available' ? 1 : 0;
        const bAvail = b.status === 'available' ? 1 : 0;
        if (aAvail !== bAvail) return bAvail - aAvail;
        return a.currentLoad - b.currentLoad;
      })[0] ?? null
    );
  }

  /**
   * Choose the session manager with the most remaining capacity.
   * Falls back to the configured default when no load data is present.
   */
  private selectBestManager(loads: Record<string, SessionLoad>): string {
    const entries = Object.entries(loads);
    if (entries.length === 0) return this.config.defaultSessionManagerId;

    // Filter out managers at capacity
    const available = entries.filter(
      ([, l]) => l.activeSessions < this.config.maxSessionsPerManager
    );

    if (available.length === 0) {
      // All at capacity – pick the one with lowest load anyway
      return entries.sort(([, a], [, b]) => a.load - b.load)[0]![0];
    }

    // Prefer manager with lowest load
    return available.sort(([, a], [, b]) => a.load - b.load)[0]![0];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTaskRouter(
  registry: AgentRegistry,
  analyzer: ContentAnalyzer,
  sessionPool: SessionPool,
  config?: Partial<TaskRouterConfig>
): TaskRouter {
  return new TaskRouter(registry, analyzer, sessionPool, config);
}
