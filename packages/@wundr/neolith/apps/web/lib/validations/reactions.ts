/**
 * Reactions Validation Schemas
 * @module lib/validations/reactions
 */

import { z } from 'zod';

export const REACTIONS_ERROR_CODES = {
  INVALID_REACTION: 'REACTIONS_INVALID',
  DUPLICATE_REACTION: 'REACTIONS_DUPLICATE',
  NOT_FOUND: 'REACTIONS_NOT_FOUND',
  UNAUTHORIZED: 'REACTIONS_UNAUTHORIZED',
  INVALID_TARGET: 'REACTIONS_INVALID_TARGET',
  VALIDATION_ERROR: 'REACTIONS_VALIDATION_ERROR',
  FORBIDDEN: 'REACTIONS_FORBIDDEN',
  INTERNAL_ERROR: 'REACTIONS_INTERNAL_ERROR',
  ALREADY_REACTED: 'REACTIONS_ALREADY_REACTED',
} as const;

export type ReactionsErrorCode =
  (typeof REACTIONS_ERROR_CODES)[keyof typeof REACTIONS_ERROR_CODES];

export const reactionTypeSchema = z.enum([
  'like',
  'love',
  'celebrate',
  'support',
  'insightful',
  'curious',
  'thumbs_up',
  'thumbs_down',
  'rocket',
  'fire',
  'eyes',
]);

export const reactionSchema = z.object({
  id: z.string(),
  type: reactionTypeSchema,
  userId: z.string(),
  targetType: z.enum(['message', 'task', 'comment', 'document']),
  targetId: z.string(),
  createdAt: z.string().datetime(),
});

export const createReactionSchema = reactionSchema.omit({
  id: true,
  createdAt: true,
});

export const reactionSummarySchema = z.object({
  targetType: z.enum(['message', 'task', 'comment', 'document']),
  targetId: z.string(),
  reactions: z.record(
    reactionTypeSchema,
    z.object({
      count: z.number().nonnegative(),
      users: z.array(z.string()),
    })
  ),
  totalReactions: z.number().nonnegative(),
});

export const bulkReactionsSchema = z.object({
  reactions: z.array(createReactionSchema),
  options: z
    .object({
      skipDuplicates: z.boolean().optional(),
    })
    .optional(),
});

// Alias for REACTIONS_ERROR_CODES (legacy name)
export const REACTION_ERROR_CODES = REACTIONS_ERROR_CODES;

/**
 * Add reaction schema
 */
export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(100),
  type: reactionTypeSchema.optional(),
  targetType: z.enum(['message', 'task', 'comment', 'document']).optional(),
  targetId: z.string().optional(),
});

export type AddReactionInput = z.infer<typeof addReactionSchema>;

/**
 * Reaction list schema (for querying reactions)
 */
export const reactionListSchema = z.object({
  targetType: z.enum(['message', 'task', 'comment', 'document']).optional(),
  targetId: z.string().optional(),
  userId: z.string().optional(),
  type: reactionTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  grouped: z.coerce.boolean().optional().default(false),
  includeUsers: z.coerce.boolean().optional().default(false),
});

export type ReactionListInput = z.infer<typeof reactionListSchema>;
