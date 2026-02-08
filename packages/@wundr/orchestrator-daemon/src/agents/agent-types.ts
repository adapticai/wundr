/**
 * @wundr/orchestrator-daemon - Agent Type Definitions
 *
 * Canonical type system for the subagent registry. Defines the metadata schema
 * for agent definitions loaded from .claude/agents/ markdown files, run records
 * for lifecycle tracking, and supporting types for groups, mailbox, and resources.
 *
 * Design reference: OpenClaw's SubagentRunRecord + Wundr's 54-agent taxonomy.
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

  // Communication
  mailbox?: MailboxMessage[];
}

// =============================================================================
// Persistence Schema (Versioned)
// =============================================================================

export const REGISTRY_VERSION = 1 as const;

/**
 * On-disk format for persisted agent run records.
 */
export interface PersistedAgentRegistry {
  readonly version: typeof REGISTRY_VERSION;
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
