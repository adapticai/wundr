/**
 * Message Type Definitions
 *
 * Comprehensive TypeScript types for messaging, reactions, and threads
 * within the Genesis App platform.
 *
 * @module @genesis/api-types/types/message
 */

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Message content type enumeration
 */
export const MessageContentType = {
  /** Standard text message */
  Text: 'TEXT',
  /** System-generated message (e.g., user joined, channel created) */
  System: 'SYSTEM',
  /** Message containing file attachment */
  File: 'FILE',
  /** Message containing code snippet */
  Code: 'CODE',
} as const;

export type MessageContentType = (typeof MessageContentType)[keyof typeof MessageContentType];

/**
 * Message delivery status
 */
export const MessageStatus = {
  /** Message is being sent */
  Sending: 'SENDING',
  /** Message has been sent successfully */
  Sent: 'SENT',
  /** Message delivery failed */
  Failed: 'FAILED',
  /** Message has been delivered to recipient */
  Delivered: 'DELIVERED',
  /** Message has been read by recipient */
  Read: 'READ',
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

// =============================================================================
// CORE MESSAGE ENTITY
// =============================================================================

/**
 * Main Message entity type
 */
export interface Message {
  /** Unique identifier */
  id: string;
  /** Channel this message belongs to */
  channelId: string;
  /** Author of the message */
  authorId: string;
  /** Message content (text, markdown, etc.) */
  content: string;
  /** Type of message */
  type: MessageContentType;
  /** Parent message ID for thread replies */
  parentId?: string;
  /** Additional metadata (attachments, mentions, etc.) */
  metadata?: MessageMetadata;
  /** When the message was created */
  createdAt: Date;
  /** When the message was last updated */
  updatedAt: Date;
  /** When the message was edited (if edited) */
  editedAt?: Date;
  /** When the message was deleted (soft delete) */
  deletedAt?: Date;
}

/**
 * Message metadata for additional context
 */
export interface MessageMetadata {
  /** File attachments */
  attachments?: MessageAttachment[];
  /** User mentions in the message */
  mentions?: string[];
  /** Channel mentions in the message */
  channelMentions?: string[];
  /** Code language (for CODE type messages) */
  codeLanguage?: string;
  /** Link previews */
  linkPreviews?: LinkPreview[];
  /** Custom application-specific metadata */
  custom?: Record<string, unknown>;
}

/**
 * File attachment in a message
 */
export interface MessageAttachment {
  /** Unique identifier */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** URL to download the file */
  url: string;
  /** Thumbnail URL (for images) */
  thumbnailUrl?: string;
  /** Width in pixels (for images/videos) */
  width?: number;
  /** Height in pixels (for images/videos) */
  height?: number;
}

/**
 * Link preview metadata
 */
export interface LinkPreview {
  /** Original URL */
  url: string;
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Preview image URL */
  imageUrl?: string;
  /** Site name */
  siteName?: string;
}

// =============================================================================
// MESSAGE WITH RELATIONS
// =============================================================================

/**
 * Message with author information
 */
export interface MessageWithAuthor extends Message {
  author: {
    id: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string;
    isVP: boolean;
  };
}

/**
 * Message with full relations
 */
export interface MessageWithRelations extends MessageWithAuthor {
  /** Reactions on this message */
  reactions: ReactionSummary[];
  /** Number of thread replies (if this is a parent message) */
  replyCount: number;
  /** Latest replies in the thread (preview) */
  latestReplies?: MessageWithAuthor[];
  /** Channel information */
  channel: {
    id: string;
    name: string;
    type: string;
  };
}

// =============================================================================
// REACTION TYPES
// =============================================================================

/**
 * Reaction entity
 */
export interface Reaction {
  /** Unique identifier */
  id: string;
  /** Message this reaction belongs to */
  messageId: string;
  /** User who added the reaction */
  userId: string;
  /** Emoji used for the reaction */
  emoji: string;
  /** When the reaction was added */
  createdAt: Date;
}

/**
 * Reaction summary for displaying on messages
 */
export interface ReactionSummary {
  /** Emoji */
  emoji: string;
  /** Total count of this reaction */
  count: number;
  /** Whether current user has reacted with this emoji */
  hasReacted: boolean;
  /** User IDs who reacted (limited preview) */
  userIds: string[];
}

/**
 * Reaction with user information
 */
export interface ReactionWithUser extends Reaction {
  user: {
    id: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

// =============================================================================
// THREAD TYPES
// =============================================================================

/**
 * Thread summary for a parent message
 */
export interface ThreadSummary {
  /** Parent message ID */
  parentId: string;
  /** Total number of replies */
  replyCount: number;
  /** Participants in the thread */
  participantIds: string[];
  /** When the last reply was sent */
  lastReplyAt?: Date;
  /** Preview of the last reply */
  lastReply?: MessageWithAuthor;
}

/**
 * Full thread with all replies
 */
export interface Thread {
  /** Parent message */
  parent: MessageWithAuthor;
  /** All replies in the thread */
  replies: MessageWithAuthor[];
  /** Total reply count */
  replyCount: number;
  /** Unique participants */
  participants: Array<{
    id: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for sending a new message
 */
export interface SendMessageInput {
  /** Channel to send the message to */
  channelId: string;
  /** Message content */
  content: string;
  /** Type of message (defaults to TEXT) */
  type?: MessageContentType;
  /** Parent message ID for thread replies */
  parentId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an existing message
 */
export interface UpdateMessageInput {
  /** Updated content */
  content: string;
  /** Updated metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Input for adding a reaction
 */
export interface AddReactionInput {
  /** Message to react to */
  messageId: string;
  /** Emoji to use */
  emoji: string;
}

/**
 * Input for removing a reaction
 */
export interface RemoveReactionInput {
  /** Message to remove reaction from */
  messageId: string;
  /** Emoji to remove */
  emoji: string;
}

/**
 * Input for creating a thread reply
 */
export interface CreateThreadReplyInput {
  /** Parent message ID */
  parentId: string;
  /** Reply content */
  content: string;
  /** Type of message (defaults to TEXT) */
  type?: MessageContentType;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// QUERY & FILTER TYPES
// =============================================================================

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Channel ID to list messages from */
  channelId: string;
  /** Maximum number of messages to return */
  limit?: number;
  /** Cursor for pagination (message ID to start before) */
  before?: string;
  /** Cursor for pagination (message ID to start after) */
  after?: string;
  /** Include deleted messages */
  includeDeleted?: boolean;
  /** Only return thread replies for this parent */
  parentId?: string;
}

/**
 * Options for searching messages
 */
export interface SearchMessagesOptions {
  /** Search query */
  query: string;
  /** Channels to search in (empty = all accessible) */
  channelIds?: string[];
  /** Author to filter by */
  authorId?: string;
  /** Filter by message type */
  type?: MessageContentType;
  /** Start date for search range */
  startDate?: Date;
  /** End date for search range */
  endDate?: Date;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// PAGINATION TYPES
// =============================================================================

/**
 * Page info for message cursor-based pagination
 */
export interface MessagePageInfo {
  /** Whether there are more items before */
  hasPreviousPage: boolean;
  /** Whether there are more items after */
  hasNextPage: boolean;
  /** Cursor of the first item */
  startCursor?: string;
  /** Cursor of the last item */
  endCursor?: string;
}

/**
 * Message edge for cursor-based pagination
 */
export interface MessageEdge {
  /** Cursor for this message */
  cursor: string;
  /** The message */
  node: MessageWithRelations;
}

/**
 * Paginated message connection
 */
export interface MessageConnection {
  /** Message edges */
  edges: MessageEdge[];
  /** Pagination info */
  pageInfo: MessagePageInfo;
  /** Total count of messages (may be approximate for performance) */
  totalCount: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Message event types for real-time updates
 */
export const MessageEventType = {
  /** New message created */
  Created: 'MESSAGE_CREATED',
  /** Message content updated */
  Updated: 'MESSAGE_UPDATED',
  /** Message deleted */
  Deleted: 'MESSAGE_DELETED',
  /** Reaction added */
  ReactionAdded: 'MESSAGE_REACTION_ADDED',
  /** Reaction removed */
  ReactionRemoved: 'MESSAGE_REACTION_REMOVED',
  /** Thread reply added */
  ThreadReplyAdded: 'MESSAGE_THREAD_REPLY_ADDED',
  /** User started typing */
  TypingStarted: 'MESSAGE_TYPING_STARTED',
  /** User stopped typing */
  TypingStopped: 'MESSAGE_TYPING_STOPPED',
} as const;

export type MessageEventType =
  (typeof MessageEventType)[keyof typeof MessageEventType];

/**
 * Message event structure
 */
export interface MessageEvent {
  /** Event type */
  type: MessageEventType;
  /** Channel ID */
  channelId: string;
  /** Message ID (if applicable) */
  messageId?: string;
  /** User who triggered the event */
  userId?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event payload */
  payload: {
    /** The message (for created/updated events) */
    message?: MessageWithRelations;
    /** Reaction info (for reaction events) */
    reaction?: Reaction;
    /** Previous content (for update events) */
    previousContent?: string;
  };
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Message-specific error codes
 */
export const MessageErrorCode = {
  /** Message not found */
  NotFound: 'MESSAGE_NOT_FOUND',
  /** User not authorized to access message */
  Unauthorized: 'MESSAGE_UNAUTHORIZED',
  /** User not authorized to modify message */
  Forbidden: 'MESSAGE_FORBIDDEN',
  /** Message content is invalid */
  InvalidContent: 'MESSAGE_INVALID_CONTENT',
  /** Message content exceeds maximum length */
  ContentTooLong: 'MESSAGE_CONTENT_TOO_LONG',
  /** Cannot edit a deleted message */
  Deleted: 'MESSAGE_DELETED',
  /** Channel not found */
  ChannelNotFound: 'MESSAGE_CHANNEL_NOT_FOUND',
  /** Not a channel member */
  NotChannelMember: 'MESSAGE_NOT_CHANNEL_MEMBER',
  /** Rate limit exceeded */
  RateLimited: 'MESSAGE_RATE_LIMITED',
  /** Duplicate reaction */
  DuplicateReaction: 'MESSAGE_DUPLICATE_REACTION',
  /** Reaction not found */
  ReactionNotFound: 'MESSAGE_REACTION_NOT_FOUND',
  /** Parent message not found (for threads) */
  ParentNotFound: 'MESSAGE_PARENT_NOT_FOUND',
  /** Cannot reply to a reply (nested threads not supported) */
  NestedThreadNotAllowed: 'MESSAGE_NESTED_THREAD_NOT_ALLOWED',
} as const;

export type MessageErrorCode =
  (typeof MessageErrorCode)[keyof typeof MessageErrorCode];

/**
 * Message error structure
 */
export interface MessageError {
  /** Error code */
  code: MessageErrorCode;
  /** Human-readable message */
  message: string;
  /** Field that caused the error (for validation) */
  field?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/**
 * Maximum message content length
 */
export const MAX_MESSAGE_LENGTH = 10000;

/**
 * Maximum number of attachments per message
 */
export const MAX_ATTACHMENTS = 10;

/**
 * Maximum file size for attachments (in bytes) - 25MB
 */
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/**
 * Maximum number of reactions per message
 */
export const MAX_REACTIONS_PER_MESSAGE = 50;

/**
 * Maximum number of unique emojis per message
 */
export const MAX_UNIQUE_EMOJIS = 20;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if content length is valid
 */
export function isValidMessageContent(content: string): boolean {
  return content.length > 0 && content.length <= MAX_MESSAGE_LENGTH;
}

/**
 * Check if a message is a thread reply
 */
export function isThreadReply(message: Message): boolean {
  return !!message.parentId;
}

/**
 * Check if a message has been edited
 */
export function isEdited(message: Message): boolean {
  return !!message.editedAt;
}

/**
 * Check if a message has been deleted
 */
export function isDeleted(message: Message): boolean {
  return !!message.deletedAt;
}

/**
 * Type guard for MessageContentType
 */
export function isMessageContentType(value: string): value is MessageContentType {
  return Object.values(MessageContentType).includes(value as MessageContentType);
}
