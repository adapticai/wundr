/**
 * Message Validation Schemas
 * @module lib/validations/message
 */

import { z } from 'zod';

export const MESSAGE_ERROR_CODES = {
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_CONTENT: 'INVALID_CONTENT',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_CHANNEL_MEMBER: 'NOT_CHANNEL_MEMBER',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_PARENT: 'INVALID_PARENT',
  ALREADY_PINNED: 'ALREADY_PINNED',
  NOT_PINNED: 'NOT_PINNED',
  THREAD_NOT_FOUND: 'THREAD_NOT_FOUND',
  NOT_FOUND: 'MESSAGE_NOT_FOUND_GENERIC',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  FORBIDDEN: 'MESSAGE_FORBIDDEN',
  ALREADY_REACTED: 'MESSAGE_ALREADY_REACTED',
  REACTION_NOT_FOUND: 'MESSAGE_REACTION_NOT_FOUND',
  CANNOT_EDIT: 'MESSAGE_CANNOT_EDIT',
  CANNOT_DELETE: 'MESSAGE_CANNOT_DELETE',
  PIN_ALREADY_EXISTS: 'MESSAGE_PIN_ALREADY_EXISTS',
  PIN_NOT_FOUND: 'MESSAGE_PIN_NOT_FOUND',
  // Thread-specific error codes (for compatibility with thread routes)
  THREADS_INVALID: 'THREADS_INVALID',
  THREADS_NOT_FOUND: 'THREADS_NOT_FOUND',
  THREADS_UNAUTHORIZED: 'THREADS_UNAUTHORIZED',
  THREADS_INVALID_PARENT: 'THREADS_INVALID_PARENT',
  THREADS_MAX_DEPTH: 'THREADS_MAX_DEPTH',
  THREADS_VALIDATION_ERROR: 'THREADS_VALIDATION_ERROR',
  THREADS_INTERNAL_ERROR: 'THREADS_INTERNAL_ERROR',
  THREADS_FORBIDDEN: 'THREADS_FORBIDDEN',
  THREADS_NOT_CHANNEL_MEMBER: 'THREADS_NOT_CHANNEL_MEMBER',
} as const;

export type MessageErrorCode =
  (typeof MESSAGE_ERROR_CODES)[keyof typeof MESSAGE_ERROR_CODES];

export const messageTypeEnum = z.enum(['TEXT', 'SYSTEM', 'FILE', 'COMMAND']);

export type MessageType = z.infer<typeof messageTypeEnum>;

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  channelId: z.string().min(1),
  type: messageTypeEnum.default('TEXT'),
  parentId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  attachmentIds: z.array(z.string().min(1)).optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

export const messageIdParamSchema = z.object({
  id: z.string().min(1),
});

export function createMessageErrorResponse(
  code: MessageErrorCode,
  message: string,
  status: number = 400
): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Generic error response creator
 * Can be called as:
 * - createErrorResponse(message, status) - where status is a number
 * - createErrorResponse(message, code) - where code is an error code string
 * - createErrorResponse(message, code, details) - with additional error details
 */
export function createErrorResponse(
  message: string,
  codeOrStatus: MessageErrorCode | string | number = 400,
  details?: Record<string, unknown>
):
  | { error: string; message: string; details?: Record<string, unknown> }
  | { error: string } {
  if (typeof codeOrStatus === 'number') {
    return { error: message };
  }
  return { error: codeOrStatus, message, ...(details ? { details } : {}) };
}

// Parameter schemas
export const channelIdParamSchema = z.object({
  channelId: z.string().min(1),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().min(1),
});

// Send message schema (alias for createMessageSchema with additional fields)
// channelId is optional here because route handlers get it from URL path params
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  channelId: z.string().min(1).optional(),
  type: messageTypeEnum.default('TEXT'),
  parentId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  mentions: z.array(z.string().min(1)).optional(),
  attachments: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string().min(1)).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Message list schema
// channelId is optional here because route handlers get it from URL path params
export const messageListSchema = z.object({
  channelId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().min(1).optional(),
  after: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['before', 'after']).default('before'),
  includeReplies: z.coerce.boolean().default(false),
});

export type MessageListInput = z.infer<typeof messageListSchema>;

// Message search schema
export const messageSearchSchema = z.object({
  query: z.string().min(1).max(200),
  channelId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type MessageSearchInput = z.infer<typeof messageSearchSchema>;

// Add reaction schema
export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(100),
  messageId: z.string().min(1),
});

export type AddReactionInput = z.infer<typeof addReactionSchema>;

// Pin message schema
// channelId is optional here because route handlers get it from URL path params
export const pinMessageSchema = z.object({
  messageId: z.string().min(1),
  channelId: z.string().min(1).optional(),
});

export type PinMessageInput = z.infer<typeof pinMessageSchema>;

// Thread list schema
// channelId is optional here because route handlers get it from URL path params
export const threadListSchema = z.object({
  channelId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  cursor: z.string().min(1).optional(),
});

export type ThreadListInput = z.infer<typeof threadListSchema>;

// Typing indicator schema
// channelId is optional here because route handlers get it from URL path params
export const typingIndicatorSchema = z.object({
  channelId: z.string().min(1).optional(),
  isTyping: z.boolean().default(true),
});

export type TypingIndicatorInput = z.infer<typeof typingIndicatorSchema>;

// Message filters schema
export const messageFiltersSchema = z.object({
  cursor: z.string().optional(),
  direction: z.enum(['forward', 'backward']).optional(),
  includeReplies: z.boolean().optional(),
});

export type MessageFiltersInput = z.infer<typeof messageFiltersSchema>;
