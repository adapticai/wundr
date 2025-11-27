/**
 * Work Session Validation Schemas
 *
 * Zod validation schemas for Orchestrator work session and task execution operations.
 *
 * @module lib/validations/work-session
 */

import { z } from 'zod';

import { taskStatusEnum } from './task';

/**
 * Work session status type
 */
export const workSessionStatusEnum = z.enum([
  'idle',
  'active',
  'paused',
  'completed',
  'error',
]);
export type WorkSessionStatusType = z.infer<typeof workSessionStatusEnum>;

/**
 * Status update message type
 */
export const statusUpdateTypeEnum = z.enum([
  'task_started',
  'progress',
  'task_completed',
  'blocked',
  'error',
  'info',
]);
export type StatusUpdateType = z.infer<typeof statusUpdateTypeEnum>;

/**
 * Schema for work session status response
 */
export const workSessionStatusSchema = z.object({
  taskId: z.string().cuid('Invalid task ID').nullable(),
  status: workSessionStatusEnum,
  startedAt: z.string().datetime().nullable(),
  progress: z.number().min(0).max(100).default(0),
  lastUpdate: z.string().datetime().nullable(),
  currentAction: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkSessionStatusResponse = z.infer<typeof workSessionStatusSchema>;

/**
 * Schema for capturing work session output
 */
export const captureOutputSchema = z.object({
  /** Task ID for this output */
  taskId: z.string().cuid('Invalid task ID'),

  /** Incremental output/logs from Orchestrator */
  output: z.string().max(100000, 'Output exceeds maximum length'),

  /** Array of artifact S3 URLs */
  artifacts: z.array(z.string().url('Invalid artifact URL')).default([]),

  /** Current progress percentage */
  progress: z.number().min(0).max(100),

  /** Optional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type CaptureOutputInput = z.infer<typeof captureOutputSchema>;

/**
 * Schema for updating task status
 */
export const updateTaskStatusSchema = z.object({
  /** New task status */
  status: taskStatusEnum,

  /** Execution result (for DONE status) */
  result: z.record(z.unknown()).optional(),

  /** Notes about the status change */
  notes: z.string().max(5000).optional(),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

/**
 * Schema for posting status updates to channel
 */
export const postStatusUpdateSchema = z.object({
  /** Channel ID to post to */
  channelId: z.string().cuid('Invalid channel ID'),

  /** Status update message */
  message: z.string().min(1).max(2000, 'Message too long'),

  /** Type of status update */
  type: statusUpdateTypeEnum,

  /** Optional metadata for the update */
  metadata: z.record(z.unknown()).optional(),
});

export type PostStatusUpdateInput = z.infer<typeof postStatusUpdateSchema>;

/**
 * Schema for artifact upload
 */
export const uploadArtifactSchema = z.object({
  /** Artifact filename */
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9_\-\.]+$/, 'Invalid filename format'),

  /** Content type / MIME type */
  contentType: z.string().min(1, 'Content type is required'),

  /** Artifact content (base64 encoded for binary) */
  content: z.string().min(1, 'Content is required'),

  /** Task ID this artifact belongs to */
  taskId: z.string().cuid('Invalid task ID'),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type UploadArtifactInput = z.infer<typeof uploadArtifactSchema>;

/**
 * Schema for file upload (multipart form data alternative)
 */
export const fileUploadMetadataSchema = z.object({
  taskId: z.string().cuid('Invalid task ID'),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type FileUploadMetadata = z.infer<typeof fileUploadMetadataSchema>;

/**
 * Common error codes for work session operations
 */
export const WORK_SESSION_ERROR_CODES = {
  NOT_FOUND: 'WORK_SESSION_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  S3_UPLOAD_FAILED: 'S3_UPLOAD_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type WorkSessionErrorCode =
  (typeof WORK_SESSION_ERROR_CODES)[keyof typeof WORK_SESSION_ERROR_CODES];

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
 * Valid task status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO', 'CANCELLED'],
  BLOCKED: ['TODO', 'CANCELLED'],
  DONE: [], // Cannot transition from DONE
  CANCELLED: ['TODO'], // Can reopen cancelled tasks
};

/**
 * Validate if a status transition is allowed
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string,
): boolean {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}
