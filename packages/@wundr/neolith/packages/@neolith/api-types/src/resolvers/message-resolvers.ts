/**
 * Message GraphQL Resolvers
 *
 * Comprehensive resolvers for messaging operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks (channel membership),
 * input validation, cursor-based pagination, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/message-resolvers
 */

import { GraphQLError } from 'graphql';

import type {
  PrismaClient,
  message as PrismaMessage,
  MessageType as PrismaMessageType,
  Prisma,
} from '@prisma/client';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Message type enum matching the Prisma schema
 * Note: Prisma schema has TEXT, FILE, SYSTEM, COMMAND
 */
export const MessageType = {
  Text: 'TEXT',
  System: 'SYSTEM',
  File: 'FILE',
  Command: 'COMMAND',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Channel member role for authorization
 */
type ChannelMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional message service for business logic */
  messageService?: MessageService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Message Service interface for business logic operations
 */
export interface MessageService {
  /** Parse mentions from message content */
  parseMentions(content: string): Promise<string[]>;
  /** Extract metadata from content (links, embeds) */
  extractMetadata(content: string): Promise<Record<string, unknown>>;
  /** Process message content (sanitize, format) */
  processContent(content: string): Promise<string>;
}

/**
 * Message entity type for resolvers (matches Prisma schema)
 * Note: Prisma uses parentId, isEdited boolean, editedAt timestamp
 */
interface Message {
  id: string;
  content: string;
  type: PrismaMessageType;
  channelId: string;
  userId: string;
  parentId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reaction entity type
 */
interface Reaction {
  emoji: string;
  users: Array<{ id: string; displayName: string | null }>;
  count: number;
}

/**
 * Channel member check result
 */
interface ChannelMemberInfo {
  isMember: boolean;
  role: ChannelMemberRole | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for sending a new message
 */
interface SendMessageInput {
  content: string;
  channelId: string;
  threadId?: string | null;
  attachmentIds?: string[] | null;
}

/**
 * Input for creating a message (full options)
 */
interface CreateMessageInput {
  content: string;
  type?: MessageTypeValue | null;
  channelId: string;
  parentMessageId?: string | null;
  attachmentIds?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for updating a message
 */
interface UpdateMessageInput {
  content: string;
}

/**
 * Input for adding a reaction
 */
interface AddReactionInput {
  messageId: string;
  emoji: string;
}

/**
 * Input for removing a reaction
 */
interface RemoveReactionInput {
  messageId: string;
  emoji: string;
}

/**
 * Search filter input
 */
interface SearchFiltersInput {
  channelIds?: string[] | null;
  authorIds?: string[] | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  hasAttachments?: boolean | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface MessageQueryArgs {
  id: string;
}

interface MessagesQueryArgs {
  channelId: string;
  cursor?: string | null;
  limit?: number | null;
  before?: string | null;
}

interface ThreadMessagesQueryArgs {
  parentMessageId: string;
  cursor?: string | null;
  limit?: number | null;
}

interface SearchMessagesArgs {
  workspaceId: string;
  query: string;
  filters?: SearchFiltersInput | null;
  limit?: number | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface SendMessageArgs {
  input: SendMessageInput;
}

interface CreateMessageArgs {
  input: CreateMessageInput;
}

interface EditMessageArgs {
  id: string;
  input: UpdateMessageInput;
}

interface DeleteMessageArgs {
  id: string;
}

interface AddReactionArgs {
  input: AddReactionInput;
}

interface RemoveReactionArgs {
  input: RemoveReactionInput;
}

interface PinMessageArgs {
  id: string;
}

interface UnpinMessageArgs {
  id: string;
}

interface MarkAsReadArgs {
  channelId: string;
  messageId: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface MessageCreatedArgs {
  channelId: string;
}

interface MessageUpdatedArgs {
  channelId: string;
}

interface MessageDeletedArgs {
  channelId: string;
}

interface ReactionChangedArgs {
  channelId: string;
}

interface ThreadUpdatedArgs {
  parentMessageId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface MessagePayload {
  message: Message | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface ReactionPayload {
  message: Message | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for new messages */
export const MESSAGE_CREATED = 'MESSAGE_CREATED';

/** Event name for updated messages */
export const MESSAGE_UPDATED = 'MESSAGE_UPDATED';

/** Event name for deleted messages */
export const MESSAGE_DELETED = 'MESSAGE_DELETED';

/** Event name for reaction changes */
export const REACTION_CHANGED = 'REACTION_CHANGED';

/** Event name for thread updates */
export const THREAD_UPDATED = 'THREAD_UPDATED';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 *
 * @param context - The GraphQL context
 * @returns True if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Type guard to check if user has admin role
 *
 * @param context - The GraphQL context
 * @returns True if user is an admin
 */
function isAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user is a member of a channel
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to check
 * @returns Channel member info
 */
async function getChannelMemberInfo(
  context: GraphQLContext,
  channelId: string
): Promise<ChannelMemberInfo> {
  if (!isAuthenticated(context)) {
    return { isMember: false, role: null };
  }

  const membership = await context.prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId: context.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    // Check if admin can access any channel
    if (isAdmin(context)) {
      return { isMember: true, role: 'ADMIN' };
    }
    return { isMember: false, role: null };
  }

  return { isMember: true, role: membership.role as ChannelMemberRole };
}

/**
 * Check if user can access a channel (is member or admin)
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to check
 * @returns True if user can access the channel
 */
async function canAccessChannel(
  context: GraphQLContext,
  channelId: string
): Promise<boolean> {
  const memberInfo = await getChannelMemberInfo(context, channelId);
  return memberInfo.isMember;
}

/**
 * Check if user can modify a message (is author or admin)
 *
 * @param context - The GraphQL context
 * @param message - The message to check
 * @returns True if user can modify the message
 */
function canModifyMessage(context: GraphQLContext, message: Message): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // Admins can modify any message
  if (isAdmin(context)) {
    return true;
  }
  // Authors can modify their own messages
  return message.userId === context.user.id;
}

/**
 * Check if user can delete a message (is author, channel admin, or system admin)
 *
 * @param context - The GraphQL context
 * @param message - The message to check
 * @param channelMemberRole - User's role in the channel
 * @returns True if user can delete the message
 */
function canDeleteMessage(
  context: GraphQLContext,
  message: Message,
  channelMemberRole: ChannelMemberRole | null
): boolean {
  if (!isAuthenticated(context)) {
    return false;
  }
  // System admins can delete any message
  if (isAdmin(context)) {
    return true;
  }
  // Authors can delete their own messages
  if (message.userId === context.user.id) {
    return true;
  }
  // Channel admins/owners can delete messages in their channel
  return channelMemberRole === 'OWNER' || channelMemberRole === 'ADMIN';
}

/**
 * Rate limit configuration: max messages per time window
 */
const RATE_LIMIT_MAX_MESSAGES = 10;

/**
 * Rate limit time window in seconds
 */
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * In-memory rate limit store (in production, use Redis)
 * Key format: "ratelimit:message:{userId}:{channelId}"
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit check result
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Seconds until rate limit resets (if not allowed) */
  retryAfterSeconds?: number;
  /** Current count of messages in window */
  currentCount: number;
  /** Maximum allowed messages in window */
  maxCount: number;
}

/**
 * Checks if a user has exceeded the message rate limit.
 * Uses a sliding window approach with in-memory storage.
 * In production, this should use Redis for distributed rate limiting.
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID
 * @returns Rate limit check result
 */
async function checkMessageRateLimit(
  context: GraphQLContext,
  channelId: string
): Promise<RateLimitResult> {
  if (!isAuthenticated(context)) {
    return {
      allowed: false,
      retryAfterSeconds: 0,
      currentCount: 0,
      maxCount: RATE_LIMIT_MAX_MESSAGES,
    };
  }

  const userId = context.user.id;
  const key = `ratelimit:message:${userId}:${channelId}`;
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  // Check if window has expired
  if (!entry || now > entry.resetAt) {
    // Start new window
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      currentCount: 1,
      maxCount: RATE_LIMIT_MAX_MESSAGES,
    };
  }

  // Check if under limit
  if (entry.count < RATE_LIMIT_MAX_MESSAGES) {
    entry.count++;
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      currentCount: entry.count,
      maxCount: RATE_LIMIT_MAX_MESSAGES,
    };
  }

  // Rate limited
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: false,
    retryAfterSeconds,
    currentCount: entry.count,
    maxCount: RATE_LIMIT_MAX_MESSAGES,
  };
}

/**
 * Default maximum message length (characters)
 */
const DEFAULT_MAX_MESSAGE_LENGTH = 10000;

/**
 * Maximum message length upper bound (characters) - cannot be exceeded even with config
 */
const MAX_MESSAGE_LENGTH_UPPER_BOUND = 50000;

/**
 * Gets the maximum message length for a workspace.
 * Falls back to default if workspace config is not available.
 *
 * @param context - The GraphQL context
 * @param channelId - The channel ID to get workspace config from
 * @returns Maximum message length in characters
 */
async function getMaxMessageLength(
  context: GraphQLContext,
  channelId?: string
): Promise<number> {
  if (!channelId) {
    return DEFAULT_MAX_MESSAGE_LENGTH;
  }

  try {
    // Get channel to find workspace
    const channel = await context.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        workspace: {
          select: {
            settings: true,
          },
        },
      },
    });

    if (!channel?.workspace?.settings) {
      return DEFAULT_MAX_MESSAGE_LENGTH;
    }

    const settings = channel.workspace.settings as Record<string, unknown>;
    const configuredLength = settings.maxMessageLength;

    if (typeof configuredLength === 'number' && configuredLength > 0) {
      // Ensure configured length doesn't exceed upper bound
      return Math.min(configuredLength, MAX_MESSAGE_LENGTH_UPPER_BOUND);
    }
  } catch {
    // Fall back to default on error
  }

  return DEFAULT_MAX_MESSAGE_LENGTH;
}

/**
 * Validate message content
 *
 * @param content - The content to validate
 * @param maxLength - Maximum allowed message length
 * @throws GraphQLError if content is invalid
 */
function validateMessageContent(
  content: string,
  maxLength: number = DEFAULT_MAX_MESSAGE_LENGTH
): void {
  if (!content || content.trim().length === 0) {
    throw new GraphQLError('Message content is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'content' },
    });
  }
  if (content.length > maxLength) {
    throw new GraphQLError(
      `Message content must be ${maxLength} characters or less`,
      {
        extensions: { code: 'BAD_USER_INPUT', field: 'content' },
      }
    );
  }
}

/**
 * Validate emoji for reactions
 *
 * @param emoji - The emoji to validate
 * @throws GraphQLError if emoji is invalid
 */
function validateEmoji(emoji: string): void {
  if (!emoji || emoji.trim().length === 0) {
    throw new GraphQLError('Emoji is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'emoji' },
    });
  }
  // Basic emoji validation - allow unicode emojis and shortcodes
  const MAX_EMOJI_LENGTH = 50;
  if (emoji.length > MAX_EMOJI_LENGTH) {
    throw new GraphQLError(
      `Emoji must be ${MAX_EMOJI_LENGTH} characters or less`,
      {
        extensions: { code: 'BAD_USER_INPUT', field: 'emoji' },
      }
    );
  }
}

/**
 * Generate cursor from message for pagination
 *
 * @param message - The message to generate cursor for
 * @returns Base64 encoded cursor
 */
function generateCursor(message: Message): string {
  return Buffer.from(
    `${message.createdAt.toISOString()}:${message.id}`
  ).toString('base64');
}

/**
 * Parse cursor to get timestamp and ID
 *
 * @param cursor - Base64 encoded cursor
 * @returns Parsed cursor data or null if invalid
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Create success payload
 */
function createSuccessPayload(message: Message): MessagePayload {
  return { message, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): MessagePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { message: null, errors };
}

/**
 * Convert Prisma message to resolver message type
 * Maps parentId from Prisma schema to our Message interface
 */
function toMessage(prismaMessage: PrismaMessage): Message {
  return {
    id: prismaMessage.id,
    content: prismaMessage.content,
    type: prismaMessage.type,
    channelId: prismaMessage.channelId,
    userId: prismaMessage.authorId,
    parentId: prismaMessage.parentId,
    isEdited: prismaMessage.isEdited,
    isDeleted: prismaMessage.isDeleted,
    editedAt: prismaMessage.editedAt,
    metadata: prismaMessage.metadata,
    createdAt: prismaMessage.createdAt,
    updatedAt: prismaMessage.updatedAt,
  };
}

/**
 * Check if message is pinned by looking at metadata
 * Note: Prisma schema does not have isPinned field, using metadata.pinned instead
 */
function isPinned(message: Message): boolean {
  const metadata = message.metadata as Record<string, unknown> | null;
  return metadata?.pinned === true;
}

// =============================================================================
// MESSAGE QUERY RESOLVERS
// =============================================================================

/**
 * Message Query resolvers
 */
export const messageQueries = {
  /**
   * Get a message by its ID
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments containing message ID
   * @param context - GraphQL context
   * @returns The message or null if not found
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   message(id: "msg_123") {
   *     id
   *     content
   *     author { displayName }
   *   }
   * }
   * ```
   */
  message: async (
    _parent: unknown,
    args: MessageQueryArgs,
    context: GraphQLContext
  ): Promise<Message | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const message = await context.prisma.message.findUnique({
      where: { id: args.id },
    });

    if (!message) {
      return null;
    }

    // Soft delete check - don't return deleted messages
    if (message.isDeleted) {
      return null;
    }

    // Check channel access
    const hasAccess = await canAccessChannel(context, message.channelId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return toMessage(message);
  },

  /**
   * Get messages in a channel with cursor-based pagination
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with channelId, cursor, limit, before
   * @param context - GraphQL context
   * @returns Paginated list of messages
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   messages(channelId: "ch_123", limit: 50) {
   *     edges {
   *       node {
   *         id
   *         content
   *         createdAt
   *       }
   *       cursor
   *     }
   *     pageInfo {
   *       hasNextPage
   *       hasPreviousPage
   *     }
   *   }
   * }
   * ```
   */
  messages: async (
    _parent: unknown,
    args: MessagesQueryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId, cursor, before } = args;
    // Rate limiting consideration: Cap max limit to prevent abuse
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    // Check channel access
    const hasAccess = await canAccessChannel(context, channelId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause - exclude soft-deleted messages
    // Use parentId (not parentMessageId) as per Prisma schema
    const where: Prisma.messageWhereInput = {
      channelId,
      isDeleted: false,
      parentId: null, // Only top-level messages, not thread replies
    };

    // Handle cursor-based pagination (forward)
    if (cursor) {
      const parsed = parseCursor(cursor);
      if (parsed) {
        where.OR = [
          { createdAt: { lt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { lt: parsed.id } },
        ];
      }
    }

    // Handle reverse pagination (before cursor)
    if (before) {
      const parsed = parseCursor(before);
      if (parsed) {
        where.OR = [
          { createdAt: { gt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { gt: parsed.id } },
        ];
      }
    }

    // Fetch messages with extra record for hasNextPage
    const messages = await context.prisma.message.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // Get total count for the channel
    const totalCount = await context.prisma.message.count({
      where: { channelId, isDeleted: false, parentId: null },
    });

    const hasNextPage = messages.length > limit;
    const nodes = hasNextPage ? messages.slice(0, -1) : messages;

    const edges = nodes.map((msg: PrismaMessage) => {
      const messageData = toMessage(msg);
      return {
        node: messageData,
        cursor: generateCursor(messageData),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!cursor || !!before,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get thread replies for a parent message
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with parentMessageId, cursor, limit
   * @param context - GraphQL context
   * @returns Paginated list of thread replies
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * query {
   *   threadMessages(parentMessageId: "msg_123", limit: 20) {
   *     edges {
   *       node {
   *         id
   *         content
   *         author { displayName }
   *       }
   *     }
   *     totalCount
   *   }
   * }
   * ```
   */
  threadMessages: async (
    _parent: unknown,
    args: ThreadMessagesQueryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { parentMessageId, cursor } = args;
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    // Fetch parent message to get channel ID
    const parentMessage = await context.prisma.message.findUnique({
      where: { id: parentMessageId },
      select: { channelId: true, isDeleted: true },
    });

    if (!parentMessage || parentMessage.isDeleted) {
      throw new GraphQLError('Parent message not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Check channel access
    const hasAccess = await canAccessChannel(context, parentMessage.channelId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause - use parentId as per Prisma schema
    const where: Prisma.messageWhereInput = {
      parentId: parentMessageId,
      isDeleted: false,
    };

    // Handle cursor pagination
    if (cursor) {
      const parsed = parseCursor(cursor);
      if (parsed) {
        where.OR = [
          { createdAt: { gt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { gt: parsed.id } },
        ];
      }
    }

    // Thread replies are ordered chronologically (oldest first)
    const messages = await context.prisma.message.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const totalCount = await context.prisma.message.count({
      where: { parentId: parentMessageId, isDeleted: false },
    });

    const hasNextPage = messages.length > limit;
    const nodes = hasNextPage ? messages.slice(0, -1) : messages;

    const edges = nodes.map((msg: PrismaMessage) => {
      const messageData = toMessage(msg);
      return {
        node: messageData,
        cursor: generateCursor(messageData),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!cursor,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Search messages across a workspace
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Query arguments with workspaceId, query, filters, limit
   * @param context - GraphQL context
   * @returns Search results with messages
   * @throws GraphQLError if not authenticated
   *
   * @example
   * ```graphql
   * query {
   *   search(workspaceId: "ws_123", query: "hello", types: ["messages"]) {
   *     messages {
   *       id
   *       content
   *       channel { name }
   *     }
   *   }
   * }
   * ```
   */
  search: async (
    _parent: unknown,
    args: SearchMessagesArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, query, filters } = args;
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    // Get channels user has access to in this workspace
    const accessibleChannels = await context.prisma.channelMember.findMany({
      where: {
        userId: context.user.id,
        channel: { workspaceId },
      },
      select: { channelId: true },
    });

    const accessibleChannelIds = accessibleChannels.map(
      (cm: { channelId: string }) => cm.channelId
    );

    // Build search query
    const where: Prisma.messageWhereInput = {
      channelId: { in: accessibleChannelIds },
      isDeleted: false,
      content: { contains: query, mode: 'insensitive' },
    };

    // Apply filters
    if (filters?.channelIds && filters.channelIds.length > 0) {
      // Intersect with accessible channels
      const filteredChannels = filters.channelIds.filter(id =>
        accessibleChannelIds.includes(id)
      );
      where.channelId = { in: filteredChannels };
    }

    if (filters?.authorIds && filters.authorIds.length > 0) {
      where.authorId = { in: filters.authorIds };
    }

    if (filters?.dateFrom) {
      where.createdAt = {
        ...(where.createdAt as object),
        gte: filters.dateFrom,
      };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...(where.createdAt as object), lte: filters.dateTo };
    }

    // Search messages
    const messages = await context.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      messages: messages.map(toMessage),
      channels: [], // Can be extended to search channels
      users: [], // Can be extended to search users
      files: [], // Can be extended to search files
    };
  },
};

// =============================================================================
// MESSAGE MUTATION RESOLVERS
// =============================================================================

/**
 * Message Mutation resolvers
 */
export const messageMutations = {
  /**
   * Send a new message (simplified interface)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with SendMessageInput
   * @param context - GraphQL context
   * @returns Message payload with created message or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   sendMessage(input: {
   *     content: "Hello, world!",
   *     channelId: "ch_123"
   *   }) {
   *     message {
   *       id
   *       content
   *       createdAt
   *     }
   *     errors { code message }
   *   }
   * }
   * ```
   */
  sendMessage: async (
    _parent: unknown,
    args: SendMessageArgs,
    context: GraphQLContext
  ): Promise<MessagePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate content with configurable max length
    const maxMessageLength = await getMaxMessageLength(
      context,
      input.channelId
    );
    try {
      validateMessageContent(input.content, maxMessageLength);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    // Check channel access
    const memberInfo = await getChannelMemberInfo(context, input.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError(
        'You must be a member of this channel to send messages',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // If threadId is provided, verify parent message exists and is in the same channel
    let parentId: string | null = null;
    if (input.threadId) {
      const parentMessage = await context.prisma.message.findUnique({
        where: { id: input.threadId },
        select: { channelId: true, isDeleted: true },
      });

      if (!parentMessage || parentMessage.isDeleted) {
        return createErrorPayload(
          'NOT_FOUND',
          'Thread parent message not found'
        );
      }

      if (parentMessage.channelId !== input.channelId) {
        return createErrorPayload(
          'BAD_USER_INPUT',
          'Thread parent must be in the same channel'
        );
      }

      parentId = input.threadId;
    }

    // Process content if message service is available
    let processedContent = input.content;
    let metadata: Prisma.InputJsonValue = {};

    if (context.messageService) {
      processedContent = await context.messageService.processContent(
        input.content
      );
      const extractedMetadata =
        await context.messageService.extractMetadata(processedContent);
      metadata = extractedMetadata as Prisma.InputJsonValue;
    }

    // Rate limiting: Check if user has exceeded message rate limit
    const rateLimitResult = await checkMessageRateLimit(
      context,
      input.channelId
    );
    if (!rateLimitResult.allowed) {
      return createErrorPayload(
        'RATE_LIMITED',
        `You're sending messages too quickly. Please wait ${rateLimitResult.retryAfterSeconds} seconds.`
      );
    }

    // Create the message - use parentId as per Prisma schema
    const message = await context.prisma.message.create({
      data: {
        content: processedContent,
        type: 'TEXT',
        channelId: input.channelId,
        authorId: context.user.id,
        parentId,
        isEdited: false,
        isDeleted: false,
        metadata,
      },
    });

    const messageData = toMessage(message);

    // Publish message created event
    await context.pubsub.publish(`${MESSAGE_CREATED}_${input.channelId}`, {
      messageCreated: messageData,
    });

    // If this is a thread reply, also publish thread update
    if (parentId) {
      await context.pubsub.publish(`${THREAD_UPDATED}_${parentId}`, {
        threadUpdated: messageData,
      });
    }

    return createSuccessPayload(messageData);
  },

  /**
   * Create a new message (full options)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with CreateMessageInput
   * @param context - GraphQL context
   * @returns Message payload with created message or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   createMessage(input: {
   *     content: "System notification",
   *     type: SYSTEM,
   *     channelId: "ch_123",
   *     metadata: { source: "bot" }
   *   }) {
   *     message {
   *       id
   *       type
   *       content
   *     }
   *   }
   * }
   * ```
   */
  createMessage: async (
    _parent: unknown,
    args: CreateMessageArgs,
    context: GraphQLContext
  ): Promise<MessagePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate content with configurable max length
    const maxMessageLength = await getMaxMessageLength(
      context,
      input.channelId
    );
    try {
      validateMessageContent(input.content, maxMessageLength);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    // Check channel access
    const memberInfo = await getChannelMemberInfo(context, input.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError(
        'You must be a member of this channel to send messages',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Validate parent message if provided
    if (input.parentMessageId) {
      const parentMessage = await context.prisma.message.findUnique({
        where: { id: input.parentMessageId },
        select: { channelId: true, isDeleted: true },
      });

      if (!parentMessage || parentMessage.isDeleted) {
        return createErrorPayload('NOT_FOUND', 'Parent message not found');
      }

      if (parentMessage.channelId !== input.channelId) {
        return createErrorPayload(
          'BAD_USER_INPUT',
          'Parent message must be in the same channel'
        );
      }
    }

    // Determine message type - Prisma schema has TEXT, FILE, SYSTEM, COMMAND
    const messageType: PrismaMessageType =
      (input.type as PrismaMessageType) ?? 'TEXT';

    // Create the message - use parentId as per Prisma schema
    const message = await context.prisma.message.create({
      data: {
        content: input.content,
        type: messageType,
        channelId: input.channelId,
        authorId: context.user.id,
        parentId: input.parentMessageId ?? null,
        isEdited: false,
        isDeleted: false,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const messageData = toMessage(message);

    // Publish events
    await context.pubsub.publish(`${MESSAGE_CREATED}_${input.channelId}`, {
      messageCreated: messageData,
    });

    if (input.parentMessageId) {
      await context.pubsub.publish(
        `${THREAD_UPDATED}_${input.parentMessageId}`,
        {
          threadUpdated: messageData,
        }
      );
    }

    return createSuccessPayload(messageData);
  },

  /**
   * Edit an existing message
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with message ID and UpdateMessageInput
   * @param context - GraphQL context
   * @returns Message payload with updated message or errors
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   editMessage(id: "msg_123", input: { content: "Updated content" }) {
   *     message {
   *       id
   *       content
   *       isEdited
   *       editedAt
   *     }
   *   }
   * }
   * ```
   */
  editMessage: async (
    _parent: unknown,
    args: EditMessageArgs,
    context: GraphQLContext
  ): Promise<MessagePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Validate content
    try {
      validateMessageContent(input.content);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    // Fetch existing message
    const existingMessage = await context.prisma.message.findUnique({
      where: { id },
    });

    if (!existingMessage || existingMessage.isDeleted) {
      return createErrorPayload('NOT_FOUND', 'Message not found');
    }

    const existingMessageData = toMessage(existingMessage);

    // Check modification permissions
    if (!canModifyMessage(context, existingMessageData)) {
      throw new GraphQLError('You can only edit your own messages', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Update the message - set isEdited and editedAt as per Prisma schema
    const message = await context.prisma.message.update({
      where: { id },
      data: {
        content: input.content,
        isEdited: true,
        editedAt: new Date(),
      },
    });

    const messageData = toMessage(message);

    // Publish message updated event
    await context.pubsub.publish(`${MESSAGE_UPDATED}_${message.channelId}`, {
      messageUpdated: messageData,
    });

    return createSuccessPayload(messageData);
  },

  /**
   * Delete a message (soft delete)
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with message ID
   * @param context - GraphQL context
   * @returns Delete payload with success status
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   deleteMessage(id: "msg_123") {
   *     success
   *     deletedId
   *     errors { code message }
   *   }
   * }
   * ```
   */
  deleteMessage: async (
    _parent: unknown,
    args: DeleteMessageArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const message = await context.prisma.message.findUnique({
      where: { id: args.id },
    });

    if (!message) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Message not found' }],
      };
    }

    // Already deleted
    if (message.isDeleted) {
      return {
        success: true,
        deletedId: args.id,
        errors: [],
      };
    }

    const messageData = toMessage(message);

    // Get channel member info for permission check
    const memberInfo = await getChannelMemberInfo(context, message.channelId);

    // Check deletion permissions
    if (!canDeleteMessage(context, messageData, memberInfo.role)) {
      throw new GraphQLError(
        'You do not have permission to delete this message',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Soft delete - preserve the record but mark as deleted
    await context.prisma.message.update({
      where: { id: args.id },
      data: {
        isDeleted: true,
        content: '[Message deleted]', // Optionally clear content
      },
    });

    // Publish message deleted event
    await context.pubsub.publish(`${MESSAGE_DELETED}_${message.channelId}`, {
      messageDeleted: args.id,
    });

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Add a reaction to a message
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with AddReactionInput
   * @param context - GraphQL context
   * @returns Reaction payload with updated message
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   addReaction(input: { messageId: "msg_123", emoji: "thumbsup" }) {
   *     message {
   *       id
   *       reactions {
   *         emoji
   *         count
   *       }
   *     }
   *   }
   * }
   * ```
   */
  addReaction: async (
    _parent: unknown,
    args: AddReactionArgs,
    context: GraphQLContext
  ): Promise<ReactionPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate emoji
    try {
      validateEmoji(input.emoji);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return {
          message: null,
          errors: [
            { code: error.extensions?.code as string, message: error.message },
          ],
        };
      }
      throw error;
    }

    // Fetch the message
    const message = await context.prisma.message.findUnique({
      where: { id: input.messageId },
    });

    if (!message || message.isDeleted) {
      return {
        message: null,
        errors: [{ code: 'NOT_FOUND', message: 'Message not found' }],
      };
    }

    // Check channel access
    const hasAccess = await canAccessChannel(context, message.channelId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if reaction already exists
    const existingReaction = await context.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: input.messageId,
          userId: context.user.id,
          emoji: input.emoji,
        },
      },
    });

    if (existingReaction) {
      // Already reacted with this emoji - return current state
      return { message: toMessage(message), errors: [] };
    }

    // Add the reaction
    await context.prisma.reaction.create({
      data: {
        messageId: input.messageId,
        userId: context.user.id,
        emoji: input.emoji,
      },
    });

    const messageData = toMessage(message);

    // Publish reaction changed event
    await context.pubsub.publish(`${REACTION_CHANGED}_${message.channelId}`, {
      reactionChanged: messageData,
    });

    return { message: messageData, errors: [] };
  },

  /**
   * Remove a reaction from a message
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with RemoveReactionInput
   * @param context - GraphQL context
   * @returns Reaction payload with updated message
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   removeReaction(input: { messageId: "msg_123", emoji: "thumbsup" }) {
   *     message {
   *       id
   *       reactions {
   *         emoji
   *         count
   *       }
   *     }
   *   }
   * }
   * ```
   */
  removeReaction: async (
    _parent: unknown,
    args: RemoveReactionArgs,
    context: GraphQLContext
  ): Promise<ReactionPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Fetch the message
    const message = await context.prisma.message.findUnique({
      where: { id: input.messageId },
    });

    if (!message || message.isDeleted) {
      return {
        message: null,
        errors: [{ code: 'NOT_FOUND', message: 'Message not found' }],
      };
    }

    // Check channel access
    const hasAccess = await canAccessChannel(context, message.channelId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Remove the reaction (only user's own reaction)
    await context.prisma.reaction.deleteMany({
      where: {
        messageId: input.messageId,
        userId: context.user.id,
        emoji: input.emoji,
      },
    });

    const messageData = toMessage(message);

    // Publish reaction changed event
    await context.pubsub.publish(`${REACTION_CHANGED}_${message.channelId}`, {
      reactionChanged: messageData,
    });

    return { message: messageData, errors: [] };
  },

  /**
   * Pin a message to a channel
   * Note: Uses metadata.pinned since Prisma schema does not have isPinned field
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with message ID
   * @param context - GraphQL context
   * @returns Message payload with pinned message
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   pinMessage(id: "msg_123") {
   *     message {
   *       id
   *       isPinned
   *     }
   *   }
   * }
   * ```
   */
  pinMessage: async (
    _parent: unknown,
    args: PinMessageArgs,
    context: GraphQLContext
  ): Promise<MessagePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const message = await context.prisma.message.findUnique({
      where: { id: args.id },
    });

    if (!message || message.isDeleted) {
      return createErrorPayload('NOT_FOUND', 'Message not found');
    }

    // Check channel admin/owner permission
    const memberInfo = await getChannelMemberInfo(context, message.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Only channel admins/owners or system admins can pin messages
    const canPin =
      isAdmin(context) ||
      memberInfo.role === 'OWNER' ||
      memberInfo.role === 'ADMIN';

    if (!canPin) {
      throw new GraphQLError('You must be a channel admin to pin messages', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const messageData = toMessage(message);

    // Already pinned - check via metadata
    if (isPinned(messageData)) {
      return createSuccessPayload(messageData);
    }

    // Pin the message by setting metadata.pinned
    const existingMetadata =
      (message.metadata as Record<string, unknown>) ?? {};
    const updatedMessage = await context.prisma.message.update({
      where: { id: args.id },
      data: {
        metadata: {
          ...existingMetadata,
          pinned: true,
          pinnedAt: new Date().toISOString(),
        },
      },
    });

    const updatedMessageData = toMessage(updatedMessage);

    // Publish message updated event
    await context.pubsub.publish(`${MESSAGE_UPDATED}_${message.channelId}`, {
      messageUpdated: updatedMessageData,
    });

    return createSuccessPayload(updatedMessageData);
  },

  /**
   * Unpin a message from a channel
   * Note: Uses metadata.pinned since Prisma schema does not have isPinned field
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with message ID
   * @param context - GraphQL context
   * @returns Message payload with unpinned message
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   unpinMessage(id: "msg_123") {
   *     message {
   *       id
   *       isPinned
   *     }
   *   }
   * }
   * ```
   */
  unpinMessage: async (
    _parent: unknown,
    args: UnpinMessageArgs,
    context: GraphQLContext
  ): Promise<MessagePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const message = await context.prisma.message.findUnique({
      where: { id: args.id },
    });

    if (!message || message.isDeleted) {
      return createErrorPayload('NOT_FOUND', 'Message not found');
    }

    // Check channel admin/owner permission
    const memberInfo = await getChannelMemberInfo(context, message.channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Only channel admins/owners or system admins can unpin messages
    const canUnpin =
      isAdmin(context) ||
      memberInfo.role === 'OWNER' ||
      memberInfo.role === 'ADMIN';

    if (!canUnpin) {
      throw new GraphQLError('You must be a channel admin to unpin messages', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const messageData = toMessage(message);

    // Already unpinned - check via metadata
    if (!isPinned(messageData)) {
      return createSuccessPayload(messageData);
    }

    // Unpin the message by removing metadata.pinned
    const existingMetadata =
      (message.metadata as Record<string, unknown>) ?? {};
    const {
      pinned: _pinned,
      pinnedAt: _pinnedAt,
      ...restMetadata
    } = existingMetadata;
    const updatedMessage = await context.prisma.message.update({
      where: { id: args.id },
      data: {
        metadata: restMetadata as Prisma.InputJsonValue,
      },
    });

    const updatedMessageData = toMessage(updatedMessage);

    // Publish message updated event
    await context.pubsub.publish(`${MESSAGE_UPDATED}_${message.channelId}`, {
      messageUpdated: updatedMessageData,
    });

    return createSuccessPayload(updatedMessageData);
  },

  /**
   * Mark messages as read up to a specific message
   *
   * @param _parent - Parent resolver result (unused)
   * @param args - Mutation arguments with channelId and messageId
   * @param context - GraphQL context
   * @returns Channel payload
   * @throws GraphQLError if not authenticated or access denied
   *
   * @example
   * ```graphql
   * mutation {
   *   markAsRead(channelId: "ch_123", messageId: "msg_456") {
   *     channel {
   *       id
   *       unreadCount
   *     }
   *   }
   * }
   * ```
   */
  markAsRead: async (
    _parent: unknown,
    args: MarkAsReadArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { channelId, messageId } = args;

    // Check channel membership
    const memberInfo = await getChannelMemberInfo(context, channelId);
    if (!memberInfo.isMember) {
      throw new GraphQLError('Access denied to this channel', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Verify message exists and is in the channel
    const message = await context.prisma.message.findUnique({
      where: { id: messageId },
      select: { channelId: true, createdAt: true },
    });

    if (!message || message.channelId !== channelId) {
      return {
        channel: null,
        errors: [
          { code: 'NOT_FOUND', message: 'Message not found in channel' },
        ],
      };
    }

    // Update the channel member's last read timestamp
    await context.prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId: context.user.id,
        },
      },
      data: {
        lastReadAt: message.createdAt,
      },
    });

    // Fetch updated channel
    const channel = await context.prisma.channel.findUnique({
      where: { id: channelId },
    });

    return {
      channel,
      errors: [],
    };
  },
};

// =============================================================================
// MESSAGE SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Message Subscription resolvers
 */
export const messageSubscriptions = {
  /**
   * Subscribe to new messages in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   messageCreated(channelId: "ch_123") {
   *     id
   *     content
   *     author { displayName }
   *   }
   * }
   * ```
   */
  messageCreated: {
    subscribe: async (
      _parent: unknown,
      args: MessageCreatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify channel access before subscribing
      const hasAccess = await canAccessChannel(context, args.channelId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${MESSAGE_CREATED}_${args.channelId}`
      );
    },
  },

  /**
   * Subscribe to message updates in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   messageUpdated(channelId: "ch_123") {
   *     id
   *     content
   *     isEdited
   *   }
   * }
   * ```
   */
  messageUpdated: {
    subscribe: async (
      _parent: unknown,
      args: MessageUpdatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const hasAccess = await canAccessChannel(context, args.channelId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${MESSAGE_UPDATED}_${args.channelId}`
      );
    },
  },

  /**
   * Subscribe to message deletions in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   messageDeleted(channelId: "ch_123")
   * }
   * ```
   */
  messageDeleted: {
    subscribe: async (
      _parent: unknown,
      args: MessageDeletedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const hasAccess = await canAccessChannel(context, args.channelId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${MESSAGE_DELETED}_${args.channelId}`
      );
    },
  },

  /**
   * Subscribe to reaction changes on messages in a channel
   *
   * @example
   * ```graphql
   * subscription {
   *   reactionChanged(channelId: "ch_123") {
   *     id
   *     reactions {
   *       emoji
   *       count
   *     }
   *   }
   * }
   * ```
   */
  reactionChanged: {
    subscribe: async (
      _parent: unknown,
      args: ReactionChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const hasAccess = await canAccessChannel(context, args.channelId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${REACTION_CHANGED}_${args.channelId}`
      );
    },
  },

  /**
   * Subscribe to thread updates for a specific parent message
   *
   * @example
   * ```graphql
   * subscription {
   *   threadUpdated(parentMessageId: "msg_123") {
   *     id
   *     content
   *     author { displayName }
   *   }
   * }
   * ```
   */
  threadUpdated: {
    subscribe: async (
      _parent: unknown,
      args: ThreadUpdatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify access to the parent message's channel
      const parentMessage = await context.prisma.message.findUnique({
        where: { id: args.parentMessageId },
        select: { channelId: true },
      });

      if (!parentMessage) {
        throw new GraphQLError('Parent message not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const hasAccess = await canAccessChannel(
        context,
        parentMessage.channelId
      );
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this channel', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${THREAD_UPDATED}_${args.parentMessageId}`
      );
    },
  },
};

// =============================================================================
// MESSAGE FIELD RESOLVERS
// =============================================================================

/**
 * Message field resolvers for nested types
 */
export const MessageFieldResolvers = {
  /**
   * Resolve the author (User or VP) for a message
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The author user
   */
  author: async (parent: Message, _args: unknown, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },

  /**
   * Resolve the channel for a message
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The channel
   */
  channel: async (parent: Message, _args: unknown, context: GraphQLContext) => {
    return context.prisma.channel.findUnique({
      where: { id: parent.channelId },
    });
  },

  /**
   * Resolve the parent message for thread replies
   * Note: Uses parentId as per Prisma schema
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns The parent message or null
   */
  parentMessage: async (
    parent: Message,
    _args: unknown,
    context: GraphQLContext
  ) => {
    if (!parent.parentId) {
      return null;
    }

    const msg = await context.prisma.message.findUnique({
      where: { id: parent.parentId },
    });

    return msg ? toMessage(msg) : null;
  },

  /**
   * Resolve reactions with user data and counts
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of reactions with counts
   */
  reactions: async (
    parent: Message,
    _args: unknown,
    context: GraphQLContext
  ): Promise<Reaction[]> => {
    const reactions = await context.prisma.reaction.findMany({
      where: { messageId: parent.id },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    });

    // Group reactions by emoji
    const reactionMap = new Map<string, Reaction>();

    for (const reaction of reactions) {
      const existing = reactionMap.get(reaction.emoji);
      if (existing) {
        existing.users.push({
          id: reaction.user.id,
          displayName: reaction.user.displayName,
        });
        existing.count += 1;
      } else {
        reactionMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          users: [
            { id: reaction.user.id, displayName: reaction.user.displayName },
          ],
          count: 1,
        });
      }
    }

    return Array.from(reactionMap.values());
  },

  /**
   * Count thread replies for a message
   * Note: Uses parentId as per Prisma schema
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Count of replies
   */
  replyCount: async (
    parent: Message,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    return context.prisma.message.count({
      where: {
        parentId: parent.id,
        isDeleted: false,
      },
    });
  },

  /**
   * Get first N thread replies for a message
   * Note: Uses parentId as per Prisma schema
   *
   * @param parent - The parent Message object
   * @param args - Arguments with optional limit
   * @param context - GraphQL context
   * @returns Array of reply messages
   */
  replies: async (
    parent: Message,
    args: { first?: number | null },
    context: GraphQLContext
  ) => {
    const limit = Math.min(Math.max(args.first ?? 3, 1), 100);

    const replies = await context.prisma.message.findMany({
      where: {
        parentId: parent.id,
        isDeleted: false,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const edges = replies.map((msg: PrismaMessage) => {
      const messageData = toMessage(msg);
      return {
        node: messageData,
        cursor: generateCursor(messageData),
      };
    });

    const totalCount = await context.prisma.message.count({
      where: { parentId: parent.id, isDeleted: false },
    });

    return {
      edges,
      pageInfo: {
        hasNextPage: totalCount > limit,
        hasPreviousPage: false,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Resolve file attachments for a message
   * Note: Uses MessageAttachment junction table as per Prisma schema
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of attached files
   */
  attachments: async (
    parent: Message,
    _args: unknown,
    context: GraphQLContext
  ) => {
    const attachments = await context.prisma.messageAttachment.findMany({
      where: { messageId: parent.id },
      include: { file: true },
    });

    return attachments.map((a: (typeof attachments)[number]) => a.file);
  },

  /**
   * Resolve mentioned users in a message
   *
   * @param parent - The parent Message object
   * @param _args - Resolver arguments (unused)
   * @param context - GraphQL context
   * @returns Array of mentioned users
   */
  mentions: async (
    parent: Message,
    _args: unknown,
    context: GraphQLContext
  ) => {
    // Parse mentions from content - look for @[userId] or @username patterns
    const mentionPattern = /@\[([a-zA-Z0-9_-]+)\]/g;
    const userIds: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = mentionPattern.exec(parent.content)) !== null) {
      if (match[1]) {
        userIds.push(match[1]);
      }
    }

    if (userIds.length === 0) {
      return [];
    }

    return context.prisma.user.findMany({
      where: { id: { in: userIds } },
    });
  },

  /**
   * Check if message has been edited
   * Note: Uses isEdited boolean field from Prisma schema
   *
   * @param parent - The parent Message object
   * @returns True if message was edited
   */
  isEdited: (parent: Message): boolean => {
    return parent.isEdited;
  },

  /**
   * Get the edit time if message was edited
   * Note: Uses editedAt field from Prisma schema
   *
   * @param parent - The parent Message object
   * @returns Edit timestamp or null
   */
  editedAt: (parent: Message): Date | null => {
    return parent.editedAt;
  },

  /**
   * Check if message is pinned
   * Note: Uses metadata.pinned since Prisma schema does not have isPinned field
   *
   * @param parent - The parent Message object
   * @returns True if message is pinned
   */
  isPinned: (parent: Message): boolean => {
    return isPinned(parent);
  },
};

// =============================================================================
// COMBINED MESSAGE RESOLVERS
// =============================================================================

/**
 * Combined message resolvers object for use with graphql-tools
 */
export const messageResolvers = {
  Query: messageQueries,
  Mutation: messageMutations,
  Subscription: messageSubscriptions,
  Message: MessageFieldResolvers,
};

export default messageResolvers;
