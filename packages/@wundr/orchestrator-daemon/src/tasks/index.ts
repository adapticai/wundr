/**
 * Task Management Module
 *
 * Centralized, persistent, dependency-aware task tracking for the Wundr
 * orchestrator daemon. Provides CRUD operations, dependency graphs with
 * cycle detection, agent assignment with load balancing, SQLite persistence,
 * and event-driven notifications.
 *
 * @example
 * ```typescript
 * import {
 *   TaskManager,
 *   TaskScheduler,
 *   InMemoryTaskStore,
 * } from '@wundr/orchestrator-daemon';
 *
 * // Set up store and manager
 * const store = new InMemoryTaskStore();
 * await store.initialize();
 * const manager = new TaskManager(store);
 * await manager.initialize();
 *
 * // Create tasks with dependencies
 * const design = await manager.createTask({ subject: 'Design API schema' });
 * const impl = await manager.createTask({
 *   subject: 'Implement API endpoints',
 *   blockedBy: [design.id],
 * });
 *
 * // Set up scheduler
 * const scheduler = new TaskScheduler(manager, {
 *   assignmentStrategy: 'capability-match',
 * });
 *
 * // Auto-assign to agents
 * const result = await scheduler.autoAssign(agents);
 * ```
 */

// Types and schemas
export {
  // Enums and constants
  TASK_STATUSES,
  TASK_PRIORITIES,
  PRIORITY_WEIGHTS,
  VALID_TRANSITIONS,

  // Zod schemas
  ManagedTaskSchema,
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  TaskQuerySchema,
  TaskStatusSchema,
  TaskPrioritySchema,

  // Error classes
  TaskError,
  TaskNotFoundError,
  CircularDependencyError,
  InvalidTransitionError,
  TaskBlockedError,
  TaskStoreError,
  DuplicateTaskError,
  TaskErrorCode,

  // Utility functions
  toLegacyTask,
} from './task-types';

export type {
  // Core types
  TaskStatus,
  TaskPriority,
  ManagedTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskQuery,
  AgentInfo,

  // Event types
  TaskEventMap,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskCompletedEvent,
  TaskClaimedEvent,
  TaskReleasedEvent,
  TaskBlockedEvent,
  TaskUnblockedEvent,

  // Store interface
  ITaskStore,

  // Scheduler config
  SchedulerConfig,
} from './task-types';

// Store implementations
export { InMemoryTaskStore, SqliteTaskStore } from './task-store';

// Manager
export { TaskManager } from './task-manager';
export type { TaskManagerConfig } from './task-manager';

// Scheduler
export { TaskScheduler } from './task-scheduler';
export type {
  AgentScore,
  AssignmentResult,
  SchedulerEventMap,
} from './task-scheduler';
