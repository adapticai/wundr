/**
 * @wundr/orchestrator-daemon - Agent Type Definitions
 *
 * Canonical type system for the subagent registry. Defines the metadata schema
 * for agent definitions loaded from .claude/agents/ markdown files, run records
 * for lifecycle tracking, and supporting types for groups, mailbox, and resources.
 *
 * Design reference: OpenClaw's SubagentRunRecord + Wundr's 54-agent taxonomy.
 * Extended with memory scopes, tool restrictions, permission inheritance,
 * heartbeat-based health monitoring, and persisted agent state.
 */

import { z } from 'zod';

// =============================================================================
// Agent Definition Enums
// =============================================================================

/**
 * Agent type classifications matching Wundr's taxonomy.
 * Used in Task(agent_type) restriction syntax.
 */
export const AgentTypeSchema = z.enum([
  'developer',
  'coordinator',
  'evaluator',
  'session-manager',
  'researcher',
  'reviewer',
  'tester',
  'planner',
  'specialist',
  'swarm-coordinator',
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

/**
 * Four-tier agent hierarchy:
 *   Tier 0: Evaluators (human cortex support)
 *   Tier 1: Orchestrators
 *   Tier 2: Session Managers
 *   Tier 3: Specialist Agents
 */
export const AgentTierSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type AgentTier = z.infer<typeof AgentTierSchema>;

export const AgentPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);
export type AgentPriority = z.infer<typeof AgentPrioritySchema>;

export const ModelPreferenceSchema = z.enum(['opus', 'sonnet', 'haiku']);
export type ModelPreference = z.infer<typeof ModelPreferenceSchema>;

export const PermissionModeSchema = z.enum(['acceptEdits', 'ask', 'deny']);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const CleanupModeSchema = z.enum(['delete', 'keep']);
export type CleanupMode = z.infer<typeof CleanupModeSchema>;

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'timeout',
  'cancelled',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// =============================================================================
// Memory Scopes
// =============================================================================

/**
 * Memory scope levels for agent state isolation.
 * Adapted from OpenClaw's agent-scope patterns:
 *   - user:    scoped to the current user across all projects
 *   - project: scoped to the current project across all sessions
 *   - local:   scoped to the current session only (ephemeral)
 *   - global:  shared across all users and projects
 */
export const MemoryScopeSchema = z.enum([
  'user',
  'project',
  'local',
  'global',
]);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

// =============================================================================
// Tool Restrictions
// =============================================================================

/**
 * Restricts which tools an agent may use.
 * At most one of `allowed` or `denied` should be set.
 * If both are omitted, the agent inherits from its parent or uses all tools.
 */
export interface ToolRestrictions {
  /** Explicit allowlist of tool names. If set, only these tools are available. */
  readonly allowed?: readonly string[];
  /** Explicit denylist of tool names. If set, these tools are removed from the available set. */
  readonly denied?: readonly string[];
}

export const ToolRestrictionsSchema = z.object({
  allowed: z.array(z.string()).optional(),
  denied: z.array(z.string()).optional(),
}).optional();

// =============================================================================
// Agent Permissions
// =============================================================================

/**
 * Permission set that can be inherited from parent to child agent.
 * When a child agent is spawned, its effective permissions are the
 * intersection of its own declared permissions and its parent's grants.
 */
export interface AgentPermissions {
  /** Permission mode for file edits */
  readonly permissionMode: PermissionMode;
  /** Tool restrictions (allowed/denied) */
  readonly toolRestrictions?: ToolRestrictions;
  /** Maximum turns this agent may execute */
  readonly maxTurns: number;
  /** Maximum timeout in ms */
  readonly maxTimeoutMs: number;
  /** Whether the agent can spawn sub-agents */
  readonly canSpawnSubagents: boolean;
  /** Allowed memory scopes */
  readonly memoryScopes: readonly MemoryScope[];
  /** Tier ceiling - child cannot exceed parent's tier */
  readonly maxTier: AgentTier;
}

// =============================================================================
// Max Turns Configuration Per Agent Type
// =============================================================================

/**
 * Default max turns by agent type.
 * OpenClaw uses per-agent maxTurns in frontmatter; these are fallback defaults.
 */
export const DEFAULT_MAX_TURNS_BY_TYPE: Readonly<Record<AgentType, number>> = {
  developer: 50,
  coordinator: 30,
  evaluator: 20,
  'session-manager': 40,
  researcher: 30,
  reviewer: 25,
  tester: 40,
  planner: 25,
  specialist: 35,
  'swarm-coordinator': 30,
};

// =============================================================================
// Heartbeat Configuration
// =============================================================================

/**
 * Heartbeat configuration for agent health monitoring.
 */
export interface HeartbeatConfig {
  /** Interval between heartbeats in ms. Default: 30_000 */
  readonly intervalMs: number;
  /** Number of missed heartbeats before an agent is considered dead. Default: 3 */
  readonly missedThreshold: number;
  /** Whether to auto-restart dead agents. Default: false */
  readonly autoRestart: boolean;
  /** Maximum number of automatic restarts before giving up. Default: 2 */
  readonly maxRestarts: number;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 30_000,
  missedThreshold: 3,
  autoRestart: false,
  maxRestarts: 2,
};

// =============================================================================
// Agent Metadata Schema (YAML Frontmatter)
// =============================================================================

/**
 * Escalation trigger configuration for autonomous agents.
 */
export const EscalationTriggersSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  risk_level: z.string().optional(),
  breaking_change_detected: z.boolean().optional(),
}).strict().optional();

/**
 * Lifecycle hooks that run before/after agent execution.
 */
export const AgentHooksSchema = z.object({
  pre: z.string().optional(),
  post: z.string().optional(),
}).strict().optional();

/**
 * Escalation protocol for evaluator agents.
 */
export const EscalationProtocolSchema = z.object({
  automatic: z.array(z.string()).optional(),
  guardian_review: z.array(z.string()).optional(),
  architect_alert: z.array(z.string()).optional(),
}).optional();

/**
 * Complete agent metadata schema parsed from YAML frontmatter.
 * Unifies all observed fields across 90+ Wundr agent definitions.
 */
export const AgentMetadataSchema = z.object({
  // Identity
  name: z.string().min(1),
  type: AgentTypeSchema.optional(),
  description: z.string().optional(),
  color: z.string().optional(),

  // Hierarchy
  tier: AgentTierSchema.optional(),
  scope: z.string().optional(),
  archetype: z.string().optional(),

  // Capabilities
  capabilities: z.array(z.string()).optional(),
  priority: AgentPrioritySchema.optional(),

  // Runtime Configuration
  tools: z.array(z.string()).optional(),
  model: ModelPreferenceSchema.optional(),
  permissionMode: PermissionModeSchema.optional(),
  maxTurns: z.number().int().positive().optional(),

  // Lifecycle Hooks
  hooks: AgentHooksSchema,

  // RLHF / Reward Weights
  rewardWeights: z.record(z.string(), z.number()).optional(),
  hardConstraints: z.array(z.string()).optional(),

  // Autonomy
  autonomousAuthority: z.array(z.string()).optional(),
  escalationTriggers: EscalationTriggersSchema,

  // Team Composition
  keySubAgents: z.array(z.string()).optional(),
  specializedMCPs: z.array(z.string()).optional(),

  // Evaluator-specific
  metrics: z.array(z.string()).optional(),
  evaluationFrequency: z.record(z.string(), z.string()).optional(),
  thresholds: z.record(z.string(), z.number()).optional(),
  escalationProtocol: EscalationProtocolSchema,

  // Memory & Resources
  memoryBankPath: z.string().optional(),
  worktreeRequirement: z.enum(['read', 'write']).optional(),
  guidingPrinciples: z.array(z.string()).optional(),
  measurableObjectives: z.record(z.string(), z.string()).optional(),

  // Inheritance
  extends: z.string().optional(),

  // === New: Subagent lifecycle fields (from OpenClaw integration) ===

  // Tool Restrictions
  toolRestrictions: ToolRestrictionsSchema,

  // Memory Scope
  memoryScope: MemoryScopeSchema.optional(),

  // Heartbeat override
  heartbeatIntervalMs: z.number().int().positive().optional(),
  heartbeatMissedThreshold: z.number().int().positive().optional(),

  // Instance limits
  maxInstances: z.number().int().positive().optional(),

  // State persistence
  persistState: z.boolean().optional(),

  // Parent agent for permission inheritance
  parentAgentId: z.string().optional(),

  // Restart policy
  maxRestarts: z.number().int().min(0).optional(),

  // Whether this agent can spawn sub-agents
  canSpawnSubagents: z.boolean().optional(),
}).passthrough();

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

// =============================================================================
// Agent Definition (Loaded from .md file)
// =============================================================================

/**
 * A fully loaded agent definition combining parsed metadata with the
 * system prompt (markdown body) and source file information.
 */
export interface AgentDefinition {
  /** Unique agent identifier derived from metadata.name */
  readonly id: string;
  /** Parsed YAML frontmatter metadata */
  readonly metadata: AgentMetadata;
  /** Markdown body used as the agent's system prompt */
  readonly systemPrompt: string;
  /** Relative path from agents root (e.g., "core/coder.md") */
  readonly sourcePath: string;
  /** Category derived from directory structure (e.g., "core", "swarm") */
  readonly category: string;
  /** File modification time for cache invalidation */
  readonly mtime: number;
}

// =============================================================================
// Agent Run Record (Lifecycle Tracking)
// =============================================================================

/**
 * Outcome of a completed agent run.
 */
export interface AgentRunOutcome {
  readonly status: 'ok' | 'error' | 'timeout' | 'unknown';
  readonly error?: string;
}

/**
 * A single message in an agent's mailbox for agent-to-agent communication.
 */
export interface MailboxMessage {
  readonly id: string;
  readonly fromAgentId: string;
  readonly fromRunId: string;
  readonly toAgentId: string;
  readonly content: string;
  readonly timestamp: number;
  read: boolean;
  readonly replyTo?: string;
}

/**
 * Full run record for a spawned agent instance.
 * Extends OpenClaw's SubagentRunRecord with Wundr-specific fields.
 */
export interface AgentRunRecord {
  // Core identity
  runId: string;
  agentId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterDisplayKey: string;

  // Task
  task: string;
  label?: string;

  // Agent metadata snapshot
  agentType?: AgentType;
  agentTier?: AgentTier;
  model?: ModelPreference;

  // Lifecycle timestamps
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: AgentRunOutcome;

  // Cleanup
  cleanup: CleanupMode;
  archiveAtMs?: number;
  cleanupCompletedAt?: number;
  cleanupHandled?: boolean;

  // Resource tracking
  tokensUsed?: number;
  costEstimate?: number;
  turnsUsed?: number;

  // Communication
  mailbox?: MailboxMessage[];

  // === New: Extended lifecycle fields ===

  // Parent-child relationship
  parentRunId?: string;

  // Health monitoring
  lastHeartbeat?: number;
  missedHeartbeats?: number;
  restartCount?: number;
  maxRestarts?: number;

  // Memory scope for this run
  memoryScope?: MemoryScope;

  // Tool restrictions snapshot
  effectiveToolRestrictions?: ToolRestrictions;

  // Permission inheritance chain
  permissionChainIds?: string[];

  // Output fragments collected during execution
  outputFragments?: AgentOutputFragment[];
}

// =============================================================================
// Persistence Schema (Versioned)
// =============================================================================

export const REGISTRY_VERSION = 2 as const;

/**
 * On-disk format for persisted agent run records.
 */
export interface PersistedAgentRegistry {
  readonly version: typeof REGISTRY_VERSION;
  readonly runs: Record<string, AgentRunRecord>;
  readonly agentStates?: Record<string, AgentPersistedState>;
}

/**
 * Legacy V1 persistence format for migration support.
 */
export interface PersistedAgentRegistryV1 {
  readonly version: 1;
  readonly runs: Record<string, AgentRunRecord>;
}

// =============================================================================
// Spawn & Lifecycle Parameters
// =============================================================================

/**
 * Parameters for spawning a new agent instance.
 */
export interface SpawnParams {
  /** Which agent definition to spawn */
  readonly agentId: string;
  /** The task/prompt to send to the agent */
  readonly task: string;
  /** Optional human-readable label */
  readonly label?: string;
  /** Session key of the requesting agent */
  readonly requesterSessionKey: string;
  /** Display key for the requester */
  readonly requesterDisplayKey: string;
  /** Cleanup mode after completion */
  readonly cleanup?: CleanupMode;
  /** Override timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Override model selection */
  readonly model?: ModelPreference;
  /** Parent run ID for permission inheritance */
  readonly parentRunId?: string;
  /** Override memory scope */
  readonly memoryScope?: MemoryScope;
  /** Override tool restrictions */
  readonly toolRestrictions?: ToolRestrictions;
  /** Override max turns */
  readonly maxTurns?: number;
}

// =============================================================================
// Resource Limits
// =============================================================================

/**
 * Resource constraints for agent lifecycle management.
 */
export interface ResourceLimits {
  /** Maximum total concurrent agent instances. Default: 10 */
  readonly maxConcurrentAgents: number;
  /** Maximum concurrent instances of any single agent type. Default: 5 */
  readonly maxConcurrentPerType: number;
  /** Per-tier concurrency limits */
  readonly maxConcurrentPerTier: Readonly<Record<AgentTier, number>>;
  /** Default timeout for agent runs in ms. Default: 300_000 (5 min) */
  readonly defaultTimeoutMs: number;
  /** Maximum allowed timeout in ms. Default: 3_600_000 (1 hour) */
  readonly maxTimeoutMs: number;
  /** Minutes after completion before archiving runs. Default: 60 */
  readonly archiveAfterMinutes: number;
  /** Per-agent maximum concurrent instances (overrides per-type). Default: undefined */
  readonly maxConcurrentPerAgent?: Readonly<Record<string, number>>;
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentAgents: 10,
  maxConcurrentPerType: 5,
  maxConcurrentPerTier: { 0: 2, 1: 3, 2: 5, 3: 10 },
  defaultTimeoutMs: 300_000,
  maxTimeoutMs: 3_600_000,
  archiveAfterMinutes: 60,
};

/**
 * Current resource usage snapshot.
 */
export interface ResourceUsage {
  readonly totalActive: number;
  readonly activeByType: Readonly<Record<string, number>>;
  readonly activeByTier: Readonly<Record<number, number>>;
  readonly activeByAgent: Readonly<Record<string, number>>;
  readonly totalCompleted: number;
  readonly totalFailed: number;
}

// =============================================================================
// Groups & Teams
// =============================================================================

/**
 * Named group of agents that can be dispatched together.
 */
export interface AgentGroup {
  readonly groupId: string;
  readonly agentIds: readonly string[];
  readonly description?: string;
}

/**
 * Requirements for finding a matching agent.
 */
export interface AgentRequirements {
  readonly requiredCapabilities?: readonly string[];
  readonly preferredType?: AgentType;
  readonly preferredTier?: AgentTier;
  readonly preferredModel?: ModelPreference;
  readonly maxConcurrentTasks?: number;
}

// =============================================================================
// Registry Statistics
// =============================================================================

/**
 * Summary statistics for the agent registry.
 */
export interface RegistryStats {
  readonly totalDefinitions: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly byTier: Readonly<Record<number, number>>;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly totalGroups: number;
}

// =============================================================================
// Synthesis Types (aligned with @wundr/agent-delegation)
// =============================================================================

export const SynthesisStrategySchema = z.enum([
  'merge',
  'vote',
  'consensus',
  'best_pick',
  'weighted_average',
  'chain',
]);
export type SynthesisStrategy = z.infer<typeof SynthesisStrategySchema>;

/**
 * Conflict detected during output synthesis.
 */
export interface SynthesisConflict {
  readonly field: string;
  readonly values: readonly unknown[];
  readonly resolution: string;
}

/**
 * Result of synthesizing outputs from multiple agent runs.
 */
export interface SynthesizedResult {
  readonly id: string;
  readonly strategy: SynthesisStrategy;
  readonly inputRunIds: readonly string[];
  readonly synthesizedOutput: unknown;
  readonly confidence?: number;
  readonly conflicts: readonly SynthesisConflict[];
  readonly duration: number;
}

// =============================================================================
// Spawn Mode (how the agent process is launched)
// =============================================================================

export const SpawnModeSchema = z.enum([
  'in-process',
  'worker-thread',
  'child-process',
  'tmux-session',
]);
export type SpawnMode = z.infer<typeof SpawnModeSchema>;

// =============================================================================
// Health Check Types
// =============================================================================

export interface AgentHealthStatus {
  readonly runId: string;
  readonly agentId: string;
  readonly healthy: boolean;
  readonly lastHeartbeat: number;
  readonly uptimeMs: number;
  readonly memoryUsageMb?: number;
  readonly cpuPercent?: number;
  readonly pendingMessages: number;
  readonly errorCount: number;
  /** Number of consecutive missed heartbeats */
  readonly missedHeartbeats: number;
  /** Whether this agent has been marked for restart */
  readonly pendingRestart: boolean;
}

// =============================================================================
// Execution Context (passed to a spawned agent)
// =============================================================================

export interface AgentExecutionContext {
  readonly runId: string;
  readonly agentId: string;
  readonly task: string;
  readonly systemPrompt: string;
  readonly model: ModelPreference;
  readonly permissionMode: PermissionMode;
  readonly tools: readonly string[];
  readonly maxTurns: number;
  readonly timeoutMs: number;
  readonly spawnMode: SpawnMode;
  readonly workingDirectory: string;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly parentRunId?: string;
  /** Effective permissions (intersection of parent grants and agent config) */
  readonly permissions: AgentPermissions;
  /** Memory scope for this agent's state */
  readonly memoryScope: MemoryScope;
}

// =============================================================================
// Agent Events (emitted during lifecycle)
// =============================================================================

export type AgentEventType =
  | 'agent:spawned'
  | 'agent:started'
  | 'agent:heartbeat'
  | 'agent:output'
  | 'agent:message'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:timeout'
  | 'agent:stopped'
  | 'agent:health:dead'
  | 'agent:health:restarted'
  | 'agent:state:saved'
  | 'agent:state:restored';

export interface AgentEvent {
  readonly type: AgentEventType;
  readonly runId: string;
  readonly agentId: string;
  readonly timestamp: number;
  readonly payload?: unknown;
}

// =============================================================================
// Agent Output Fragment (collected during execution)
// =============================================================================

export interface AgentOutputFragment {
  readonly runId: string;
  readonly sequence: number;
  readonly content: string;
  readonly timestamp: number;
  readonly isFinal: boolean;
}

// =============================================================================
// Group Configuration (extended for team management)
// =============================================================================

export interface AgentGroupConfig {
  readonly groupId: string;
  readonly agentIds: readonly string[];
  readonly description?: string;
  readonly strategy: SynthesisStrategy;
  readonly maxParallel: number;
  readonly failurePolicy: 'fail-fast' | 'continue' | 'retry';
  readonly timeoutMs: number;
}

// =============================================================================
// Multi-Directory Loader Configuration
// =============================================================================

export interface AgentDirectorySource {
  /** Absolute path to agents directory */
  readonly path: string;
  /** Priority for conflict resolution (higher wins) */
  readonly priority: number;
  /** Optional label (e.g., 'built-in', 'project', 'user') */
  readonly label: string;
}

// =============================================================================
// Agent State Persistence (per-agent saved state across sessions)
// =============================================================================

/**
 * Serializable snapshot of an agent's accumulated state.
 * Persisted alongside run records for cross-session continuity.
 */
export interface AgentPersistedState {
  /** Agent definition ID */
  readonly agentId: string;
  /** Memory scope under which this state was saved */
  readonly scope: MemoryScope;
  /** Arbitrary key-value state the agent has accumulated */
  readonly data: Readonly<Record<string, unknown>>;
  /** Timestamp of last state save */
  readonly savedAt: number;
  /** Number of runs that have contributed to this state */
  readonly runCount: number;
  /** Version for migration support */
  readonly version: number;
}

export const PERSISTED_STATE_VERSION = 1 as const;

// =============================================================================
// Directory Scanning Configuration (frontmatter-driven)
// =============================================================================

/**
 * Extended metadata fields for `.claude/agents/` frontmatter config.
 * These augment the base AgentMetadata with subagent lifecycle settings.
 */
export interface AgentFrontmatterConfig {
  /** Tool restriction mode for this agent */
  readonly toolRestrictions?: ToolRestrictions;
  /** Default memory scope */
  readonly memoryScope?: MemoryScope;
  /** Heartbeat configuration override */
  readonly heartbeat?: Partial<HeartbeatConfig>;
  /** Maximum number of concurrent instances of this agent */
  readonly maxInstances?: number;
  /** Whether this agent persists state across sessions */
  readonly persistState?: boolean;
  /** Parent agent ID for permission inheritance */
  readonly parentAgentId?: string;
  /** Restart policy: how many times to auto-restart on failure */
  readonly maxRestarts?: number;
}
