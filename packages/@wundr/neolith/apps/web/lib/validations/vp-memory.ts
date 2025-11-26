/**
 * VP Memory Validation Schemas
 *
 * Zod validation schemas for VP memory-related API operations.
 * These schemas ensure type safety and input validation for all VP memory endpoints.
 *
 * @module lib/validations/vp-memory
 */

import { z } from 'zod';

/**
 * Memory type enum
 * Defines the types of memories that can be stored for a VP
 */
export const memoryTypeEnum = z.enum([
  'conversation',
  'task_completion',
  'learned_pattern',
  'preference',
]);
export type MemoryType = z.infer<typeof memoryTypeEnum>;

/**
 * Schema for creating a new VP memory entry
 */
export const createMemorySchema = z.object({
  /** Type of memory being stored */
  memoryType: memoryTypeEnum,

  /** Memory content as text */
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be less than 50000 characters'),

  /** Optional embedding data for semantic search (JSON format) */
  embedding: z.record(z.unknown()).optional().nullable(),

  /** Metadata associated with the memory */
  metadata: z.record(z.unknown()).optional().default({}),

  /** Importance score from 0.0 to 1.0 */
  importance: z
    .number()
    .min(0, 'Importance must be at least 0')
    .max(1, 'Importance must be at most 1')
    .optional()
    .default(0.5),

  /** Optional expiration date for the memory */
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

/**
 * Schema for updating an existing memory entry
 */
export const updateMemorySchema = z.object({
  /** Updated content */
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(50000, 'Content must be less than 50000 characters')
    .optional(),

  /** Updated embedding */
  embedding: z.record(z.unknown()).optional().nullable(),

  /** Updated metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Updated importance */
  importance: z
    .number()
    .min(0, 'Importance must be at least 0')
    .max(1, 'Importance must be at most 1')
    .optional(),

  /** Updated expiration date */
  expiresAt: z.string().datetime().optional().nullable(),
});

export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;

/**
 * Schema for memory list filters
 */
export const memoryFiltersSchema = z.object({
  /** Filter by memory type(s) */
  memoryType: z
    .union([memoryTypeEnum, z.array(memoryTypeEnum)])
    .optional(),

  /** Search by content keywords */
  search: z.string().max(500).optional(),

  /** Minimum importance filter */
  minImportance: z.coerce.number().min(0).max(1).optional(),

  /** Filter by date range - from */
  from: z.string().datetime().optional(),

  /** Filter by date range - to */
  to: z.string().datetime().optional(),

  /** Include expired memories */
  includeExpired: z.coerce.boolean().default(false),

  /** Pagination: page number (1-indexed) */
  page: z.coerce.number().int().positive().default(1),

  /** Pagination: items per page */
  limit: z.coerce.number().int().positive().max(100).default(20),

  /** Sort field */
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'importance', 'memoryType'])
    .default('createdAt'),

  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type MemoryFiltersInput = z.infer<typeof memoryFiltersSchema>;

/**
 * Schema for memory search with query
 */
export const memorySearchSchema = z.object({
  /** Search query */
  query: z
    .string()
    .min(1, 'Query is required')
    .max(1000, 'Query must be less than 1000 characters'),

  /** Filter by memory type(s) */
  memoryType: z
    .union([memoryTypeEnum, z.array(memoryTypeEnum)])
    .optional(),

  /** Minimum importance filter */
  minImportance: z.coerce.number().min(0).max(1).optional(),

  /** Maximum results to return */
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type MemorySearchInput = z.infer<typeof memorySearchSchema>;

/**
 * Schema for storing conversation memory
 */
export const storeConversationSchema = z.object({
  /** Channel ID where conversation occurred */
  channelId: z.string().cuid('Invalid channel ID'),

  /** Conversation messages */
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1),
        timestamp: z.string().datetime(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .min(1, 'At least one message is required'),

  /** Optional importance override */
  importance: z.number().min(0).max(1).optional(),

  /** Optional expiration date */
  expiresAt: z.string().datetime().optional(),
});

export type StoreConversationInput = z.infer<typeof storeConversationSchema>;

/**
 * Schema for storing task completion memory
 */
export const storeTaskCompletionSchema = z.object({
  /** Task ID */
  taskId: z.string().cuid('Invalid task ID'),

  /** Task result status */
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']),

  /** Task result data */
  result: z.record(z.unknown()).optional(),

  /** Error message if task failed */
  error: z.string().optional(),

  /** Learnings from task completion */
  learnings: z.string().max(5000).optional(),

  /** Artifact references (e.g., S3 URLs) */
  artifacts: z.array(z.string().url()).optional(),

  /** Optional importance override */
  importance: z.number().min(0).max(1).optional(),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type StoreTaskCompletionInput = z.infer<typeof storeTaskCompletionSchema>;

/**
 * Schema for storing learned pattern
 */
export const storePatternSchema = z.object({
  /** Pattern description */
  pattern: z
    .string()
    .min(1, 'Pattern is required')
    .max(5000, 'Pattern must be less than 5000 characters'),

  /** Context where pattern was learned */
  context: z.record(z.unknown()).optional(),

  /** Pattern category */
  category: z
    .enum(['code_style', 'common_error', 'successful_approach', 'best_practice', 'other'])
    .optional()
    .default('other'),

  /** Optional importance override */
  importance: z.number().min(0).max(1).optional().default(0.7),

  /** Optional tags for categorization */
  tags: z.array(z.string()).optional(),
});

export type StorePatternInput = z.infer<typeof storePatternSchema>;

/**
 * Schema for storing preference
 */
export const storePreferenceSchema = z.object({
  /** Preference key */
  key: z
    .string()
    .min(1, 'Key is required')
    .max(100, 'Key must be less than 100 characters'),

  /** Preference value */
  value: z.unknown(),

  /** Optional description */
  description: z.string().max(500).optional(),

  /** Optional importance override */
  importance: z.number().min(0).max(1).optional().default(0.6),
});

export type StorePreferenceInput = z.infer<typeof storePreferenceSchema>;

/**
 * Memory ID parameter schema for route params
 */
export const memoryIdParamSchema = z.object({
  memoryId: z.string().cuid('Invalid memory ID format'),
});

export type MemoryIdParam = z.infer<typeof memoryIdParamSchema>;

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
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error,
    code,
    ...(details && { details }),
  };
}

/**
 * Common error codes for VP Memory API
 */
export const MEMORY_ERROR_CODES = {
  NOT_FOUND: 'MEMORY_NOT_FOUND',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXPIRED: 'MEMORY_EXPIRED',
  STORAGE_LIMIT_EXCEEDED: 'STORAGE_LIMIT_EXCEEDED',
} as const;

export type MemoryErrorCode =
  (typeof MEMORY_ERROR_CODES)[keyof typeof MEMORY_ERROR_CODES];
