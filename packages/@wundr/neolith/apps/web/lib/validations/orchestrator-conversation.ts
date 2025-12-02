/**
 * Orchestrator Conversation Validation Schemas
 * @module lib/validations/orchestrator-conversation
 */

import { z } from 'zod';

export const ORCHESTRATOR_CONVERSATION_ERROR_CODES = {
  INVALID_MESSAGE: 'CONVERSATION_INVALID_MESSAGE',
  PARTICIPANT_NOT_FOUND: 'CONVERSATION_PARTICIPANT_NOT_FOUND',
  UNAUTHORIZED: 'CONVERSATION_UNAUTHORIZED',
  RATE_LIMIT_EXCEEDED: 'CONVERSATION_RATE_LIMIT_EXCEEDED',
  INVALID_CONTEXT: 'CONVERSATION_INVALID_CONTEXT',
  VALIDATION_ERROR: 'CONVERSATION_VALIDATION_ERROR',
  WORKSPACE_NOT_FOUND: 'CONVERSATION_WORKSPACE_NOT_FOUND',
  ORCHESTRATOR_NOT_FOUND: 'CONVERSATION_ORCHESTRATOR_NOT_FOUND',
  FORBIDDEN: 'CONVERSATION_FORBIDDEN',
  INTERNAL_ERROR: 'CONVERSATION_INTERNAL_ERROR',
  NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  TASK_NOT_FOUND: 'CONVERSATION_TASK_NOT_FOUND',
  TASK_NOT_ASSIGNED: 'CONVERSATION_TASK_NOT_ASSIGNED',
  CHANNEL_NOT_FOUND: 'CONVERSATION_CHANNEL_NOT_FOUND',
  USER_NOT_FOUND: 'CONVERSATION_USER_NOT_FOUND',
  NO_ASSIGNED_CHANNELS: 'CONVERSATION_NO_ASSIGNED_CHANNELS',
} as const;

export type OrchestratorConversationErrorCode =
  (typeof ORCHESTRATOR_CONVERSATION_ERROR_CODES)[keyof typeof ORCHESTRATOR_CONVERSATION_ERROR_CODES];

export const conversationRoleSchema = z.enum([
  'user',
  'agent',
  'system',
  'coordinator',
]);

export const conversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: conversationRoleSchema,
  senderId: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  parentMessageId: z.string().optional(),
  parentId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const createConversationMessageSchema = conversationMessageSchema.omit({
  id: true,
  createdAt: true,
});

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  participants: z.array(z.string()),
  context: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const conversationContextSchema = z.object({
  taskId: z.string().optional(),
  workspaceId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const conversationSummarySchema = z.object({
  conversationId: z.string(),
  messageCount: z.number().nonnegative(),
  participantCount: z.number().positive(),
  lastMessageAt: z.string().datetime(),
  summary: z.string().optional(),
});

/**
 * Create standardized conversation error response
 */
export function createErrorResponse(
  message: string,
  code: OrchestratorConversationErrorCode,
  extraData?: Record<string, unknown>
): { error: OrchestratorConversationErrorCode; message: string } & Record<
  string,
  unknown
> {
  return { error: code, message, ...extraData };
}

/**
 * Initiate conversation schema
 */
export const initiateConversationSchema = z.object({
  orchestratorId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  context: conversationContextSchema.optional(),
  content: z.string().min(1).max(10000),
  targetId: z.string().uuid(),
  targetType: z.enum(['channel', 'user']),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  participants: z.array(z.string()).optional(),
});

export type InitiateConversationInput = z.infer<
  typeof initiateConversationSchema
>;

/**
 * Delegate task schema
 */
export const delegateTaskSchema = z.object({
  taskId: z.string().uuid(),
  targetOrchestrator: z.string().uuid(),
  targetUserId: z.string().uuid(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  context: z.record(z.unknown()).optional(),
  note: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  createNotification: z.boolean().optional().default(true),
  channelId: z.string().uuid().optional(),
});

export type DelegateTaskInput = z.infer<typeof delegateTaskSchema>;

/**
 * Escalate task schema
 */
export const escalateTaskSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  context: z.record(z.unknown()).optional(),
  targetLevel: z.enum(['supervisor', 'admin', 'human']).optional(),
  targetUserIds: z.array(z.string().uuid()).optional(),
  channelId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EscalateTaskInput = z.infer<typeof escalateTaskSchema>;

/**
 * Status update schema
 */
export const statusUpdateSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  message: z.string().min(1).max(10000),
  statusType: z
    .enum(['progress', 'milestone', 'announcement', 'completion', 'issue'])
    .optional(),
  taskId: z.string().uuid().optional(),
  channelIds: z.array(z.string().uuid()).optional(),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

/**
 * Orchestrator mentions filters schema
 */
export const orchestratorMentionsFiltersSchema = z.object({
  orchestratorId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  handled: z.boolean().optional(),
  includeResolved: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  page: z.coerce.number().int().positive().optional().default(1),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type OrchestratorMentionsFiltersInput = z.infer<
  typeof orchestratorMentionsFiltersSchema
>;

/**
 * Mark mentions handled schema
 */
export const markMentionsHandledSchema = z.object({
  mentionIds: z.array(z.string().uuid()).min(1),
  handled: z.boolean(),
  handledBy: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
  response: z.string().max(2000).optional(),
});

export type MarkMentionsHandledInput = z.infer<
  typeof markMentionsHandledSchema
>;
