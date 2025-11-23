/**
 * @wundr/crew-orchestrator - Type Definitions
 *
 * TypeScript interfaces for CrewAI-style role-based multi-agent orchestration.
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Schema for validating crew member role configuration
 */
export const CrewMemberRoleSchema = z.enum([
  'manager',
  'researcher',
  'developer',
  'reviewer',
  'tester',
  'analyst',
  'architect',
  'writer',
  'custom',
]);

/**
 * Schema for validating crew member status
 */
export const CrewMemberStatusSchema = z.enum([
  'idle',
  'working',
  'delegating',
  'reviewing',
  'blocked',
  'completed',
  'error',
]);

/**
 * Schema for validating task priority
 */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Schema for validating task status
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'delegated',
  'review',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Schema for validating process type
 */
export const ProcessTypeSchema = z.enum([
  'sequential',
  'hierarchical',
  'consensus',
]);

/**
 * Schema for validating review decision
 */
export const ReviewDecisionSchema = z.enum([
  'approved',
  'needs_revision',
  'rejected',
  'escalate',
]);

/**
 * Schema for crew member configuration
 */
export const CrewMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: CrewMemberRoleSchema,
  goal: z.string().min(1),
  backstory: z.string().optional(),
  capabilities: z.array(z.string()),
  tools: z.array(z.string()).optional(),
  allowDelegation: z.boolean().default(true),
  verbose: z.boolean().default(false),
  memory: z.boolean().default(true),
  maxIterations: z.number().int().positive().default(10),
  status: CrewMemberStatusSchema.default('idle'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for task configuration
 */
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  expectedOutput: z.string().min(1),
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('pending'),
  assignedTo: z.string().uuid().optional(),
  delegatedFrom: z.string().uuid().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
  context: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.string()).optional(),
  asyncExecution: z.boolean().default(false),
  humanInput: z.boolean().default(false),
  outputFile: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  maxRetries: z.number().int().nonnegative().default(3),
  retryCount: z.number().int().nonnegative().default(0),
  timeout: z.number().int().positive().optional(),
});

/**
 * Schema for task result
 */
export const TaskResultSchema = z.object({
  taskId: z.string().uuid(),
  success: z.boolean(),
  output: z.unknown(),
  raw: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  executedBy: z.string().uuid(),
  delegationChain: z.array(z.string().uuid()).default([]),
  iterationsUsed: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative(),
  startedAt: z.date(),
  completedAt: z.date(),
  reviewHistory: z
    .array(
      z.object({
        reviewerId: z.string().uuid(),
        decision: ReviewDecisionSchema,
        feedback: z.string().optional(),
        timestamp: z.date(),
      })
    )
    .default([]),
});

/**
 * Schema for crew configuration
 */
export const CrewConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  members: z.array(CrewMemberSchema).min(1),
  tasks: z.array(TaskSchema).default([]),
  process: ProcessTypeSchema.default('sequential'),
  verbose: z.boolean().default(false),
  memory: z.boolean().default(true),
  maxRpm: z.number().int().positive().optional(),
  shareCrewContext: z.boolean().default(true),
  functionCallingLlm: z.string().optional(),
  stepCallback: z.function().args(z.any()).returns(z.void()).optional(),
  taskCallback: z.function().args(z.any()).returns(z.void()).optional(),
  managerLlm: z.string().optional(),
  managerAgent: z.string().uuid().optional(),
  planningLlm: z.string().optional(),
  embedder: z
    .object({
      provider: z.string(),
      config: z.record(z.string(), z.unknown()),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for crew execution result
 */
export const CrewResultSchema = z.object({
  crewId: z.string().uuid(),
  success: z.boolean(),
  tasks: z.array(TaskResultSchema),
  finalOutput: z.unknown().optional(),
  totalDuration: z.number().nonnegative(),
  totalIterations: z.number().int().nonnegative(),
  totalTokensUsed: z.number().int().nonnegative().optional(),
  startedAt: z.date(),
  completedAt: z.date(),
  memberMetrics: z.record(
    z.string().uuid(),
    z.object({
      tasksCompleted: z.number().int().nonnegative(),
      tasksFailed: z.number().int().nonnegative(),
      delegationsReceived: z.number().int().nonnegative(),
      delegationsSent: z.number().int().nonnegative(),
      totalDuration: z.number().nonnegative(),
      averageIterations: z.number().nonnegative(),
    })
  ),
  errors: z
    .array(
      z.object({
        taskId: z.string().uuid().optional(),
        memberId: z.string().uuid().optional(),
        code: z.string(),
        message: z.string(),
        timestamp: z.date(),
      })
    )
    .default([]),
});

// =============================================================================
// TypeScript Types (derived from Zod schemas)
// =============================================================================

/**
 * Crew member role types
 */
export type CrewMemberRole = z.infer<typeof CrewMemberRoleSchema>;

/**
 * Crew member status types
 */
export type CrewMemberStatus = z.infer<typeof CrewMemberStatusSchema>;

/**
 * Task priority levels
 */
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Task status types
 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Process execution types
 */
export type ProcessType = z.infer<typeof ProcessTypeSchema>;

/**
 * Review decision types
 */
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

/**
 * Configuration for a crew member (agent)
 */
export type CrewMember = z.infer<typeof CrewMemberSchema>;

/**
 * Input for creating a new crew member
 */
export type CrewMemberInput = Omit<CrewMember, 'id' | 'status'> & {
  id?: string;
  status?: CrewMemberStatus;
};

/**
 * Configuration for a task
 */
export type Task = z.infer<typeof TaskSchema>;

/**
 * Input for creating a new task
 */
export type TaskInput = Omit<
  Task,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'
> & {
  id?: string;
  status?: TaskStatus;
  createdAt?: Date;
  updatedAt?: Date;
  retryCount?: number;
};

/**
 * Result of task execution
 */
export type TaskResult = z.infer<typeof TaskResultSchema>;

/**
 * Configuration for a crew
 */
export type CrewConfig = z.infer<typeof CrewConfigSchema>;

/**
 * Input for creating a new crew
 */
export type CrewConfigInput = Omit<
  CrewConfig,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Result of crew execution
 */
export type CrewResult = z.infer<typeof CrewResultSchema>;

// =============================================================================
// Additional Interfaces
// =============================================================================

/**
 * Delegation request between crew members
 */
export interface DelegationRequest {
  readonly id: string;
  readonly fromMemberId: string;
  readonly toMemberId: string;
  readonly taskId: string;
  readonly reason: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * Delegation response
 */
export interface DelegationResponse {
  readonly requestId: string;
  readonly accepted: boolean;
  readonly reason?: string;
  readonly estimatedDuration?: number;
  readonly timestamp: Date;
}

/**
 * Review request for manager review loop
 */
export interface ReviewRequest {
  readonly taskId: string;
  readonly taskResult: TaskResult;
  readonly reviewerId: string;
  readonly iteration: number;
  readonly previousFeedback?: string[];
  readonly timestamp: Date;
}

/**
 * Review feedback from manager
 */
export interface ReviewFeedback {
  readonly taskId: string;
  readonly reviewerId: string;
  readonly decision: ReviewDecision;
  readonly feedback: string;
  readonly suggestedChanges?: string[];
  readonly qualityScore?: number;
  readonly timestamp: Date;
}

/**
 * Execution context passed between tasks
 */
export interface ExecutionContext {
  readonly crewId: string;
  readonly currentTaskId?: string;
  readonly previousResults: Map<string, TaskResult>;
  readonly sharedMemory: Map<string, unknown>;
  readonly delegationHistory: DelegationRequest[];
  readonly reviewHistory: ReviewFeedback[];
  readonly startTime: Date;
  readonly metrics: ExecutionMetrics;
}

/**
 * Execution metrics for monitoring
 */
export interface ExecutionMetrics {
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  delegationCount: number;
  reviewCount: number;
  totalIterations: number;
  totalTokens: number;
  averageTaskDuration: number;
}

/**
 * Event types emitted during crew execution
 */
export type CrewEventType =
  | 'crew:started'
  | 'crew:completed'
  | 'crew:error'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:delegated'
  | 'task:retry_exhausted'
  | 'delegation:requested'
  | 'delegation:accepted'
  | 'delegation:rejected'
  | 'review:requested'
  | 'review:completed'
  | 'member:status_changed';

/**
 * Event payload structure
 */
export interface CrewEvent {
  readonly type: CrewEventType;
  readonly crewId: string;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/**
 * Task executor function type
 */
export type TaskExecutor = (
  task: Task,
  member: CrewMember,
  context: ExecutionContext
) => Promise<TaskResult>;

/**
 * Delegation strategy function type
 */
export type DelegationStrategy = (
  task: Task,
  fromMember: CrewMember,
  availableMembers: CrewMember[],
  context: ExecutionContext
) => Promise<CrewMember | null>;

/**
 * Review strategy function type
 */
export type ReviewStrategy = (
  result: TaskResult,
  task: Task,
  reviewer: CrewMember,
  context: ExecutionContext
) => Promise<ReviewFeedback>;

/**
 * Error codes for crew orchestration
 */
export enum CrewErrorCode {
  INVALID_CONFIG = 'CREW_INVALID_CONFIG',
  MEMBER_NOT_FOUND = 'CREW_MEMBER_NOT_FOUND',
  TASK_NOT_FOUND = 'CREW_TASK_NOT_FOUND',
  TASK_EXECUTION_FAILED = 'CREW_TASK_EXECUTION_FAILED',
  DELEGATION_FAILED = 'CREW_DELEGATION_FAILED',
  REVIEW_FAILED = 'CREW_REVIEW_FAILED',
  TIMEOUT = 'CREW_TIMEOUT',
  MAX_ITERATIONS_EXCEEDED = 'CREW_MAX_ITERATIONS_EXCEEDED',
  DEPENDENCY_NOT_MET = 'CREW_DEPENDENCY_NOT_MET',
  CIRCULAR_DEPENDENCY = 'CREW_CIRCULAR_DEPENDENCY',
  NO_AVAILABLE_MEMBER = 'CREW_NO_AVAILABLE_MEMBER',
  CONSENSUS_FAILED = 'CREW_CONSENSUS_FAILED',
}

/**
 * Custom error class for crew orchestration
 */
export class CrewError extends Error {
  constructor(
    public readonly code: CrewErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CrewError';
  }
}
