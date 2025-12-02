/**
 * Threads Validation Schemas
 * @module lib/validations/threads
 */

import { z } from 'zod';

export const THREADS_ERROR_CODES = {
  INVALID_THREAD: 'THREADS_INVALID',
  THREAD_NOT_FOUND: 'THREADS_NOT_FOUND',
  UNAUTHORIZED: 'THREADS_UNAUTHORIZED',
  INVALID_PARENT: 'THREADS_INVALID_PARENT',
  MAX_DEPTH_EXCEEDED: 'THREADS_MAX_DEPTH',
  VALIDATION_ERROR: 'THREADS_VALIDATION_ERROR',
  INTERNAL_ERROR: 'THREADS_INTERNAL_ERROR',
  FORBIDDEN: 'THREADS_FORBIDDEN',
  NOT_CHANNEL_MEMBER: 'THREADS_NOT_CHANNEL_MEMBER',
} as const;

export type ThreadsErrorCode =
  (typeof THREADS_ERROR_CODES)[keyof typeof THREADS_ERROR_CODES];

export const threadSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  rootId: z.string(),
  authorId: z.string(),
  content: z.string(),
  depth: z.number().nonnegative(),
  path: z.array(z.string()),
  messageCount: z.number().nonnegative(),
  participantIds: z.array(z.string()),
  status: z.enum(['active', 'locked', 'archived']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMessageAt: z.string().datetime().optional(),
});

export const createThreadSchema = threadSchema.omit({
  id: true,
  depth: true,
  path: true,
  messageCount: true,
  participantIds: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});

export const threadMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  authorId: z.string(),
  content: z.string(),
  replyToId: z.string().optional(),
  edited: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createThreadMessageSchema = threadMessageSchema.omit({
  id: true,
  edited: true,
  createdAt: true,
  updatedAt: true,
});

export const threadQuerySchema = z.object({
  rootId: z.string().optional(),
  authorId: z.string().optional(),
  status: z.enum(['active', 'locked', 'archived']).array().optional(),
  minDepth: z.coerce.number().nonnegative().optional(),
  maxDepth: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().positive().optional(),
  offset: z.coerce.number().nonnegative().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  cursor: z.string().optional(),
});

// Alias for THREADS_ERROR_CODES (legacy name)
export const THREAD_ERROR_CODES = THREADS_ERROR_CODES;

/**
 * Create thread reply schema
 */
export const createThreadReplySchema = z.object({
  threadId: z.string(),
  content: z.string().min(1),
  replyToId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateThreadReplyInput = z.infer<typeof createThreadReplySchema>;

/**
 * List threads schema
 */
export const listThreadsSchema = z.object({
  rootId: z.string().optional(),
  authorId: z.string().optional(),
  status: z.enum(['active', 'locked', 'archived']).optional(),
  channelId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'lastMessageAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  cursor: z.string().optional(),
});

export type ListThreadsInput = z.infer<typeof listThreadsSchema>;
