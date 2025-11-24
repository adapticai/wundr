/**
 * @wundr/agent-delegation - Type Definitions
 *
 * TypeScript interfaces for hub-and-spoke delegation pattern in multi-agent systems.
 * Provides comprehensive type safety for agent coordination, task delegation,
 * result synthesis, and audit logging.
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for validating agent capability levels
 */
export const AgentCapabilityLevelSchema = z.enum([
  'expert',
  'proficient',
  'intermediate',
  'basic',
]);

/**
 * Schema for validating delegation status
 */
export const DelegationStatusSchema = z.enum([
  'pending',
  'assigned',
  'executing',
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);

/**
 * Schema for validating synthesis strategy
 */
export const SynthesisStrategySchema = z.enum([
  'merge',
  'vote',
  'consensus',
  'best_pick',
  'weighted_average',
  'chain',
]);

/**
 * Schema for validating model tier
 */
export const ModelTierSchema = z.enum([
  'premium',
  'standard',
  'economy',
  'local',
]);

/**
 * Schema for validating audit event types
 */
export const AuditEventTypeSchema = z.enum([
  'delegation_created',
  'delegation_assigned',
  'delegation_started',
  'delegation_completed',
  'delegation_failed',
  'delegation_cancelled',
  'result_received',
  'synthesis_started',
  'synthesis_completed',
  'model_selected',
  'agent_spawned',
  'agent_terminated',
  'error_occurred',
]);

/**
 * Schema for agent definition
 */
export const AgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().min(1),
  capabilities: z.array(z.string()),
  capabilityLevels: z.record(z.string(), AgentCapabilityLevelSchema).optional(),
  modelPreference: ModelTierSchema.optional(),
  maxConcurrentTasks: z.number().int().positive().default(3),
  timeout: z.number().int().positive().optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().nonnegative().default(3),
      backoffMs: z.number().int().positive().default(1000),
      backoffMultiplier: z.number().positive().default(2),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for delegation task
 */
export const DelegationTaskSchema = z.object({
  id: z.string(),
  parentTaskId: z.string().optional(),
  description: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  requiredCapabilities: z.array(z.string()).default([]),
  preferredAgentId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timeout: z.number().int().positive().optional(),
  createdAt: z.date(),
});

/**
 * Schema for delegation configuration
 */
export const DelegationConfigSchema = z.object({
  hubAgentId: z.string(),
  maxParallelDelegations: z.number().int().positive().default(5),
  defaultTimeout: z.number().int().positive().default(60000),
  synthesisStrategy: SynthesisStrategySchema.default('merge'),
  enableAuditLogging: z.boolean().default(true),
  retryFailedDelegations: z.boolean().default(true),
  maxRetries: z.number().int().nonnegative().default(3),
  aggregatePartialResults: z.boolean().default(true),
  modelSelectionStrategy: z
    .enum(['capability_match', 'cost_optimize', 'speed_optimize', 'balanced'])
    .default('balanced'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for delegation result
 */
export const DelegationResultSchema = z.object({
  taskId: z.string(),
  agentId: z.string(),
  status: DelegationStatusSchema,
  output: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  tokensUsed: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative(),
  startedAt: z.date(),
  completedAt: z.date(),
  retryCount: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for synthesis result
 */
export const SynthesisResultSchema = z.object({
  id: z.string(),
  strategy: SynthesisStrategySchema,
  inputResults: z.array(z.string()),
  synthesizedOutput: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
  conflicts: z
    .array(
      z.object({
        field: z.string(),
        values: z.array(z.unknown()),
        resolution: z.string(),
      }),
    )
    .default([]),
  duration: z.number().nonnegative(),
  createdAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for audit log entry
 */
export const AuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  eventType: AuditEventTypeSchema,
  hubAgentId: z.string(),
  spokeAgentId: z.string().optional(),
  taskId: z.string().optional(),
  details: z.record(z.string(), z.unknown()),
  correlationId: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * Schema for model selection criteria
 */
export const ModelSelectionCriteriaSchema = z.object({
  taskComplexity: z
    .enum(['simple', 'moderate', 'complex', 'expert'])
    .default('moderate'),
  requiredCapabilities: z.array(z.string()).default([]),
  maxCost: z.number().positive().optional(),
  maxLatency: z.number().int().positive().optional(),
  preferredTier: ModelTierSchema.optional(),
  requiresTools: z.boolean().default(false),
  requiresVision: z.boolean().default(false),
  contextLength: z.number().int().positive().optional(),
});

/**
 * Schema for model configuration
 */
export const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  tier: ModelTierSchema,
  capabilities: z.array(z.string()),
  maxContextLength: z.number().int().positive(),
  costPerToken: z.number().nonnegative(),
  averageLatencyMs: z.number().nonnegative(),
  supportsTools: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// TypeScript Types (derived from Zod schemas)
// =============================================================================

/**
 * Agent capability level types
 */
export type AgentCapabilityLevel = z.infer<typeof AgentCapabilityLevelSchema>;

/**
 * Delegation status types
 */
export type DelegationStatus = z.infer<typeof DelegationStatusSchema>;

/**
 * Synthesis strategy types
 */
export type SynthesisStrategy = z.infer<typeof SynthesisStrategySchema>;

/**
 * Model tier types
 */
export type ModelTier = z.infer<typeof ModelTierSchema>;

/**
 * Audit event types
 */
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

/**
 * Agent definition for subagent configuration
 */
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

/**
 * Input for creating an agent definition
 */
export type AgentDefinitionInput = Omit<AgentDefinition, 'id'> & {
  id?: string;
};

/**
 * Delegation task configuration
 */
export type DelegationTask = z.infer<typeof DelegationTaskSchema>;

/**
 * Input for creating a delegation task
 */
export type DelegationTaskInput = Omit<DelegationTask, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date;
};

/**
 * Configuration for the hub coordinator
 */
export type DelegationConfig = z.infer<typeof DelegationConfigSchema>;

/**
 * Input for delegation configuration
 */
export type DelegationConfigInput = Partial<DelegationConfig> & {
  hubAgentId: string;
};

/**
 * Result from a delegated task execution
 */
export type DelegationResult = z.infer<typeof DelegationResultSchema>;

/**
 * Result from multi-agent result synthesis
 */
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

/**
 * Audit log entry for tracking delegation activities
 */
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

/**
 * Criteria for model selection
 */
export type ModelSelectionCriteria = z.infer<
  typeof ModelSelectionCriteriaSchema
>;

/**
 * Input for model selection criteria
 */
export type ModelSelectionCriteriaInput = Partial<ModelSelectionCriteria>;

/**
 * Model configuration
 */
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// =============================================================================
// Additional Interfaces
// =============================================================================

/**
 * Parallel delegation request for multiple agents
 */
export interface ParallelDelegationRequest {
  readonly tasks: DelegationTask[];
  readonly agents: AgentDefinition[];
  readonly config?: Partial<DelegationConfig>;
  readonly correlationId?: string;
}

/**
 * Parallel delegation response
 */
export interface ParallelDelegationResponse {
  readonly correlationId: string;
  readonly results: DelegationResult[];
  readonly synthesis?: SynthesisResult;
  readonly totalDuration: number;
  readonly successCount: number;
  readonly failureCount: number;
}

/**
 * Hub coordinator metrics
 */
export interface CoordinatorMetrics {
  totalDelegations: number;
  successfulDelegations: number;
  failedDelegations: number;
  averageDuration: number;
  totalTokensUsed: number;
  activeAgents: number;
  pendingTasks: number;
  synthesisCount: number;
  lastActivityAt: Date | null;
}

/**
 * Agent task executor function type
 */
export type TaskExecutor = (
  task: DelegationTask,
  agent: AgentDefinition,
  context: Record<string, unknown>
) => Promise<DelegationResult>;

/**
 * Model selector function type
 */
export type ModelSelector = (
  task: DelegationTask,
  criteria: ModelSelectionCriteria,
  availableModels: ModelConfig[]
) => Promise<ModelConfig>;

/**
 * Result synthesizer function type
 */
export type ResultSynthesizer = (
  results: DelegationResult[],
  strategy: SynthesisStrategy,
  context: Record<string, unknown>
) => Promise<SynthesisResult>;

/**
 * Audit logger function type
 */
export type AuditLogger = (entry: AuditLogEntry) => Promise<void>;

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Error codes for agent delegation
 */
export enum DelegationErrorCode {
  INVALID_CONFIG = 'DELEGATION_INVALID_CONFIG',
  AGENT_NOT_FOUND = 'DELEGATION_AGENT_NOT_FOUND',
  TASK_NOT_FOUND = 'DELEGATION_TASK_NOT_FOUND',
  EXECUTION_FAILED = 'DELEGATION_EXECUTION_FAILED',
  TIMEOUT = 'DELEGATION_TIMEOUT',
  MAX_RETRIES_EXCEEDED = 'DELEGATION_MAX_RETRIES_EXCEEDED',
  NO_AVAILABLE_AGENT = 'DELEGATION_NO_AVAILABLE_AGENT',
  SYNTHESIS_FAILED = 'DELEGATION_SYNTHESIS_FAILED',
  MODEL_SELECTION_FAILED = 'DELEGATION_MODEL_SELECTION_FAILED',
  AUDIT_LOG_FAILED = 'DELEGATION_AUDIT_LOG_FAILED',
  CAPABILITY_MISMATCH = 'DELEGATION_CAPABILITY_MISMATCH',
  CONCURRENT_LIMIT_EXCEEDED = 'DELEGATION_CONCURRENT_LIMIT_EXCEEDED',
}

/**
 * Custom error class for delegation operations
 */
export class DelegationError extends Error {
  constructor(
    public readonly code: DelegationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DelegationError';
  }
}
