/**
 * @genesis/core - Message Type Definitions
 *
 * Type definitions for the messaging service layer including messages,
 * threads, reactions, and real-time events.
 *
 * @packageDocumentation
 */

import type { Message, Reaction, User, MessageType } from '@neolith/database';

// =============================================================================
// Core Message Types
// =============================================================================

/**
 * Message with author information included.
 */
export interface MessageWithAuthor extends Message {
  /** The message author */
  author: User;
}

/**
 * Message with full relations (author, reactions, replies).
 */
export interface MessageWithRelations extends Message {
  /** The message author */
  author: User;
  /** Message reactions */
  reactions: Reaction[];
  /** Thread replies (if this is a parent message) */
  replies?: Message[];
  /** Parent message (if this is a thread reply) */
  parent?: Message | null;
  /** Whether the message is soft-deleted */
  isDeleted: boolean;
  /** Channel ID the message belongs to */
  channelId: string;
}

/**
 * Reaction with user information included.
 */
export interface ReactionWithUser extends Reaction {
  /** The user who added the reaction */
  user: User;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for sending a new message.
 */
export interface SendMessageInput {
  /** The channel ID to send the message to */
  channelId: string;
  /** The author's user ID */
  authorId: string;
  /** The message content */
  content: string;
  /** Message type (default: TEXT) */
  type?: 'TEXT' | 'SYSTEM' | 'FILE' | 'COMMAND';
  /** Parent message ID for thread replies */
  parentId?: string;
  /** Additional message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing message.
 */
export interface UpdateMessageInput {
  /** New message content */
  content: string;
  /** Optional metadata updates */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Query Options
// =============================================================================

/**
 * Options for querying messages.
 */
export interface MessageQueryOptions {
  /** Maximum number of messages to return */
  limit?: number;
  /** Cursor for messages before this ID (for backward pagination) */
  before?: string;
  /** Cursor for messages after this ID (for forward pagination) */
  after?: string;
  /** Include soft-deleted messages */
  includeDeleted?: boolean;
  /** Filter by message type */
  type?: MessageType;
  /** Include reactions in the response */
  includeReactions?: boolean;
  /** Include author information */
  includeAuthor?: boolean;
}

/**
 * Paginated result for messages.
 */
export interface PaginatedMessages {
  /** The message data */
  data: MessageWithRelations[];
  /** Total count of messages matching the query */
  total: number;
  /** Whether there are more messages available */
  hasMore: boolean;
  /** Cursor for the next page (oldest message ID) */
  nextCursor?: string;
  /** Cursor for the previous page (newest message ID) */
  prevCursor?: string;
}

// =============================================================================
// Reaction Types
// =============================================================================

/**
 * Aggregated reaction count by emoji.
 */
export interface ReactionCount {
  /** The emoji */
  emoji: string;
  /** Number of users who reacted with this emoji */
  count: number;
  /** Sample of user IDs who reacted (for display) */
  userIds: string[];
}

/**
 * Result of adding a reaction.
 */
export interface AddReactionResult {
  /** The created reaction */
  reaction: Reaction;
  /** Whether this was a new reaction (vs already existed) */
  created: boolean;
}

// =============================================================================
// Thread Types
// =============================================================================

/**
 * Thread summary information.
 */
export interface ThreadSummary {
  /** The parent message ID */
  parentId: string;
  /** Total number of replies */
  replyCount: number;
  /** Timestamp of the last reply */
  lastReplyAt: Date | null;
  /** User IDs of participants in the thread */
  participantIds: string[];
  /** Preview of the last reply */
  lastReply?: MessageWithAuthor;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Types of message events.
 */
export type MessageEventType =
  | 'MESSAGE_CREATED'
  | 'MESSAGE_UPDATED'
  | 'MESSAGE_DELETED'
  | 'REACTION_ADDED'
  | 'REACTION_REMOVED'
  | 'THREAD_UPDATED';

/**
 * Base event structure for message events.
 */
export interface BaseMessageEvent {
  /** Event type */
  type: MessageEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Channel ID where the event occurred */
  channelId: string;
}

/**
 * Event emitted when a message is created.
 */
export interface MessageCreatedEvent extends BaseMessageEvent {
  type: 'MESSAGE_CREATED';
  /** The created message */
  message: MessageWithRelations;
}

/**
 * Event emitted when a message is updated.
 */
export interface MessageUpdatedEvent extends BaseMessageEvent {
  type: 'MESSAGE_UPDATED';
  /** The updated message */
  message: MessageWithRelations;
  /** Fields that were updated */
  updatedFields: string[];
}

/**
 * Event emitted when a message is deleted.
 */
export interface MessageDeletedEvent extends BaseMessageEvent {
  type: 'MESSAGE_DELETED';
  /** The deleted message ID */
  messageId: string;
  /** Whether it was a soft or hard delete */
  softDelete: boolean;
}

/**
 * Event emitted when a reaction is added.
 */
export interface ReactionAddedEvent extends BaseMessageEvent {
  type: 'REACTION_ADDED';
  /** The message ID */
  messageId: string;
  /** The added reaction */
  reaction: Reaction;
}

/**
 * Event emitted when a reaction is removed.
 */
export interface ReactionRemovedEvent extends BaseMessageEvent {
  type: 'REACTION_REMOVED';
  /** The message ID */
  messageId: string;
  /** The removed emoji */
  emoji: string;
  /** The user who removed the reaction */
  userId: string;
}

/**
 * Event emitted when a thread is updated.
 */
export interface ThreadUpdatedEvent extends BaseMessageEvent {
  type: 'THREAD_UPDATED';
  /** The parent message ID */
  parentId: string;
  /** Updated thread summary */
  summary: ThreadSummary;
}

/**
 * Union type of all message events.
 */
export type MessageEvent =
  | MessageCreatedEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | ReactionAddedEvent
  | ReactionRemovedEvent
  | ThreadUpdatedEvent;

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback for message created events.
 */
export type OnMessageCreatedCallback = (message: MessageWithRelations) => void;

/**
 * Callback for message updated events.
 */
export type OnMessageUpdatedCallback = (message: MessageWithRelations) => void;

/**
 * Callback for message deleted events.
 */
export type OnMessageDeletedCallback = (messageId: string, softDelete: boolean) => void;

/**
 * Callback for reaction added events.
 */
export type OnReactionAddedCallback = (messageId: string, reaction: Reaction) => void;

/**
 * Callback for reaction removed events.
 */
export type OnReactionRemovedCallback = (messageId: string, emoji: string, userId: string) => void;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a message has author information.
 */
export function isMessageWithAuthor(message: unknown): message is MessageWithAuthor {
  return (
    typeof message === 'object' &&
    message !== null &&
    'id' in message &&
    'content' in message &&
    'author' in message &&
    typeof (message as MessageWithAuthor).author === 'object'
  );
}

/**
 * Type guard to check if a message has full relations.
 */
export function isMessageWithRelations(message: unknown): message is MessageWithRelations {
  return (
    isMessageWithAuthor(message) &&
    'reactions' in message &&
    Array.isArray((message as MessageWithRelations).reactions)
  );
}

/**
 * Type guard to validate SendMessageInput.
 */
export function isValidSendMessageInput(input: unknown): input is SendMessageInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const data = input as Record<string, unknown>;

  return (
    typeof data.channelId === 'string' &&
    data.channelId.length > 0 &&
    typeof data.authorId === 'string' &&
    data.authorId.length > 0 &&
    typeof data.content === 'string'
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default message query options.
 */
export const DEFAULT_MESSAGE_QUERY_OPTIONS: Required<
  Pick<MessageQueryOptions, 'limit' | 'includeDeleted' | 'includeReactions' | 'includeAuthor'>
> = {
  limit: 50,
  includeDeleted: false,
  includeReactions: true,
  includeAuthor: true,
};

/**
 * Maximum number of messages that can be fetched in one request.
 */
export const MAX_MESSAGE_LIMIT = 100;

/**
 * Maximum content length for a message.
 */
export const MAX_MESSAGE_CONTENT_LENGTH = 40000;

/**
 * Maximum number of reactions per message.
 */
export const MAX_REACTIONS_PER_MESSAGE = 50;

/**
 * Valid message types.
 */
export const MESSAGE_TYPES = ['TEXT', 'SYSTEM', 'FILE', 'COMMAND'] as const;
