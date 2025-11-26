/**
 * Task Backlog API Validation Schemas
 *
 * Zod validation schemas for VP backlog-related API operations.
 * These schemas ensure type safety for backlog management endpoints.
 *
 * @module lib/validations/task-backlog
 */

import { z } from 'zod';

import { taskPriorityEnum, taskStatusEnum } from './task';

/**
 * Schema for task assignment
 */
export const assignTaskSchema = z.object({
  /** ID of user being assigned (can be VP user) */
  assigneeId: z.string().cuid('Invalid assignee ID format'),

  /** Type of assignee */
  assigneeType: z.enum(['VP', 'USER'], {
    required_error: 'Assignee type is required',
  }),

  /** Optional notes about the assignment */
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),

  /** Optional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

/**
 * Schema for task completion
 */
export const completeTaskSchema = z.object({
  /** Result data from task execution */
  result: z.record(z.unknown()).optional(),

  /** Completion notes */
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional(),

  /** Artifacts produced (URLs, file IDs, etc.) */
  artifacts: z.array(z.string().max(500)).max(50, 'Maximum 50 artifacts').default([]),

  /** Metadata about completion */
  metadata: z.record(z.unknown()).optional(),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

/**
 * Schema for next task polling
 */
export const nextTaskFiltersSchema = z.object({
  /** Filter by status (default: TODO) */
  status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).default('TODO'),

  /** Minimum priority to consider */
  minPriority: taskPriorityEnum.optional(),

  /** VP capabilities to match against task requirements */
  capabilities: z.array(z.string()).optional(),

  /** Consider tasks with deadline within X hours */
  deadlineWithinHours: z.coerce.number().int().positive().max(720).optional(),
});

export type NextTaskFiltersInput = z.infer<typeof nextTaskFiltersSchema>;

/**
 * Schema for VP backlog filters
 */
export const vpBacklogFiltersSchema = z.object({
  /** Filter by status */
  status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),

  /** Filter by priority */
  priority: z.union([taskPriorityEnum, z.array(taskPriorityEnum)]).optional(),

  /** Include completed tasks */
  includeCompleted: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    })
    .default(false),

  /** Pagination: page number (1-indexed) */
  page: z.coerce.number().int().positive().default(1),

  /** Pagination: items per page */
  limit: z.coerce.number().int().positive().max(100).default(50),

  /** Sort field */
  sortBy: z.enum(['priority', 'dueDate', 'createdAt', 'status']).default('priority'),

  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  /** Include statistics */
  includeStats: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    })
    .default(false),
});

export type VPBacklogFiltersInput = z.infer<typeof vpBacklogFiltersSchema>;

/**
 * Schema for adding task to VP backlog
 */
export const addBacklogTaskSchema = z.object({
  /** Task title/heading */
  title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),

  /** Detailed task description */
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .nullable(),

  /** Task priority level */
  priority: taskPriorityEnum.default('MEDIUM'),

  /** Task status */
  status: taskStatusEnum.default('TODO'),

  /** Optional channel ID for task context */
  channelId: z.string().cuid('Invalid channel ID format').optional().nullable(),

  /** Estimated hours to complete */
  estimatedHours: z
    .number()
    .int()
    .positive()
    .max(1000, 'Estimated hours must be reasonable')
    .optional()
    .nullable(),

  /** Due date for the task */
  dueDate: z.string().datetime().optional().nullable(),

  /** Tags for categorization */
  tags: z.array(z.string().max(50)).default([]),

  /** Task dependencies (array of Task IDs) */
  dependsOn: z.array(z.string().cuid('Invalid task ID')).default([]),

  /** Assigned to user ID (can be human or VP) */
  assignedToId: z.string().cuid('Invalid assignee ID format').optional().nullable(),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type AddBacklogTaskInput = z.infer<typeof addBacklogTaskSchema>;

/**
 * Error response helpers
 */
export const BACKLOG_ERROR_CODES = {
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  INVALID_STATE: 'INVALID_STATE',
  NO_AVAILABLE_TASKS: 'NO_AVAILABLE_TASKS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type BacklogErrorCode = (typeof BACKLOG_ERROR_CODES)[keyof typeof BACKLOG_ERROR_CODES];
