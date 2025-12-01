/**
 * @genesis/core - Message Service
 *
 * Service layer for message operations including CRUD, threads, reactions,
 * and real-time event handling via EventEmitter.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';

import { prisma } from '@neolith/database';

import { GenesisError, TransactionError } from '../errors';
import {
  DEFAULT_MESSAGE_QUERY_OPTIONS,
  MAX_MESSAGE_LIMIT,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_REACTIONS_PER_MESSAGE,
} from '../types/message';

import type {
  MessageWithRelations,
  SendMessageInput,
  MessageQueryOptions,
  PaginatedMessages,
  ThreadSummary,
  ReactionCount,
  AddReactionResult,
  OnMessageCreatedCallback,
  OnMessageUpdatedCallback,
  OnMessageDeletedCallback,
  OnReactionAddedCallback,
  OnReactionRemovedCallback,
} from '../types/message';
import type {
  PrismaClient,
  Prisma,
  Reaction,
  MessageType,
} from '@neolith/database';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when a message is not found.
 */
export class MessageNotFoundError extends GenesisError {
  constructor(messageId: string) {
    super(`Message not found: ${messageId}`, 'MESSAGE_NOT_FOUND', 404, {
      messageId,
    });
    this.name = 'MessageNotFoundError';
  }
}

/**
 * Error thrown when a channel is not found.
 */
export class ChannelNotFoundError extends GenesisError {
  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`, 'CHANNEL_NOT_FOUND', 404, {
      channelId,
    });
    this.name = 'ChannelNotFoundError';
  }
}

/**
 * Error thrown when message validation fails.
 */
export class MessageValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'MESSAGE_VALIDATION_ERROR', 400, { errors });
    this.name = 'MessageValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a reaction operation fails.
 */
export class ReactionError extends GenesisError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'REACTION_ERROR', 400, metadata);
    this.name = 'ReactionError';
  }
}

// =============================================================================
// Service Interfaces
// =============================================================================

/**
 * Interface for message CRUD operations.
 */
export interface MessageService {
  /**
   * Sends a new message to a channel.
   *
   * @param data - Message creation input
   * @returns The created message with relations
   * @throws {ChannelNotFoundError} If the channel doesn't exist
   * @throws {MessageValidationError} If validation fails
   */
  sendMessage(data: SendMessageInput): Promise<MessageWithRelations>;

  /**
   * Gets a message by ID.
   *
   * @param id - The message ID
   * @returns The message with relations, or null if not found
   */
  getMessage(id: string): Promise<MessageWithRelations | null>;

  /**
   * Gets messages from a channel with pagination.
   *
   * @param channelId - The channel ID
   * @param options - Query options for pagination and filtering
   * @returns Paginated message results
   */
  getMessages(
    channelId: string,
    options?: MessageQueryOptions
  ): Promise<PaginatedMessages>;

  /**
   * Updates a message content.
   *
   * @param id - The message ID
   * @param content - The new content
   * @returns The updated message
   * @throws {MessageNotFoundError} If the message doesn't exist
   */
  updateMessage(id: string, content: string): Promise<MessageWithRelations>;

  /**
   * Permanently deletes a message.
   *
   * @param id - The message ID
   * @throws {MessageNotFoundError} If the message doesn't exist
   */
  deleteMessage(id: string): Promise<void>;

  /**
   * Soft deletes a message (marks as deleted but retains record).
   *
   * @param id - The message ID
   * @returns The soft-deleted message
   * @throws {MessageNotFoundError} If the message doesn't exist
   */
  softDeleteMessage(id: string): Promise<MessageWithRelations>;
}

/**
 * Interface for thread operations.
 */
export interface ThreadService {
  /**
   * Creates a thread by sending a reply to a parent message.
   *
   * @param parentMessageId - The parent message ID
   * @param data - The reply message data (without parentId)
   * @returns The created reply message
   * @throws {MessageNotFoundError} If the parent message doesn't exist
   */
  createThread(
    parentMessageId: string,
    data: Omit<SendMessageInput, 'parentId'>
  ): Promise<MessageWithRelations>;

  /**
   * Gets all messages in a thread.
   *
   * @param parentId - The parent message ID
   * @param options - Query options
   * @returns Paginated thread messages
   */
  getThreadMessages(
    parentId: string,
    options?: MessageQueryOptions
  ): Promise<PaginatedMessages>;

  /**
   * Gets the count of replies in a thread.
   *
   * @param parentId - The parent message ID
   * @returns The number of replies
   */
  getThreadCount(parentId: string): Promise<number>;

  /**
   * Gets a summary of a thread.
   *
   * @param parentId - The parent message ID
   * @returns Thread summary with participant info
   */
  getThreadSummary(parentId: string): Promise<ThreadSummary | null>;
}

/**
 * Interface for reaction operations.
 */
export interface ReactionService {
  /**
   * Adds a reaction to a message.
   *
   * @param messageId - The message ID
   * @param userId - The user ID
   * @param emoji - The emoji to add
   * @returns The created reaction and whether it was newly created
   * @throws {MessageNotFoundError} If the message doesn't exist
   * @throws {ReactionError} If the reaction limit is exceeded
   */
  addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<AddReactionResult>;

  /**
   * Removes a reaction from a message.
   *
   * @param messageId - The message ID
   * @param userId - The user ID
   * @param emoji - The emoji to remove
   * @throws {MessageNotFoundError} If the message doesn't exist
   */
  removeReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void>;

  /**
   * Gets all reactions for a message.
   *
   * @param messageId - The message ID
   * @returns Array of reactions
   */
  getReactions(messageId: string): Promise<Reaction[]>;

  /**
   * Gets reaction counts grouped by emoji.
   *
   * @param messageId - The message ID
   * @returns Object mapping emoji to count and user IDs
   */
  getReactionCounts(messageId: string): Promise<ReactionCount[]>;
}

/**
 * Interface for real-time message events.
 */
export interface MessageEvents {
  /**
   * Subscribes to message created events in a channel.
   *
   * @param channelId - The channel ID to subscribe to
   * @param callback - Callback function when a message is created
   * @returns Unsubscribe function
   */
  onMessageCreated(
    channelId: string,
    callback: OnMessageCreatedCallback
  ): () => void;

  /**
   * Subscribes to message updated events in a channel.
   *
   * @param channelId - The channel ID to subscribe to
   * @param callback - Callback function when a message is updated
   * @returns Unsubscribe function
   */
  onMessageUpdated(
    channelId: string,
    callback: OnMessageUpdatedCallback
  ): () => void;

  /**
   * Subscribes to message deleted events in a channel.
   *
   * @param channelId - The channel ID to subscribe to
   * @param callback - Callback function when a message is deleted
   * @returns Unsubscribe function
   */
  onMessageDeleted(
    channelId: string,
    callback: OnMessageDeletedCallback
  ): () => void;

  /**
   * Subscribes to reaction added events for a message.
   *
   * @param messageId - The message ID to subscribe to
   * @param callback - Callback function when a reaction is added
   * @returns Unsubscribe function
   */
  onReactionAdded(
    messageId: string,
    callback: OnReactionAddedCallback
  ): () => void;

  /**
   * Subscribes to reaction removed events for a message.
   *
   * @param messageId - The message ID to subscribe to
   * @param callback - Callback function when a reaction is removed
   * @returns Unsubscribe function
   */
  onReactionRemoved(
    messageId: string,
    callback: OnReactionRemovedCallback
  ): () => void;
}

// =============================================================================
// Message Service Implementation
// =============================================================================

/**
 * Complete message service implementation providing CRUD operations,
 * thread management, reactions, and real-time events.
 */
export class MessageServiceImpl
  implements MessageService, ThreadService, ReactionService, MessageEvents
{
  private readonly db: PrismaClient;
  private readonly eventEmitter: EventEmitter;

  /**
   * Creates a new MessageServiceImpl instance.
   *
   * @param database - Optional Prisma client instance (defaults to singleton)
   */
  constructor(database?: PrismaClient) {
    this.db = database ?? prisma;
    this.eventEmitter = new EventEmitter();
    // Increase max listeners to prevent warnings in high-traffic scenarios
    this.eventEmitter.setMaxListeners(100);
  }

  // ===========================================================================
  // Message CRUD Operations
  // ===========================================================================

  /**
   * Sends a new message to a channel.
   */
  async sendMessage(data: SendMessageInput): Promise<MessageWithRelations> {
    // Validate input
    this.validateSendMessageInput(data);

    // Verify channel exists
    const channel = await this.db.channel.findUnique({
      where: { id: data.channelId },
    });

    if (!channel) {
      throw new ChannelNotFoundError(data.channelId);
    }

    // If parentId is provided, verify parent message exists
    if (data.parentId) {
      const parentMessage = await this.db.message.findUnique({
        where: { id: data.parentId },
      });

      if (!parentMessage) {
        throw new MessageNotFoundError(data.parentId);
      }

      // Verify parent message is in the same channel
      if (parentMessage.channelId !== data.channelId) {
        throw new MessageValidationError('Invalid thread', {
          parentId: ['Parent message must be in the same channel'],
        });
      }
    }

    try {
      const message = await this.db.message.create({
        data: {
          content: data.content,
          type: (data.type ?? 'TEXT') as MessageType,
          metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
          channelId: data.channelId,
          authorId: data.authorId,
          parentId: data.parentId,
        },
        include: {
          author: true,
          reactions: true,
          parent: true,
        },
      });

      const messageWithRelations = message as MessageWithRelations;

      // Emit event
      this.emitMessageCreated(data.channelId, messageWithRelations);

      // If this is a thread reply, emit thread updated event
      if (data.parentId) {
        this.emitThreadUpdated(data.channelId, data.parentId);
      }

      return messageWithRelations;
    } catch (error) {
      throw new TransactionError(
        'sendMessage',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets a message by ID with relations.
   */
  async getMessage(id: string): Promise<MessageWithRelations | null> {
    const message = await this.db.message.findUnique({
      where: { id },
      include: {
        author: true,
        reactions: true,
        parent: true,
        replies: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return message as MessageWithRelations | null;
  }

  /**
   * Gets messages from a channel with pagination.
   */
  async getMessages(
    channelId: string,
    options: MessageQueryOptions = {}
  ): Promise<PaginatedMessages> {
    const {
      limit = DEFAULT_MESSAGE_QUERY_OPTIONS.limit,
      before,
      after,
      includeDeleted = DEFAULT_MESSAGE_QUERY_OPTIONS.includeDeleted,
      type,
      includeReactions = DEFAULT_MESSAGE_QUERY_OPTIONS.includeReactions,
      includeAuthor = DEFAULT_MESSAGE_QUERY_OPTIONS.includeAuthor,
    } = options;

    // Cap the limit
    const effectiveLimit = Math.min(limit, MAX_MESSAGE_LIMIT);

    // Build where clause
    const where: Prisma.messageWhereInput = {
      channelId,
      parentId: null, // Only top-level messages
      ...(!includeDeleted && { isDeleted: false }),
      ...(type && { type }),
    };

    // Handle cursor-based pagination
    if (before) {
      const beforeMessage = await this.db.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });

      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    } else if (after) {
      const afterMessage = await this.db.message.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });

      if (afterMessage) {
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    // Build include clause
    const include: Prisma.messageInclude = {
      ...(includeAuthor && { author: true }),
      ...(includeReactions && { reactions: true }),
      parent: true,
    };

    // Get total count and messages in parallel
    const [total, messages] = await Promise.all([
      this.db.message.count({
        where: {
          channelId,
          parentId: null,
          ...(!includeDeleted && { isDeleted: false }),
        },
      }),
      this.db.message.findMany({
        where,
        include,
        take: effectiveLimit + 1, // Fetch one extra to determine hasMore
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Determine if there are more messages
    const hasMore = messages.length > effectiveLimit;
    const data = hasMore ? messages.slice(0, effectiveLimit) : messages;

    // Get cursors
    const firstMessage = data[0];
    const lastMessage = data[data.length - 1];

    return {
      data: data as MessageWithRelations[],
      total,
      hasMore,
      nextCursor: hasMore ? lastMessage?.id : undefined,
      prevCursor: firstMessage?.id,
    };
  }

  /**
   * Updates a message content.
   */
  async updateMessage(
    id: string,
    content: string
  ): Promise<MessageWithRelations> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new MessageValidationError('Content validation failed', {
        content: ['Content cannot be empty'],
      });
    }

    if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new MessageValidationError('Content validation failed', {
        content: [
          `Content cannot exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
        ],
      });
    }

    // Check message exists
    const existing = await this.getMessage(id);
    if (!existing) {
      throw new MessageNotFoundError(id);
    }

    if (existing.isDeleted) {
      throw new MessageValidationError('Cannot update deleted message', {
        id: ['Message has been deleted'],
      });
    }

    const updated = await this.db.message.update({
      where: { id },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: true,
        reactions: true,
        parent: true,
      },
    });

    const updatedMessage = updated as MessageWithRelations;

    // Emit event
    this.emitMessageUpdated(existing.channelId, updatedMessage);

    return updatedMessage;
  }

  /**
   * Permanently deletes a message.
   */
  async deleteMessage(id: string): Promise<void> {
    const existing = await this.getMessage(id);
    if (!existing) {
      throw new MessageNotFoundError(id);
    }

    try {
      await this.db.$transaction(async tx => {
        // Delete all reactions first
        await tx.reaction.deleteMany({
          where: { messageId: id },
        });

        // Delete all thread replies
        await tx.message.deleteMany({
          where: { parentId: id },
        });

        // Delete the message
        await tx.message.delete({
          where: { id },
        });
      });

      // Emit event
      this.emitMessageDeleted(existing.channelId, id, false);
    } catch (error) {
      throw new TransactionError(
        'deleteMessage',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft deletes a message.
   */
  async softDeleteMessage(id: string): Promise<MessageWithRelations> {
    const existing = await this.getMessage(id);
    if (!existing) {
      throw new MessageNotFoundError(id);
    }

    const updated = await this.db.message.update({
      where: { id },
      data: {
        isDeleted: true,
        content: '[Message deleted]',
      },
      include: {
        author: true,
        reactions: true,
        parent: true,
      },
    });

    const softDeletedMessage = updated as MessageWithRelations;

    // Emit event
    this.emitMessageDeleted(existing.channelId, id, true);

    return softDeletedMessage;
  }

  // ===========================================================================
  // Thread Operations
  // ===========================================================================

  /**
   * Creates a thread reply to a parent message.
   */
  async createThread(
    parentMessageId: string,
    data: Omit<SendMessageInput, 'parentId'>
  ): Promise<MessageWithRelations> {
    // Verify parent exists
    const parent = await this.getMessage(parentMessageId);
    if (!parent) {
      throw new MessageNotFoundError(parentMessageId);
    }

    // Create reply as a regular message with parentId
    return this.sendMessage({
      ...data,
      channelId: parent.channelId,
      parentId: parentMessageId,
    });
  }

  /**
   * Gets all messages in a thread.
   */
  async getThreadMessages(
    parentId: string,
    options: MessageQueryOptions = {}
  ): Promise<PaginatedMessages> {
    const {
      limit = DEFAULT_MESSAGE_QUERY_OPTIONS.limit,
      before,
      after,
      includeDeleted = DEFAULT_MESSAGE_QUERY_OPTIONS.includeDeleted,
      includeReactions = DEFAULT_MESSAGE_QUERY_OPTIONS.includeReactions,
      includeAuthor = DEFAULT_MESSAGE_QUERY_OPTIONS.includeAuthor,
    } = options;

    const effectiveLimit = Math.min(limit, MAX_MESSAGE_LIMIT);

    // Build where clause
    const where: Prisma.messageWhereInput = {
      parentId,
      ...(!includeDeleted && { isDeleted: false }),
    };

    // Handle cursor-based pagination
    if (before) {
      const beforeMessage = await this.db.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });

      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    } else if (after) {
      const afterMessage = await this.db.message.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });

      if (afterMessage) {
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    // Build include clause
    const include: Prisma.messageInclude = {
      ...(includeAuthor && { author: true }),
      ...(includeReactions && { reactions: true }),
    };

    const [total, messages] = await Promise.all([
      this.db.message.count({
        where: { parentId, ...(!includeDeleted && { isDeleted: false }) },
      }),
      this.db.message.findMany({
        where,
        include,
        take: effectiveLimit + 1,
        orderBy: { createdAt: 'asc' }, // Thread replies in chronological order
      }),
    ]);

    const hasMore = messages.length > effectiveLimit;
    const data = hasMore ? messages.slice(0, effectiveLimit) : messages;

    const firstMessage = data[0];
    const lastMessage = data[data.length - 1];

    return {
      data: data as MessageWithRelations[],
      total,
      hasMore,
      nextCursor: hasMore ? lastMessage?.id : undefined,
      prevCursor: firstMessage?.id,
    };
  }

  /**
   * Gets the count of replies in a thread.
   */
  async getThreadCount(parentId: string): Promise<number> {
    return this.db.message.count({
      where: {
        parentId,
        isDeleted: false,
      },
    });
  }

  /**
   * Gets a summary of a thread.
   */
  async getThreadSummary(parentId: string): Promise<ThreadSummary | null> {
    // Verify parent exists
    const parent = await this.db.message.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      return null;
    }

    // Get reply count and distinct participants
    const [replyCount, replies] = await Promise.all([
      this.db.message.count({
        where: { parentId, isDeleted: false },
      }),
      this.db.message.findMany({
        where: { parentId, isDeleted: false },
        select: {
          authorId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Get unique participant IDs
    const participantIds = [...new Set(replies.map(r => r.authorId))];

    // Get last reply with author
    const lastReply = await this.db.message.findFirst({
      where: { parentId, isDeleted: false },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      parentId,
      replyCount,
      lastReplyAt: lastReply?.createdAt ?? null,
      participantIds,
      lastReply: lastReply
        ? {
            ...lastReply,
            author: lastReply.author,
          }
        : undefined,
    };
  }

  // ===========================================================================
  // Reaction Operations
  // ===========================================================================

  /**
   * Adds a reaction to a message using a transaction to prevent duplicates.
   */
  async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<AddReactionResult> {
    // Validate emoji
    if (!emoji || emoji.trim().length === 0) {
      throw new ReactionError('Emoji cannot be empty', { messageId, userId });
    }

    // Verify message exists
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new MessageNotFoundError(messageId);
    }

    // Check reaction limit
    const existingReactionCount = await this.db.reaction.count({
      where: { messageId },
    });

    if (existingReactionCount >= MAX_REACTIONS_PER_MESSAGE) {
      throw new ReactionError(
        `Maximum reactions (${MAX_REACTIONS_PER_MESSAGE}) reached for this message`,
        { messageId, currentCount: existingReactionCount }
      );
    }

    try {
      // Use transaction with upsert-like behavior
      const result = await this.db.$transaction(async tx => {
        // Check if reaction already exists
        const existing = await tx.reaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId,
              userId,
              emoji,
            },
          },
        });

        if (existing) {
          return { reaction: existing, created: false };
        }

        // Create new reaction
        const reaction = await tx.reaction.create({
          data: {
            messageId,
            userId,
            emoji,
          },
        });

        return { reaction, created: true };
      });

      // Emit event only if newly created
      if (result.created) {
        this.emitReactionAdded(message.channelId, messageId, result.reaction);
      }

      return result;
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        const existing = await this.db.reaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId,
              userId,
              emoji,
            },
          },
        });

        if (existing) {
          return { reaction: existing, created: false };
        }
      }

      throw new TransactionError(
        'addReaction',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Removes a reaction from a message.
   */
  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    // Verify message exists
    const message = await this.getMessage(messageId);
    if (!message) {
      throw new MessageNotFoundError(messageId);
    }

    // Delete the reaction (no-op if doesn't exist)
    const deleteResult = await this.db.reaction.deleteMany({
      where: {
        messageId,
        userId,
        emoji,
      },
    });

    // Only emit if something was deleted
    if (deleteResult.count > 0) {
      this.emitReactionRemoved(message.channelId, messageId, emoji, userId);
    }
  }

  /**
   * Gets all reactions for a message.
   */
  async getReactions(messageId: string): Promise<Reaction[]> {
    return this.db.reaction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Gets reaction counts grouped by emoji.
   */
  async getReactionCounts(messageId: string): Promise<ReactionCount[]> {
    const reactions = await this.db.reaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        userId: true,
      },
    });

    // Group by emoji
    const grouped = new Map<string, string[]>();

    for (const reaction of reactions) {
      const existing = grouped.get(reaction.emoji) ?? [];
      existing.push(reaction.userId);
      grouped.set(reaction.emoji, existing);
    }

    // Convert to array of ReactionCount
    return Array.from(grouped.entries()).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));
  }

  // ===========================================================================
  // Event Subscriptions
  // ===========================================================================

  /**
   * Subscribes to message created events.
   */
  onMessageCreated(
    channelId: string,
    callback: OnMessageCreatedCallback
  ): () => void {
    const eventName = `message:created:${channelId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to message updated events.
   */
  onMessageUpdated(
    channelId: string,
    callback: OnMessageUpdatedCallback
  ): () => void {
    const eventName = `message:updated:${channelId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to message deleted events.
   */
  onMessageDeleted(
    channelId: string,
    callback: OnMessageDeletedCallback
  ): () => void {
    const eventName = `message:deleted:${channelId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to reaction added events.
   */
  onReactionAdded(
    messageId: string,
    callback: OnReactionAddedCallback
  ): () => void {
    const eventName = `reaction:added:${messageId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to reaction removed events.
   */
  onReactionRemoved(
    messageId: string,
    callback: OnReactionRemovedCallback
  ): () => void {
    const eventName = `reaction:removed:${messageId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  // ===========================================================================
  // Private Event Emitters
  // ===========================================================================

  /**
   * Emits a message created event.
   */
  private emitMessageCreated(
    channelId: string,
    message: MessageWithRelations
  ): void {
    this.eventEmitter.emit(`message:created:${channelId}`, message);
  }

  /**
   * Emits a message updated event.
   */
  private emitMessageUpdated(
    channelId: string,
    message: MessageWithRelations
  ): void {
    this.eventEmitter.emit(`message:updated:${channelId}`, message);
  }

  /**
   * Emits a message deleted event.
   */
  private emitMessageDeleted(
    channelId: string,
    messageId: string,
    softDelete: boolean
  ): void {
    this.eventEmitter.emit(
      `message:deleted:${channelId}`,
      messageId,
      softDelete
    );
  }

  /**
   * Emits a reaction added event.
   */
  private emitReactionAdded(
    channelId: string,
    messageId: string,
    reaction: Reaction
  ): void {
    this.eventEmitter.emit(`reaction:added:${messageId}`, messageId, reaction);
    // Also emit channel-level event for subscribers watching the channel
    this.eventEmitter.emit(
      `channel:reaction:added:${channelId}`,
      messageId,
      reaction
    );
  }

  /**
   * Emits a reaction removed event.
   */
  private emitReactionRemoved(
    channelId: string,
    messageId: string,
    emoji: string,
    userId: string
  ): void {
    this.eventEmitter.emit(
      `reaction:removed:${messageId}`,
      messageId,
      emoji,
      userId
    );
    // Also emit channel-level event
    this.eventEmitter.emit(
      `channel:reaction:removed:${channelId}`,
      messageId,
      emoji,
      userId
    );
  }

  /**
   * Emits a thread updated event.
   */
  private emitThreadUpdated(channelId: string, parentId: string): void {
    // Fire and forget - get summary and emit
    this.getThreadSummary(parentId)
      .then(summary => {
        if (summary) {
          this.eventEmitter.emit(
            `thread:updated:${channelId}`,
            parentId,
            summary
          );
        }
      })
      .catch(() => {
        // Ignore errors in event emission
      });
  }

  // ===========================================================================
  // Private Validation Methods
  // ===========================================================================

  /**
   * Validates send message input.
   */
  private validateSendMessageInput(data: SendMessageInput): void {
    const errors: Record<string, string[]> = {};

    if (!data.channelId || data.channelId.trim().length === 0) {
      errors.channelId = ['Channel ID is required'];
    }

    if (!data.authorId || data.authorId.trim().length === 0) {
      errors.authorId = ['Author ID is required'];
    }

    if (data.content === undefined || data.content === null) {
      errors.content = ['Content is required'];
    } else if (data.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      errors.content = [
        `Content cannot exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
      ];
    }

    if (
      data.type &&
      !['TEXT', 'SYSTEM', 'FILE', 'COMMAND'].includes(data.type)
    ) {
      errors.type = ['Invalid message type'];
    }

    if (Object.keys(errors).length > 0) {
      throw new MessageValidationError('Message validation failed', errors);
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Gets the event emitter for advanced use cases.
   * Note: Prefer using the subscription methods for type safety.
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Removes all event listeners.
   * Useful for cleanup in tests or when disposing the service.
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new message service instance.
 *
 * @param database - Optional Prisma client instance
 * @returns Message service instance
 *
 * @example
 * ```typescript
 * const messageService = createMessageService();
 *
 * // Send a message
 * const message = await messageService.sendMessage({
 *   channelId: 'channel_123',
 *   authorId: 'user_456',
 *   content: 'Hello, world!',
 * });
 *
 * // Subscribe to new messages
 * const unsubscribe = messageService.onMessageCreated('channel_123', (msg) => {
 *   console.log('New message:', msg.content);
 * });
 *
 * // Later: unsubscribe
 * unsubscribe();
 * ```
 */
export function createMessageService(
  database?: PrismaClient
): MessageServiceImpl {
  return new MessageServiceImpl(database);
}

/**
 * Default message service instance using the singleton Prisma client.
 */
export const messageService = createMessageService();
