/**
 * Task Validation Schemas
 * @module lib/validations/task
 */

import { z } from 'zod';

export const TASK_ERROR_CODES = {
  INVALID_TASK: 'TASK_INVALID',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  UNAUTHORIZED: 'TASK_UNAUTHORIZED',
  INVALID_STATUS: 'TASK_INVALID_STATUS',
  DEPENDENCY_FAILED: 'TASK_DEPENDENCY_FAILED',
  DEPENDENCY_VIOLATION: 'TASK_DEPENDENCY_VIOLATION',
  VALIDATION_FAILED: 'TASK_VALIDATION_FAILED',
  VALIDATION_ERROR: 'TASK_VALIDATION_ERROR',
  ORCHESTRATOR_NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  FORBIDDEN: 'TASK_FORBIDDEN',
  INTERNAL_ERROR: 'TASK_INTERNAL_ERROR',
  ASSIGNEE_NOT_FOUND: 'TASK_ASSIGNEE_NOT_FOUND',
  NOT_FOUND: 'TASK_NOT_FOUND_GENERIC',
  INVALID_STATE_TRANSITION: 'TASK_INVALID_STATE_TRANSITION',
} as const;

export type TaskErrorCode =
  (typeof TASK_ERROR_CODES)[keyof typeof TASK_ERROR_CODES];

/**
 * Create a standardized task error response
 */
export function createErrorResponse(
  message: string,
  code: TaskErrorCode | string,
  extraData?: Record<string, unknown>,
): { error: TaskErrorCode | string; message: string } & Record<
  string,
  unknown
> {
  return { error: code, message, ...extraData };
}

export const taskStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
]);

// Alias for backward compatibility
export const taskStatusEnum = taskStatusSchema;

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Alias for backward compatibility
export const taskPriorityEnum = taskPrioritySchema;

// Export types from schemas
export type TaskStatusType = z.infer<typeof taskStatusSchema>;
export type TaskPriorityType = z.infer<typeof taskPrioritySchema>;

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  assignedToId: z.string().optional(),
  creatorId: z.string(),
  workspaceId: z.string(),
  orchestratorId: z.string(),
  channelId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().int().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  actualDuration: z.number().positive().optional(),
  dependsOn: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export const createTaskSchema = taskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  actualDuration: true,
});

export const updateTaskSchema = taskSchema.partial().required({ id: true });

export const taskFilterSchema = z.object({
  status: taskStatusSchema.array().optional(),
  priority: taskPrioritySchema.array().optional(),
  assignedToId: z.string().optional(),
  workspaceId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
});

export const createBacklogItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: taskPrioritySchema,
  status: taskStatusSchema.default('TODO'),
  workspaceId: z.string().optional(),
  estimatedDuration: z.number().positive().optional(),
  storyPoints: z.number().int().positive().optional(),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const taskAssignmentSchema = z.object({
  taskIds: z.array(z.string()).min(1, 'At least one task ID is required'),
  assigneeId: z.string(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const taskFiltersSchema = z.object({
  status: z.union([taskStatusSchema, taskStatusSchema.array()]).optional(),
  priority: z
    .union([taskPrioritySchema, taskPrioritySchema.array()])
    .optional(),
  assignedToId: z.string().optional(),
  creatorId: z.string().optional(),
  workspaceId: z.string().optional(),
  orchestratorId: z.string().optional(),
  channelId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  searchTerm: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  page: z.coerce.number().int().positive().default(1),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'priority', 'dueDate', 'title', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeCompleted: z.boolean().default(false),
});

export const taskIdParamSchema = z.object({
  id: z.string(),
});

export const taskPollingSchema = z.object({
  taskId: z.string(),
  interval: z.coerce.number().int().positive().default(5000),
  timeout: z.coerce.number().int().positive().default(300000),
  workspaceId: z.string().optional(),
  orchestratorId: z.string().optional(),
  status: z.union([taskStatusSchema, taskStatusSchema.array()]).optional(),
  since: z.string().datetime().optional(),
  minPriority: taskPrioritySchema.optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const vpBacklogFiltersSchema = z.object({
  workspaceId: z.string(),
  status: z.union([taskStatusSchema, taskStatusSchema.array()]).optional(),
  priority: z
    .union([taskPrioritySchema, taskPrioritySchema.array()])
    .optional(),
  tags: z.array(z.string()).optional(),
  searchTerm: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  includeCompleted: z.boolean().default(false),
  sortBy: z
    .enum(['priority', 'dueDate', 'createdAt', 'status'])
    .default('priority'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().positive().default(1),
});

// Export TypeScript types from schemas
export type Task = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
export type CreateBacklogItemInput = z.infer<typeof createBacklogItemSchema>;
export type TaskAssignmentInput = z.infer<typeof taskAssignmentSchema>;
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
export type TaskPollingInput = z.infer<typeof taskPollingSchema>;
export type VPBacklogFiltersInput = z.infer<typeof vpBacklogFiltersSchema>;
