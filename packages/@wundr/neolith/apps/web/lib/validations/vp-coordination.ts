/**
 * VP Coordination Validation Schemas
 *
 * Zod validation schemas for cross-VP coordination operations.
 *
 * @module lib/validations/vp-coordination
 */

import { z } from 'zod';

/**
 * Task priority enum for delegation
 */
export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TaskPriorityType = z.infer<typeof taskPriorityEnum>;

/**
 * Conflict type enum
 */
export const conflictTypeEnum = z.enum([
  'resource_conflict',
  'priority_conflict',
  'dependency_conflict',
  'ownership_conflict',
  'deadline_conflict',
  'other',
]);
export type ConflictType = z.infer<typeof conflictTypeEnum>;

/**
 * Schema for task delegation request
 */
export const delegateTaskSchema = z.object({
  /** Target VP ID to delegate to */
  toVpId: z.string().cuid('Invalid target VP ID'),

  /** Task ID to delegate */
  taskId: z.string().cuid('Invalid task ID'),

  /** Optional note about the delegation */
  note: z.string().max(1000, 'Note must be less than 1000 characters').optional(),

  /** Optional priority override */
  priority: taskPriorityEnum.optional(),

  /** Optional due date */
  dueDate: z.string().datetime('Invalid datetime format').optional(),
});

export type DelegateTaskInput = z.infer<typeof delegateTaskSchema>;

/**
 * Schema for collaboration request
 */
export const collaborationRequestSchema = z.object({
  /** Task ID requiring collaboration */
  taskId: z.string().cuid('Invalid task ID'),

  /** Array of VP IDs needed for collaboration */
  requiredVpIds: z
    .array(z.string().cuid('Invalid VP ID'))
    .min(1, 'At least one collaborator required')
    .max(10, 'Maximum 10 collaborators allowed'),

  /** Optional role assignments for collaborators */
  roles: z.record(z.string().cuid(), z.string().max(100)).optional(),

  /** Optional note about the collaboration request */
  note: z.string().max(1000, 'Note must be less than 1000 characters').optional(),
});

export type CollaborationRequestInput = z.infer<typeof collaborationRequestSchema>;

/**
 * Schema for task handoff request
 */
export const handoffTaskSchema = z.object({
  /** Target VP ID to handoff to */
  toVpId: z.string().cuid('Invalid target VP ID'),

  /** Task ID to handoff */
  taskId: z.string().cuid('Invalid task ID'),

  /** Context and state information to transfer */
  context: z.record(z.unknown()).default({}),

  /** Optional handoff notes */
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
});

export type HandoffTaskInput = z.infer<typeof handoffTaskSchema>;

/**
 * Schema for conflict resolution
 */
export const conflictResolutionSchema = z.object({
  /** VP IDs involved in the conflict */
  vpIds: z
    .array(z.string().cuid('Invalid VP ID'))
    .min(2, 'At least two VPs required for conflict')
    .max(10, 'Maximum 10 VPs in conflict'),

  /** Type of conflict */
  conflictType: conflictTypeEnum,

  /** Resolution details */
  resolution: z.record(z.unknown()),

  /** Optional task ID if conflict is task-specific */
  taskId: z.string().cuid('Invalid task ID').optional(),

  /** Optional workspace ID if conflict is workspace-specific */
  workspaceId: z.string().cuid('Invalid workspace ID').optional(),

  /** Optional resolution notes */
  note: z.string().max(2000, 'Note must be less than 2000 characters').optional(),
});

export type ConflictResolutionInput = z.infer<typeof conflictResolutionSchema>;

/**
 * Schema for coordination history query
 */
export const coordinationHistoryQuerySchema = z.object({
  /** Task ID to get history for */
  taskId: z.string().cuid('Invalid task ID'),

  /** Optional filter by coordination type */
  type: z.enum(['delegations', 'collaborations', 'handoffs', 'conflicts']).optional(),

  /** Optional VP ID to filter by */
  vpId: z.string().cuid('Invalid VP ID').optional(),
});

export type CoordinationHistoryQueryInput = z.infer<typeof coordinationHistoryQuerySchema>;

/**
 * Common error codes for VP coordination API
 */
export const VP_COORDINATION_ERROR_CODES = {
  NOT_FOUND: 'VP_COORDINATION_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  DIFFERENT_ORGANIZATION: 'DIFFERENT_ORGANIZATION',
  INVALID_OWNERSHIP: 'INVALID_OWNERSHIP',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type VPCoordinationErrorCode =
  (typeof VP_COORDINATION_ERROR_CODES)[keyof typeof VP_COORDINATION_ERROR_CODES];

/**
 * Helper function to create standardized error response
 */
export function createCoordinationErrorResponse(
  error: string,
  code: VPCoordinationErrorCode,
  details?: Record<string, unknown>,
) {
  return {
    error,
    code,
    ...(details && { details }),
  };
}
