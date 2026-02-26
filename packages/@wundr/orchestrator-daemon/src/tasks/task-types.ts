/**
 * Task Management - Type Definitions
 *
 * Complete type system for Wundr's task management layer. Provides Zod schemas
 * for runtime validation and TypeScript interfaces for compile-time safety.
 *
 * Modeled after Claude Code's TaskCreate/TodoWrite pattern with extensions for
 * dependency tracking (blocks/blockedBy), agent assignment, and spinner display
 * (activeForm).
 */

import { z } from 'zod';

// =============================================================================
// Status & Priority Enums
// =============================================================================

/**
 * Task lifecycle status.
 *
 * Transitions:
 *   pending --> in_progress --> completed
 *       |           |              |
 *       |           v              |
 *       |        pending (retry)   |
 *       |                          |
 *       +--------> deleted <-------+
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'deleted',
] as const;

/**
 * Valid status transitions. Key is the current status, value is the set of
 * statuses it may transition to.
 */
export const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['in_progress', 'deleted'],
  in_progress: ['pending', 'completed', 'deleted'],
  completed: ['deleted'],
  deleted: [],
} as const;

/**
 * Task priority levels, ordered lowest to highest.
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

/**
 * Numeric weight for each priority level, used by the scheduler for scoring.
 */
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
} as const;

// =============================================================================
// Zod Schemas
// =============================================================================

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'deleted',
]);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Full task record schema. Used for validation on read/hydration.
 */
export const ManagedTaskSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().min(1).max(500),
  description: z.string().max(10000).default(''),
  status: TaskStatusSchema.default('pending'),
  owner: z.string().nullable().default(null),
  activeForm: z.string().nullable().default(null),
  priority: TaskPrioritySchema.default('medium'),
  blocks: z.array(z.string().uuid()).default([]),
  blockedBy: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Input schema for creating a new task. Only `subject` is required.
 */
export const CreateTaskInputSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  owner: z.string().optional(),
  activeForm: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  blocks: z.array(z.string().uuid()).optional(),
  blockedBy: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Input schema for updating an existing task. All fields optional.
 * Dependency modifications use additive/subtractive arrays to avoid
 * overwrite races.
 */
export const UpdateTaskInputSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: TaskStatusSchema.optional(),
  owner: z.string().nullable().optional(),
  activeForm: z.string().nullable().optional(),
  priority: TaskPrioritySchema.optional(),
  addBlocks: z.array(z.string().uuid()).optional(),
  removeBlocks: z.array(z.string().uuid()).optional(),
  addBlockedBy: z.array(z.string().uuid()).optional(),
  removeBlockedBy: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Query schema for filtering tasks.
 */
export const TaskQuerySchema = z.object({
  status: z.union([TaskStatusSchema, z.array(TaskStatusSchema)]).optional(),
  owner: z.string().optional(),
  priority: z
    .union([TaskPrioritySchema, z.array(TaskPrioritySchema)])
    .optional(),
  isBlocked: z.boolean().optional(),
  hasOwner: z.boolean().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
});

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * A fully-hydrated task record as stored and returned by the system.
 */
export type ManagedTask = z.infer<typeof ManagedTaskSchema>;

/**
 * Input for creating a new task.
 */
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/**
 * Input for updating an existing task.
 */
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

/**
 * Query parameters for filtering tasks.
 */
export type TaskQuery = z.infer<typeof TaskQuerySchema>;

// =============================================================================
// Agent Info (for scheduler)
// =============================================================================

/**
 * Information about an agent available for task assignment.
 */
export interface AgentInfo {
  /** Unique agent identifier */
  id: string;
  /** Human-readable agent name */
  name: string;
  /** List of capability tags the agent supports */
  capabilities: string[];
  /** Number of tasks currently assigned to this agent */
  currentLoad: number;
  /** Maximum number of concurrent tasks this agent can handle */
  maxLoad: number;
  /** Whether the agent is currently available for work */
  available: boolean;
}

// =============================================================================
// Event Payloads
// =============================================================================

/**
 * Payload for the `task:created` event.
 */
export interface TaskCreatedEvent {
  task: ManagedTask;
}

/**
 * Payload for the `task:updated` event.
 */
export interface TaskUpdatedEvent {
  task: ManagedTask;
  changes: string[];
}

/**
 * Payload for the `task:deleted` event.
 */
export interface TaskDeletedEvent {
  taskId: string;
}

/**
 * Payload for the `task:completed` event.
 */
export interface TaskCompletedEvent {
  task: ManagedTask;
  unblocked: string[];
}

/**
 * Payload for the `task:claimed` event.
 */
export interface TaskClaimedEvent {
  task: ManagedTask;
  owner: string;
}

/**
 * Payload for the `task:released` event.
 */
export interface TaskReleasedEvent {
  task: ManagedTask;
}

/**
 * Payload for the `task:blocked` event.
 */
export interface TaskBlockedEvent {
  taskId: string;
  blockedBy: string[];
}

/**
 * Payload for the `task:unblocked` event.
 */
export interface TaskUnblockedEvent {
  taskId: string;
}

/**
 * Union of all task event types for the EventEmitter.
 */
export interface TaskEventMap {
  'task:created': (event: TaskCreatedEvent) => void;
  'task:updated': (event: TaskUpdatedEvent) => void;
  'task:deleted': (event: TaskDeletedEvent) => void;
  'task:completed': (event: TaskCompletedEvent) => void;
  'task:claimed': (event: TaskClaimedEvent) => void;
  'task:released': (event: TaskReleasedEvent) => void;
  'task:blocked': (event: TaskBlockedEvent) => void;
  'task:unblocked': (event: TaskUnblockedEvent) => void;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for task operations.
 */
export enum TaskErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  TASK_BLOCKED = 'TASK_BLOCKED',
  STORE_ERROR = 'STORE_ERROR',
  DUPLICATE_TASK = 'DUPLICATE_TASK',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Base error class for all task-related errors.
 */
export class TaskError extends Error {
  readonly code: TaskErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TaskErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaskError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when a task ID cannot be found.
 */
export class TaskNotFoundError extends TaskError {
  constructor(taskId: string) {
    super(TaskErrorCode.TASK_NOT_FOUND, `Task not found: ${taskId}`, {
      taskId,
    });
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Thrown when adding a dependency would create a cycle.
 */
export class CircularDependencyError extends TaskError {
  constructor(cycle: string[]) {
    super(
      TaskErrorCode.CIRCULAR_DEPENDENCY,
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      { cycle }
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Thrown when a status transition is not allowed.
 */
export class InvalidTransitionError extends TaskError {
  constructor(taskId: string, from: TaskStatus, to: TaskStatus) {
    super(
      TaskErrorCode.INVALID_TRANSITION,
      `Invalid status transition for task ${taskId}: ${from} -> ${to}`,
      { taskId, from, to }
    );
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Thrown when attempting to start a task that has unresolved blockers.
 */
export class TaskBlockedError extends TaskError {
  constructor(taskId: string, blockedBy: string[]) {
    super(
      TaskErrorCode.TASK_BLOCKED,
      `Task ${taskId} is blocked by: ${blockedBy.join(', ')}`,
      { taskId, blockedBy }
    );
    this.name = 'TaskBlockedError';
  }
}

/**
 * Thrown when the backing store encounters an error.
 */
export class TaskStoreError extends TaskError {
  constructor(message: string, cause?: unknown) {
    super(TaskErrorCode.STORE_ERROR, message, { cause: String(cause) });
    this.name = 'TaskStoreError';
  }
}

/**
 * Thrown when a task ID already exists.
 */
export class DuplicateTaskError extends TaskError {
  constructor(taskId: string) {
    super(TaskErrorCode.DUPLICATE_TASK, `Task already exists: ${taskId}`, {
      taskId,
    });
    this.name = 'DuplicateTaskError';
  }
}

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Storage backend interface for task persistence.
 *
 * Implementations must be safe for sequential access. Concurrent access
 * safety is the caller's responsibility (TaskManager serializes writes).
 */
export interface ITaskStore {
  /** Initialize the store (create tables, etc.) */
  initialize(): Promise<void>;

  /** Persist a new task */
  create(task: ManagedTask): Promise<void>;

  /** Retrieve a task by ID, or null if not found */
  get(id: string): Promise<ManagedTask | null>;

  /** Update a task and return the updated record, or null if not found */
  update(
    id: string,
    updates: Partial<ManagedTask>
  ): Promise<ManagedTask | null>;

  /** Hard-delete a task from the store. Returns true if deleted. */
  delete(id: string): Promise<boolean>;

  /** Query tasks with filters */
  query(query: TaskQuery): Promise<ManagedTask[]>;

  /** Get all tasks */
  getAll(): Promise<ManagedTask[]>;

  /** Count tasks matching an optional query */
  count(query?: TaskQuery): Promise<number>;

  /** Close connections and release resources */
  close(): Promise<void>;
}

// =============================================================================
// Scheduler Config
// =============================================================================

/**
 * Configuration for the task scheduler.
 */
export interface SchedulerConfig {
  /** Maximum tasks a single agent can be assigned at once. Default: 5 */
  maxTasksPerAgent?: number;

  /** Strategy for selecting agents. Default: 'capability-match' */
  assignmentStrategy?: 'round-robin' | 'least-loaded' | 'capability-match';

  /** Interval in ms for auto-assignment polling. 0 to disable. Default: 0 */
  autoAssignInterval?: number;

  /** Interval in ms for checking/unblocking tasks. 0 to disable. Default: 0 */
  unblockCheckInterval?: number;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Converts a ManagedTask to the legacy Task interface used elsewhere
 * in the orchestrator-daemon.
 */
export function toLegacyTask(managed: ManagedTask): {
  id: string;
  type: 'general';
  description: string;
  priority: TaskPriority;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
} {
  const statusMap: Record<
    TaskStatus,
    'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  > = {
    pending: 'pending',
    in_progress: 'in_progress',
    completed: 'completed',
    deleted: 'cancelled',
  };

  return {
    id: managed.id,
    type: 'general',
    description: managed.description || managed.subject,
    priority: managed.priority,
    assignedTo: managed.owner ?? undefined,
    status: statusMap[managed.status],
    createdAt: managed.createdAt,
    updatedAt: managed.updatedAt,
    metadata: managed.metadata,
  };
}
