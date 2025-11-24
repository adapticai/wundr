/**
 * Session Types
 *
 * Defines comprehensive TypeScript types for session configuration and runtime context.
 * Sessions represent compiled work environments that agents operate within, including
 * their memory banks, configurations, and resource allocations.
 *
 * @module @wundr/org-genesis/types/session
 */

/**
 * Represents the lifecycle status of a session.
 *
 * Status transitions:
 * - pending -> compiling: Session compilation initiated
 * - compiling -> ready: Compilation successful, awaiting activation
 * - compiling -> failed: Compilation encountered errors
 * - ready -> active: Session activated and agents deployed
 * - active -> paused: Session temporarily suspended (resources retained)
 * - paused -> active: Session resumed from paused state
 * - active -> completed: Session finished successfully
 * - active -> failed: Session encountered unrecoverable error
 *
 * @example
 * ```typescript
 * const status: SessionStatus = 'active';
 * if (status === 'active' || status === 'paused') {
 *   console.log('Session is still running');
 * }
 * ```
 */
export type SessionStatus =
  | 'pending'
  | 'compiling'
  | 'ready'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * Memory bank structure for session state persistence.
 *
 * Each session maintains its own memory bank with designated paths for
 * different types of persistent data. This enables agents to maintain
 * context across interactions and recover from interruptions.
 *
 * @example
 * ```typescript
 * const memoryBank: MemoryBank = {
 *   activeContextPath: '.memory/active-context.json',
 *   progressPath: '.memory/progress.json',
 *   productContextPath: '.memory/product-context.json',
 *   decisionLogPath: '.memory/decision-log.json',
 * };
 * ```
 */
export interface MemoryBank {
  /**
   * Path to the active context file.
   * Contains current working state, recent interactions, and immediate goals.
   * Updated frequently during session activity.
   */
  activeContextPath: string;

  /**
   * Path to the progress tracking file.
   * Records completed tasks, milestones, and overall session advancement.
   * Used for warm-start recovery and progress reporting.
   */
  progressPath: string;

  /**
   * Path to the product context file.
   * Contains domain knowledge, requirements, and business logic context.
   * Typically more stable than active context.
   */
  productContextPath: string;

  /**
   * Path to the decision log file.
   * Records key decisions made during the session with rationale.
   * Used for audit trails and learning from past decisions.
   */
  decisionLogPath: string;
}

/**
 * Compiled session configuration ready for deployment.
 *
 * This represents the fully resolved and validated configuration
 * that will be used to initialize a session. All templates have
 * been processed and all dependencies resolved.
 *
 * @example
 * ```typescript
 * const config: CompiledSessionConfig = {
 *   claudeMdContent: '# Session Configuration\n...',
 *   claudeConfigJson: { settings: { theme: 'dark' } },
 *   settingsJson: { maxTokens: 8000, timeout: 300000 },
 *   agentDefinitions: [
 *     '.claude/agents/coder.md',
 *     '.claude/agents/reviewer.md',
 *   ],
 * };
 * ```
 */
export interface CompiledSessionConfig {
  /**
   * The fully compiled CLAUDE.md content.
   * Includes merged instructions from discipline, VP, and task-specific configurations.
   * This becomes the primary instruction set for the session.
   */
  claudeMdContent: string;

  /**
   * Compiled claude.config.json as a parsed object.
   * Contains Claude-specific settings, permissions, and behavior configurations.
   */
  claudeConfigJson: Record<string, unknown>;

  /**
   * Compiled settings.json as a parsed object.
   * Contains IDE/editor settings, formatting preferences, and tool configurations.
   */
  settingsJson: Record<string, unknown>;

  /**
   * Array of paths to agent definition files (.md).
   * Each path points to an agent persona definition that will be available
   * during the session. Agents are loaded on-demand.
   */
  agentDefinitions: string[];
}

/**
 * Runtime session context containing all state for an active session.
 *
 * This is the primary runtime object representing a session. It combines
 * the compiled configuration with runtime state like active agents,
 * timing information, and dynamic metadata.
 *
 * @example
 * ```typescript
 * const session: SessionContext = {
 *   id: 'session-abc123',
 *   disciplineId: 'backend-engineering',
 *   parentVpId: 'vp-eng-001',
 *   worktreePath: '/worktrees/feature-auth',
 *   status: 'active',
 *   compiledConfig: { ... },
 *   memoryBank: { ... },
 *   activeAgentIds: ['coder-001', 'reviewer-001'],
 *   startedAt: new Date('2025-01-15T10:00:00Z'),
 *   metadata: { priority: 'high', estimatedDuration: 3600000 },
 * };
 * ```
 */
export interface SessionContext {
  /**
   * Unique identifier for this session.
   * Format: session-{ulid} or session-{uuid}
   */
  id: string;

  /**
   * The discipline this session operates under.
   * Determines the base configuration, available tools, and agent pool.
   * @example 'backend-engineering', 'frontend-dev', 'data-science'
   */
  disciplineId: string;

  /**
   * The VP (Virtual Person) that owns this session.
   * Sessions are always owned by a VP who provides resources and oversight.
   */
  parentVpId: string;

  /**
   * Optional Session Manager ID for coordinated multi-session workflows.
   * When set, this session is part of a larger orchestrated effort.
   */
  sessionManagerId?: string;

  /**
   * Filesystem path to the git worktree for this session.
   * Each session operates in an isolated worktree for safety.
   */
  worktreePath: string;

  /**
   * Current lifecycle status of the session.
   * @see SessionStatus for valid values and transitions.
   */
  status: SessionStatus;

  /**
   * The compiled configuration used to initialize this session.
   * Immutable after session creation.
   */
  compiledConfig: CompiledSessionConfig;

  /**
   * Memory bank paths for this session.
   * All paths are relative to the worktreePath.
   */
  memoryBank: MemoryBank;

  /**
   * IDs of currently active agents within this session.
   * Agents may be spawned or terminated during session lifecycle.
   */
  activeAgentIds: string[];

  /**
   * Timestamp when the session transitioned to 'active' status.
   * Undefined for sessions that have not yet started.
   */
  startedAt?: Date;

  /**
   * Timestamp when the session transitioned to 'completed' or 'failed'.
   * Undefined for sessions that are still running.
   */
  completedAt?: Date;

  /**
   * Extensible metadata for custom session properties.
   * Use this for application-specific data that doesn't fit other fields.
   */
  metadata: Record<string, unknown>;
}

/**
 * Request parameters for compiling a new session.
 *
 * This is the input to the session compilation process. It specifies
 * what kind of session to create and any customizations needed.
 *
 * @example
 * ```typescript
 * const request: CompileSessionRequest = {
 *   discipline: 'backend-engineering',
 *   taskDescription: 'Implement user authentication with OAuth2',
 *   vpId: 'vp-eng-001',
 *   worktreeBasePath: '/worktrees',
 *   warmStartContext: 'Previous session implemented basic user model...',
 *   additionalAgents: ['security-reviewer', 'api-designer'],
 *   mcpOverrides: { maxParallelTools: 5 },
 * };
 * ```
 */
export interface CompileSessionRequest {
  /**
   * The discipline to compile the session for.
   * Must be a valid discipline ID registered in the organization.
   */
  discipline: string;

  /**
   * Human-readable description of the task to be performed.
   * Used to customize the session configuration and select appropriate agents.
   */
  taskDescription: string;

  /**
   * The VP ID that will own this session.
   * Must have available session slots.
   */
  vpId: string;

  /**
   * Base path for creating the session's git worktree.
   * If not specified, uses a default location.
   * @default '/tmp/wundr-worktrees'
   */
  worktreeBasePath?: string;

  /**
   * Optional context from a previous session for warm-starting.
   * When provided, the new session will have access to prior context
   * to accelerate onboarding and avoid redundant work.
   */
  warmStartContext?: string;

  /**
   * Additional agent IDs to include beyond the discipline defaults.
   * Allows task-specific agent augmentation.
   */
  additionalAgents?: string[];

  /**
   * MCP (Model Context Protocol) configuration overrides.
   * Allows customization of tool availability and behavior.
   */
  mcpOverrides?: Record<string, unknown>;
}

/**
 * Result of a session compilation attempt.
 *
 * Contains either a successfully compiled session context or
 * error information if compilation failed.
 *
 * @example
 * ```typescript
 * // Successful compilation
 * const success: CompileSessionResult = {
 *   success: true,
 *   sessionContext: { ... },
 *   compilationTimeMs: 1234,
 * };
 *
 * // Failed compilation
 * const failure: CompileSessionResult = {
 *   success: false,
 *   error: 'Unknown discipline: invalid-discipline',
 *   compilationTimeMs: 56,
 * };
 * ```
 */
export interface CompileSessionResult {
  /**
   * Whether compilation completed successfully.
   * When true, sessionContext will be defined.
   * When false, error will contain details.
   */
  success: boolean;

  /**
   * The compiled session context, available when success is true.
   * Ready to be activated and used.
   */
  sessionContext?: SessionContext;

  /**
   * Error message when compilation fails.
   * Contains diagnostic information for troubleshooting.
   */
  error?: string;

  /**
   * Time taken to compile the session in milliseconds.
   * Useful for performance monitoring and optimization.
   */
  compilationTimeMs: number;
}

/**
 * Session slot for VP resource management.
 *
 * VPs have a limited number of concurrent session slots. This type
 * tracks the allocation and status of each slot, enabling fair
 * resource distribution and capacity planning.
 *
 * Slot lifecycle:
 * - available: Slot is free and can be reserved
 * - reserved: Slot is held for an upcoming session (time-limited)
 * - active: Slot has an active session running
 *
 * @example
 * ```typescript
 * const slot: SessionSlot = {
 *   slotId: 'slot-001',
 *   vpId: 'vp-eng-001',
 *   sessionId: 'session-abc123',
 *   status: 'active',
 *   reservedAt: new Date('2025-01-15T09:55:00Z'),
 *   activatedAt: new Date('2025-01-15T10:00:00Z'),
 * };
 * ```
 */
export interface SessionSlot {
  /**
   * Unique identifier for this slot.
   * Format: slot-{index} or slot-{ulid}
   */
  slotId: string;

  /**
   * The VP that owns this slot.
   * Slots are permanently assigned to VPs.
   */
  vpId: string;

  /**
   * ID of the session currently using this slot.
   * Undefined when slot is available.
   */
  sessionId?: string;

  /**
   * Current status of the slot.
   * - 'available': Ready to be reserved or activated
   * - 'reserved': Held for an upcoming session (expires after timeout)
   * - 'active': Currently running a session
   */
  status: 'available' | 'reserved' | 'active';

  /**
   * Timestamp when the slot was reserved.
   * Used to enforce reservation timeouts.
   */
  reservedAt?: Date;

  /**
   * Timestamp when the slot transitioned to active.
   * Used for session duration tracking.
   */
  activatedAt?: Date;
}

/**
 * Options for session lifecycle operations.
 */
export interface SessionLifecycleOptions {
  /**
   * Whether to force the operation even if conditions aren't ideal.
   * Use with caution - may result in data loss or inconsistent state.
   * @default false
   */
  force?: boolean;

  /**
   * Timeout in milliseconds for the operation.
   * Operations exceeding this will be cancelled.
   * @default 30000
   */
  timeoutMs?: number;

  /**
   * Whether to wait for graceful shutdown of agents.
   * When false, agents are terminated immediately.
   * @default true
   */
  graceful?: boolean;
}

/**
 * Session metrics for monitoring and reporting.
 */
export interface SessionMetrics {
  /**
   * Session identifier these metrics belong to.
   */
  sessionId: string;

  /**
   * Total duration the session has been active in milliseconds.
   */
  activeDurationMs: number;

  /**
   * Number of agent spawns during this session.
   */
  agentSpawnCount: number;

  /**
   * Number of tool invocations during this session.
   */
  toolInvocationCount: number;

  /**
   * Approximate token usage for the session.
   */
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * Number of memory bank read operations.
   */
  memoryReads: number;

  /**
   * Number of memory bank write operations.
   */
  memoryWrites: number;

  /**
   * Timestamp when metrics were last updated.
   */
  lastUpdated: Date;
}

/**
 * Session event for audit logging and event streaming.
 */
export interface SessionEvent {
  /**
   * Unique event identifier.
   */
  eventId: string;

  /**
   * Session this event belongs to.
   */
  sessionId: string;

  /**
   * Type of event that occurred.
   */
  eventType:
    | 'session.created'
    | 'session.compiled'
    | 'session.activated'
    | 'session.paused'
    | 'session.resumed'
    | 'session.completed'
    | 'session.failed'
    | 'agent.spawned'
    | 'agent.terminated'
    | 'memory.updated'
    | 'error.occurred';

  /**
   * Timestamp when the event occurred.
   */
  timestamp: Date;

  /**
   * Event-specific payload data.
   */
  payload: Record<string, unknown>;

  /**
   * Optional actor (agent or user) that triggered the event.
   */
  actorId?: string;
}
