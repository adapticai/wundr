/**
 * VP Conversation Validation Schemas
 *
 * Zod validation schemas for VP-initiated conversation operations.
 * These schemas ensure type safety and input validation for VP communication endpoints.
 *
 * @module lib/validations/vp-conversation
 */

import { z } from 'zod';

/**
 * Schema for VP initiating a conversation
 *
 * @example
 * ```typescript
 * const data = initiateConversationSchema.parse({
 *   targetId: "user_123",
 *   targetType: "user",
 *   content: "Hello, I need to discuss the project status"
 * });
 * ```
 */
export const initiateConversationSchema = z.object({
  /** Target channel ID or user ID to send message to */
  targetId: z.string().cuid('Invalid target ID'),

  /** Type of target (channel or user) */
  targetType: z.enum(['channel', 'user']),

  /** Message content to send */
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(10000, 'Message content must be less than 10000 characters'),

  /** Optional parent message ID for threading */
  parentId: z.string().cuid('Invalid parent message ID').optional(),

  /** Optional metadata for the conversation */
  metadata: z.record(z.unknown()).optional(),
});

export type InitiateConversationInput = z.infer<typeof initiateConversationSchema>;

/**
 * Schema for VP posting a status update
 *
 * @example
 * ```typescript
 * const data = statusUpdateSchema.parse({
 *   message: "Task #123 completed successfully",
 *   statusType: "update",
 *   channelIds: ["channel_123"]
 * });
 * ```
 */
export const statusUpdateSchema = z.object({
  /** Status message content */
  message: z
    .string()
    .min(1, 'Status message is required')
    .max(2000, 'Status message must be less than 2000 characters'),

  /** Target channel IDs to post status to (if not provided, uses VP's assigned channels) */
  channelIds: z
    .array(z.string().cuid('Invalid channel ID'))
    .min(1, 'At least one channel is required')
    .max(10, 'Maximum 10 channels per status update')
    .optional(),

  /** Status type/category */
  statusType: z
    .enum(['update', 'announcement', 'alert', 'milestone', 'info'])
    .default('update'),

  /** Optional related task ID */
  taskId: z.string().cuid('Invalid task ID').optional(),

  /** Optional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

/**
 * Schema for VP escalating a task
 *
 * @example
 * ```typescript
 * const data = escalateTaskSchema.parse({
 *   taskId: "task_123",
 *   reason: "Blocked by external dependency",
 *   severity: "high",
 *   targetUserIds: ["user_456"]
 * });
 * ```
 */
export const escalateTaskSchema = z.object({
  /** Task ID to escalate */
  taskId: z.string().cuid('Invalid task ID'),

  /** Reason for escalation */
  reason: z
    .string()
    .min(1, 'Escalation reason is required')
    .max(2000, 'Escalation reason must be less than 2000 characters'),

  /** Escalation severity */
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),

  /** Optional target user IDs to escalate to (if not provided, uses workspace admins) */
  targetUserIds: z
    .array(z.string().cuid('Invalid user ID'))
    .min(1, 'At least one target user is required')
    .max(10, 'Maximum 10 target users per escalation')
    .optional(),

  /** Optional target channel ID to post escalation notice */
  channelId: z.string().cuid('Invalid channel ID').optional(),

  /** Additional context */
  context: z.record(z.unknown()).optional(),

  /** Whether to create a notification */
  createNotification: z.boolean().default(true),
});

export type EscalateTaskInput = z.infer<typeof escalateTaskSchema>;

/**
 * Schema for VP delegating a task
 *
 * @example
 * ```typescript
 * const data = delegateTaskSchema.parse({
 *   taskId: "task_123",
 *   targetUserId: "user_456",
 *   note: "Please review and complete by EOD"
 * });
 * ```
 */
export const delegateTaskSchema = z.object({
  /** Task ID to delegate */
  taskId: z.string().cuid('Invalid task ID'),

  /** Target user ID to delegate to (human or VP) */
  targetUserId: z.string().cuid('Invalid target user ID'),

  /** Optional delegation note */
  note: z
    .string()
    .max(2000, 'Delegation note must be less than 2000 characters')
    .optional(),

  /** Optional priority override */
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),

  /** Optional due date override */
  dueDate: z.string().datetime('Invalid due date format').optional(),

  /** Optional notification channel ID */
  channelId: z.string().cuid('Invalid channel ID').optional(),

  /** Whether to create a notification */
  createNotification: z.boolean().default(true),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type DelegateTaskInput = z.infer<typeof delegateTaskSchema>;

/**
 * Schema for fetching VP mentions
 */
export const vpMentionsFiltersSchema = z.object({
  /** Filter by channel ID */
  channelId: z.string().cuid('Invalid channel ID').optional(),

  /** Filter by handled status */
  handled: z.coerce.boolean().optional(),

  /** Filter by date range */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),

  /** Include resolved mentions */
  includeResolved: z.coerce.boolean().default(false),

  /** Pagination: page number (1-indexed) */
  page: z.coerce.number().int().positive().default(1),

  /** Pagination: items per page */
  limit: z.coerce.number().int().positive().max(100).default(20),

  /** Sort by field */
  sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),

  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type VPMentionsFiltersInput = z.infer<typeof vpMentionsFiltersSchema>;

/**
 * Schema for marking mentions as handled
 */
export const markMentionsHandledSchema = z.object({
  /** Mention IDs to mark as handled */
  mentionIds: z
    .array(z.string().cuid('Invalid mention ID'))
    .min(1, 'At least one mention ID is required')
    .max(100, 'Maximum 100 mentions per operation'),

  /** Whether mentions are handled or not */
  handled: z.boolean().default(true),

  /** Optional resolution note */
  note: z.string().max(500).optional(),
});

export type MarkMentionsHandledInput = z.infer<typeof markMentionsHandledSchema>;

/**
 * Standard error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Helper function to create standardized error response
 */
export function createErrorResponse(
  error: string,
  code: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    error,
    code,
    ...(details && { details }),
  };
}

/**
 * Common error codes for VP Conversation API
 */
export const VP_CONVERSATION_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_PERMISSION: 'NO_PERMISSION',
  CONVERSATION_EXISTS: 'CONVERSATION_EXISTS',
  INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
  TASK_NOT_ASSIGNED: 'TASK_NOT_ASSIGNED',
  CANNOT_DELEGATE: 'CANNOT_DELEGATE',
  CANNOT_ESCALATE: 'CANNOT_ESCALATE',
  NO_ASSIGNED_CHANNELS: 'NO_ASSIGNED_CHANNELS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type VPConversationErrorCode =
  (typeof VP_CONVERSATION_ERROR_CODES)[keyof typeof VP_CONVERSATION_ERROR_CODES];
