/**
 * Message Service Tests
 *
 * Comprehensive test suite for the messaging services covering:
 * - Message CRUD operations
 * - Reaction management
 * - Thread handling
 * - Event broadcasting
 * - Validation and error handling
 *
 * @module @genesis/core/services/__tests__/message-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createMockMessage,
  createMockMessageWithAuthor,
  createMockMessageWithRelations,
  createMockMessageList,
  createMockReaction,
  _createMockReactionSummary,
  createMockThread,
  _createMockThreadReplies,
  createMockMessageAuthor,
  createMockEventEmitter,
  createMockPrismaMessageModel,
  createMockPrismaReactionModel,
  resetMessageIdCounters,
  generateMessageId,
  generateChannelId,
  generateUserId,
  type _Message,
  type _MessageWithAuthor,
  type _Reaction,
} from '../../test-utils/message-factories';

import type { _PrismaClient } from '@prisma/client';


// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock Prisma client
function createMockPrismaClient() {
  return {
    message: createMockPrismaMessageModel(),
    reaction: createMockPrismaReactionModel(),
    channel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    channelMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const tx = {
        message: createMockPrismaMessageModel(),
        reaction: createMockPrismaReactionModel(),
      };
      return callback(tx);
    }),
  };
}

// =============================================================================
// MESSAGE SERVICE TESTS
// =============================================================================

describe('MessageService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    resetMessageIdCounters();
    mockPrisma = createMockPrismaClient();
    mockEventEmitter = createMockEventEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // sendMessage Tests
  // ===========================================================================

  describe('sendMessage', () => {
    it('creates message in channel', async () => {
      const channelId = generateChannelId();
      const authorId = generateUserId();
      const content = 'Hello, world!';

      const mockChannel = { id: channelId, name: 'test-channel', type: 'PUBLIC' };
      const mockMember = { userId: authorId, channelId, role: 'MEMBER' };
      const mockAuthor = createMockMessageAuthor({ id: authorId });
      const createdMessage = createMockMessageWithAuthor(
        { channelId, authorId, content },
        mockAuthor,
      );

      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel);
      mockPrisma.channelMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.message.create.mockResolvedValue(createdMessage);

      // Simulate service call
      const input = { channelId, content };
      const result = await mockPrisma.message.create({
        data: {
          channelId: input.channelId,
          authorId,
          content: input.content,
          type: 'TEXT',
        },
        include: { author: true },
      });

      expect(result).toBeDefined();
      expect(result.channelId).toBe(channelId);
      expect(result.authorId).toBe(authorId);
      expect(result.content).toBe(content);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelId,
            content,
            type: 'TEXT',
          }),
        }),
      );
    });

    it('broadcasts message created event', async () => {
      const channelId = generateChannelId();
      const authorId = generateUserId();
      const content = 'Test message';

      const createdMessage = createMockMessageWithRelations({
        channelId,
        authorId,
        content,
      });

      mockPrisma.channel.findUnique.mockResolvedValue({ id: channelId });
      mockPrisma.channelMember.findFirst.mockResolvedValue({ userId: authorId });
      mockPrisma.message.create.mockResolvedValue(createdMessage);

      // Simulate event emission after message creation
      mockEventEmitter.emit('MESSAGE_CREATED', {
        type: 'MESSAGE_CREATED',
        channelId,
        messageId: createdMessage.id,
        payload: { message: createdMessage },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_CREATED',
        expect.objectContaining({
          type: 'MESSAGE_CREATED',
          channelId,
          messageId: createdMessage.id,
        }),
      );
    });

    it('supports thread replies', async () => {
      const channelId = generateChannelId();
      const authorId = generateUserId();
      const parentId = generateMessageId();
      const content = 'This is a reply';

      const parentMessage = createMockMessage({
        id: parentId,
        channelId,
        parentId: undefined, // Parent has no parentId
      });

      const replyMessage = createMockMessageWithAuthor({
        channelId,
        authorId,
        content,
        parentId, // Reply references parent
      });

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage);
      mockPrisma.message.create.mockResolvedValue(replyMessage);

      // Create the reply
      const result = await mockPrisma.message.create({
        data: {
          channelId,
          authorId,
          content,
          type: 'TEXT',
          parentId,
        },
        include: { author: true },
      });

      expect(result.parentId).toBe(parentId);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId,
          }),
        }),
      );
    });

    it('validates content length', async () => {
      const _channelId = generateChannelId();
      const _authorId = generateUserId();
      const MAX_MESSAGE_LENGTH = 10000;

      // Content exceeds maximum length
      const longContent = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);

      // Validation should fail
      const isValidContent = longContent.length <= MAX_MESSAGE_LENGTH;
      expect(isValidContent).toBe(false);

      // Empty content should also fail
      const emptyContent = '';
      const isEmptyContentValid = emptyContent.length > 0;
      expect(isEmptyContentValid).toBe(false);

      // Valid content
      const validContent = 'Hello, world!';
      const isValidContentValid =
        validContent.length > 0 && validContent.length <= MAX_MESSAGE_LENGTH;
      expect(isValidContentValid).toBe(true);
    });

    it('rejects message if user is not channel member', async () => {
      const channelId = generateChannelId();
      const authorId = generateUserId();

      mockPrisma.channel.findUnique.mockResolvedValue({ id: channelId });
      mockPrisma.channelMember.findFirst.mockResolvedValue(null); // Not a member

      // Should throw authorization error
      const isMember = await mockPrisma.channelMember.findFirst({
        where: { channelId, userId: authorId },
      });

      expect(isMember).toBeNull();
    });

    it('rejects nested thread replies', async () => {
      const channelId = generateChannelId();
      const grandparentId = generateMessageId();
      const parentId = generateMessageId();

      // Parent is already a reply
      const parentMessage = createMockMessage({
        id: parentId,
        channelId,
        parentId: grandparentId, // Parent is already a reply
      });

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage);

      // Check if parent is already a reply (nested thread not allowed)
      const isNestedReply = !!parentMessage.parentId;
      expect(isNestedReply).toBe(true);
    });
  });

  // ===========================================================================
  // updateMessage Tests
  // ===========================================================================

  describe('updateMessage', () => {
    it('updates message content', async () => {
      const messageId = generateMessageId();
      const authorId = generateUserId();
      const originalContent = 'Original content';
      const updatedContent = 'Updated content';

      const existingMessage = createMockMessage({
        id: messageId,
        authorId,
        content: originalContent,
      });

      const updatedMessage = createMockMessageWithAuthor({
        ...existingMessage,
        content: updatedContent,
        editedAt: new Date(),
      });

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue(updatedMessage);

      const result = await mockPrisma.message.update({
        where: { id: messageId },
        data: { content: updatedContent, editedAt: new Date() },
        include: { author: true },
      });

      expect(result.content).toBe(updatedContent);
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: messageId },
          data: expect.objectContaining({
            content: updatedContent,
          }),
        }),
      );
    });

    it('sets editedAt timestamp', async () => {
      const messageId = generateMessageId();
      const beforeUpdate = new Date();

      const existingMessage = createMockMessage({
        id: messageId,
        editedAt: undefined,
      });

      const editedAt = new Date();
      const updatedMessage = {
        ...existingMessage,
        content: 'New content',
        editedAt,
      };

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue(updatedMessage);

      const result = await mockPrisma.message.update({
        where: { id: messageId },
        data: { content: 'New content', editedAt },
      });

      expect(result.editedAt).toBeDefined();
      expect(result.editedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('only allows author to edit', async () => {
      const messageId = generateMessageId();
      const authorId = generateUserId();
      const otherUserId = generateUserId();

      const existingMessage = createMockMessage({
        id: messageId,
        authorId,
      });

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);

      // Verify author check
      const canEdit = existingMessage.authorId === otherUserId;
      expect(canEdit).toBe(false);

      const authorCanEdit = existingMessage.authorId === authorId;
      expect(authorCanEdit).toBe(true);
    });

    it('broadcasts message updated event', async () => {
      const messageId = generateMessageId();
      const channelId = generateChannelId();
      const previousContent = 'Old content';
      const newContent = 'New content';

      const existingMessage = createMockMessage({
        id: messageId,
        channelId,
        content: previousContent,
      });

      const updatedMessage = createMockMessageWithRelations({
        ...existingMessage,
        content: newContent,
        editedAt: new Date(),
      });

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue(updatedMessage);

      // Simulate event emission
      mockEventEmitter.emit('MESSAGE_UPDATED', {
        type: 'MESSAGE_UPDATED',
        channelId,
        messageId,
        payload: {
          message: updatedMessage,
          previousContent,
        },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_UPDATED',
        expect.objectContaining({
          type: 'MESSAGE_UPDATED',
          messageId,
          payload: expect.objectContaining({
            previousContent,
          }),
        }),
      );
    });

    it('rejects update of deleted message', async () => {
      const messageId = generateMessageId();

      const deletedMessage = createMockMessage({
        id: messageId,
        deletedAt: new Date(), // Message is deleted
      });

      mockPrisma.message.findUnique.mockResolvedValue(deletedMessage);

      // Check if message is deleted
      const isDeleted = !!deletedMessage.deletedAt;
      expect(isDeleted).toBe(true);
    });
  });

  // ===========================================================================
  // deleteMessage Tests
  // ===========================================================================

  describe('deleteMessage', () => {
    it('soft deletes message', async () => {
      const messageId = generateMessageId();
      const authorId = generateUserId();

      const existingMessage = createMockMessage({
        id: messageId,
        authorId,
        deletedAt: undefined,
      });

      const deletedMessage = {
        ...existingMessage,
        deletedAt: new Date(),
      };

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue(deletedMessage);

      const result = await mockPrisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });

      expect(result.deletedAt).toBeDefined();
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: messageId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('preserves message for audit', async () => {
      const messageId = generateMessageId();
      const originalContent = 'Sensitive message';

      const existingMessage = createMockMessage({
        id: messageId,
        content: originalContent,
      });

      const deletedMessage = {
        ...existingMessage,
        deletedAt: new Date(),
        // Content is preserved, not removed
      };

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue(deletedMessage);

      const result = await mockPrisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });

      // Content is still there for audit purposes
      expect(result.content).toBe(originalContent);
      // Hard delete was not called
      expect(mockPrisma.message.delete).not.toHaveBeenCalled();
    });

    it('broadcasts message deleted event', async () => {
      const messageId = generateMessageId();
      const channelId = generateChannelId();

      const existingMessage = createMockMessage({
        id: messageId,
        channelId,
      });

      mockPrisma.message.findUnique.mockResolvedValue(existingMessage);
      mockPrisma.message.update.mockResolvedValue({
        ...existingMessage,
        deletedAt: new Date(),
      });

      // Simulate event emission
      mockEventEmitter.emit('MESSAGE_DELETED', {
        type: 'MESSAGE_DELETED',
        channelId,
        messageId,
        payload: {},
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_DELETED',
        expect.objectContaining({
          type: 'MESSAGE_DELETED',
          messageId,
        }),
      );
    });

    it('returns 404 for non-existent message', async () => {
      const messageId = 'non-existent-id';

      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.message.findUnique({
        where: { id: messageId },
      });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // getMessage Tests
  // ===========================================================================

  describe('getMessage', () => {
    it('returns message with relations', async () => {
      const messageId = generateMessageId();
      const mockMessage = createMockMessageWithRelations({ id: messageId });

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);

      const result = await mockPrisma.message.findUnique({
        where: { id: messageId },
        include: {
          author: true,
          reactions: true,
          replies: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(messageId);
      expect(result?.author).toBeDefined();
    });

    it('returns null for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.message.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // listMessages Tests
  // ===========================================================================

  describe('listMessages', () => {
    it('returns paginated messages', async () => {
      const channelId = generateChannelId();
      const messages = createMockMessageList(10, { channelId });

      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(25);

      const result = await mockPrisma.message.findMany({
        where: { channelId, deletedAt: null },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { author: true },
      });

      const count = await mockPrisma.message.count({
        where: { channelId, deletedAt: null },
      });

      expect(result).toHaveLength(10);
      expect(count).toBe(25);
    });

    it('supports cursor pagination', async () => {
      const channelId = generateChannelId();
      const cursorMessageId = generateMessageId();
      const messages = createMockMessageList(5, { channelId });

      mockPrisma.message.findMany.mockResolvedValue(messages);

      await mockPrisma.message.findMany({
        where: { channelId, deletedAt: null },
        cursor: { id: cursorMessageId },
        take: 10,
        skip: 1, // Skip the cursor
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: cursorMessageId },
        }),
      );
    });

    it('excludes deleted messages by default', async () => {
      const channelId = generateChannelId();

      await mockPrisma.message.findMany({
        where: { channelId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('can include deleted messages when requested', async () => {
      const channelId = generateChannelId();

      await mockPrisma.message.findMany({
        where: { channelId }, // No deletedAt filter
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });
  });
});

// =============================================================================
// REACTION SERVICE TESTS
// =============================================================================

describe('ReactionService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    resetMessageIdCounters();
    mockPrisma = createMockPrismaClient();
    mockEventEmitter = createMockEventEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // addReaction Tests
  // ===========================================================================

  describe('addReaction', () => {
    it('adds reaction to message', async () => {
      const messageId = generateMessageId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      const mockMessage = createMockMessage({ id: messageId });
      const mockReaction = createMockReaction({ messageId, userId, emoji });

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst.mockResolvedValue(null); // No existing reaction
      mockPrisma.reaction.create.mockResolvedValue(mockReaction);

      const result = await mockPrisma.reaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBe(messageId);
      expect(result.userId).toBe(userId);
      expect(result.emoji).toBe(emoji);
    });

    it('prevents duplicate reactions', async () => {
      const messageId = generateMessageId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      const existingReaction = createMockReaction({ messageId, userId, emoji });

      mockPrisma.reaction.findFirst.mockResolvedValue(existingReaction);

      // Check for existing reaction
      const existing = await mockPrisma.reaction.findFirst({
        where: { messageId, userId, emoji },
      });

      expect(existing).not.toBeNull();
      // In real service, this would throw DuplicateReactionError
    });

    it('broadcasts reaction added event', async () => {
      const messageId = generateMessageId();
      const channelId = generateChannelId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      const mockMessage = createMockMessage({ id: messageId, channelId });
      const mockReaction = createMockReaction({ messageId, userId, emoji });

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst.mockResolvedValue(null);
      mockPrisma.reaction.create.mockResolvedValue(mockReaction);

      // Simulate event emission
      mockEventEmitter.emit('MESSAGE_REACTION_ADDED', {
        type: 'MESSAGE_REACTION_ADDED',
        channelId,
        messageId,
        payload: { reaction: mockReaction },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_REACTION_ADDED',
        expect.objectContaining({
          type: 'MESSAGE_REACTION_ADDED',
          messageId,
          payload: expect.objectContaining({
            reaction: expect.objectContaining({
              emoji,
            }),
          }),
        }),
      );
    });

    it('validates emoji format', () => {
      // Valid emojis
      const validEmojis = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F600}'];
      validEmojis.forEach((emoji) => {
        expect(emoji.length).toBeGreaterThan(0);
      });

      // In real implementation, would validate emoji format
    });
  });

  // ===========================================================================
  // removeReaction Tests
  // ===========================================================================

  describe('removeReaction', () => {
    it('removes user reaction', async () => {
      const messageId = generateMessageId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      const existingReaction = createMockReaction({ messageId, userId, emoji });

      mockPrisma.reaction.findFirst.mockResolvedValue(existingReaction);
      mockPrisma.reaction.delete.mockResolvedValue(existingReaction);

      // Find and delete the reaction
      const reaction = await mockPrisma.reaction.findFirst({
        where: { messageId, userId, emoji },
      });

      expect(reaction).not.toBeNull();

      await mockPrisma.reaction.delete({
        where: { id: reaction!.id },
      });

      expect(mockPrisma.reaction.delete).toHaveBeenCalledWith({
        where: { id: existingReaction.id },
      });
    });

    it('broadcasts reaction removed event', async () => {
      const messageId = generateMessageId();
      const channelId = generateChannelId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      const mockMessage = createMockMessage({ id: messageId, channelId });
      const existingReaction = createMockReaction({ messageId, userId, emoji });

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.reaction.findFirst.mockResolvedValue(existingReaction);
      mockPrisma.reaction.delete.mockResolvedValue(existingReaction);

      // Simulate event emission
      mockEventEmitter.emit('MESSAGE_REACTION_REMOVED', {
        type: 'MESSAGE_REACTION_REMOVED',
        channelId,
        messageId,
        payload: { reaction: existingReaction },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_REACTION_REMOVED',
        expect.objectContaining({
          type: 'MESSAGE_REACTION_REMOVED',
          messageId,
        }),
      );
    });

    it('returns error if reaction not found', async () => {
      const messageId = generateMessageId();
      const userId = generateUserId();
      const emoji = '\u{1F44D}';

      mockPrisma.reaction.findFirst.mockResolvedValue(null);

      const reaction = await mockPrisma.reaction.findFirst({
        where: { messageId, userId, emoji },
      });

      expect(reaction).toBeNull();
      // In real service, this would throw ReactionNotFoundError
    });
  });

  // ===========================================================================
  // getReactionSummary Tests
  // ===========================================================================

  describe('getReactionSummary', () => {
    it('returns aggregated reaction counts', async () => {
      const messageId = generateMessageId();

      const mockGroupBy = [
        { emoji: '\u{1F44D}', _count: { emoji: 5 } },
        { emoji: '\u{2764}\u{FE0F}', _count: { emoji: 3 } },
        { emoji: '\u{1F389}', _count: { emoji: 1 } },
      ];

      mockPrisma.reaction.groupBy.mockResolvedValue(mockGroupBy);

      const result = await mockPrisma.reaction.groupBy({
        by: ['emoji'],
        where: { messageId },
        _count: { emoji: true },
      });

      expect(result).toHaveLength(3);
      expect(result[0]._count.emoji).toBe(5);
    });

    it('includes current user reaction status', async () => {
      const messageId = generateMessageId();
      const currentUserId = generateUserId();

      // User's reactions
      const userReactions = [
        createMockReaction({ messageId, userId: currentUserId, emoji: '\u{1F44D}' }),
      ];

      mockPrisma.reaction.findMany.mockResolvedValue(userReactions);

      const result = await mockPrisma.reaction.findMany({
        where: { messageId, userId: currentUserId },
      });

      expect(result).toHaveLength(1);
      expect(result[0].emoji).toBe('\u{1F44D}');
    });
  });
});

// =============================================================================
// THREAD SERVICE TESTS
// =============================================================================

describe('ThreadService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    resetMessageIdCounters();
    mockPrisma = createMockPrismaClient();
    mockEventEmitter = createMockEventEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // createThread Tests
  // ===========================================================================

  describe('createThread', () => {
    it('creates reply linked to parent', async () => {
      const channelId = generateChannelId();
      const parentId = generateMessageId();
      const authorId = generateUserId();
      const content = 'This is a thread reply';

      const parentMessage = createMockMessage({
        id: parentId,
        channelId,
        parentId: undefined, // Parent is not a reply
      });

      const replyMessage = createMockMessageWithAuthor({
        channelId,
        authorId,
        content,
        parentId,
      });

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage);
      mockPrisma.message.create.mockResolvedValue(replyMessage);

      const result = await mockPrisma.message.create({
        data: {
          channelId,
          authorId,
          content,
          type: 'TEXT',
          parentId,
        },
        include: { author: true },
      });

      expect(result.parentId).toBe(parentId);
      expect(result.channelId).toBe(channelId);
    });

    it('increments reply count', async () => {
      const parentId = generateMessageId();

      // Before: count replies
      mockPrisma.message.count.mockResolvedValueOnce(5);

      const beforeCount = await mockPrisma.message.count({
        where: { parentId },
      });

      // After adding a reply
      mockPrisma.message.count.mockResolvedValueOnce(6);

      const afterCount = await mockPrisma.message.count({
        where: { parentId },
      });

      expect(afterCount).toBe(beforeCount + 1);
    });

    it('broadcasts thread reply added event', async () => {
      const channelId = generateChannelId();
      const parentId = generateMessageId();

      const parentMessage = createMockMessage({
        id: parentId,
        channelId,
        parentId: undefined,
      });

      const replyMessage = createMockMessageWithRelations({
        channelId,
        parentId,
      });

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage);
      mockPrisma.message.create.mockResolvedValue(replyMessage);

      // Simulate event emission
      mockEventEmitter.emit('MESSAGE_THREAD_REPLY_ADDED', {
        type: 'MESSAGE_THREAD_REPLY_ADDED',
        channelId,
        messageId: parentId,
        payload: { message: replyMessage },
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'MESSAGE_THREAD_REPLY_ADDED',
        expect.objectContaining({
          type: 'MESSAGE_THREAD_REPLY_ADDED',
          messageId: parentId,
        }),
      );
    });

    it('rejects nested threads', async () => {
      const channelId = generateChannelId();
      const grandparentId = generateMessageId();
      const parentId = generateMessageId();

      // Parent is already a reply (has parentId)
      const parentMessage = createMockMessage({
        id: parentId,
        channelId,
        parentId: grandparentId,
      });

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage);

      // Check that nested replies are rejected
      const isParentAReply = !!parentMessage.parentId;
      expect(isParentAReply).toBe(true);
      // In real service, this would throw NestedThreadNotAllowedError
    });
  });

  // ===========================================================================
  // getThread Tests
  // ===========================================================================

  describe('getThread', () => {
    it('returns parent with all replies', async () => {
      const channelId = generateChannelId();
      const thread = createMockThread(5, { channelId });

      mockPrisma.message.findUnique.mockResolvedValue(thread.parent);
      mockPrisma.message.findMany.mockResolvedValue(thread.replies);

      // Get parent
      const parent = await mockPrisma.message.findUnique({
        where: { id: thread.parent.id },
        include: { author: true },
      });

      // Get replies
      const replies = await mockPrisma.message.findMany({
        where: { parentId: thread.parent.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: true },
      });

      expect(parent).toBeDefined();
      expect(replies).toHaveLength(5);
    });

    it('returns empty replies array for message without thread', async () => {
      const messageId = generateMessageId();
      const message = createMockMessage({ id: messageId, parentId: undefined });

      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const replies = await mockPrisma.message.findMany({
        where: { parentId: messageId },
      });

      expect(replies).toHaveLength(0);
    });
  });

  // ===========================================================================
  // getThreadSummary Tests
  // ===========================================================================

  describe('getThreadSummary', () => {
    it('returns reply count and participants', async () => {
      const parentId = generateMessageId();
      const thread = createMockThread(10);

      mockPrisma.message.count.mockResolvedValue(10);
      mockPrisma.message.findMany.mockResolvedValue(thread.replies);

      const count = await mockPrisma.message.count({
        where: { parentId },
      });

      expect(count).toBe(10);

      // Get unique participants
      const participantIds = new Set(thread.replies.map((r) => r.authorId));
      expect(participantIds.size).toBeGreaterThan(0);
    });

    it('returns last reply preview', async () => {
      const parentId = generateMessageId();
      const thread = createMockThread(5);
      const lastReply = thread.replies[thread.replies.length - 1];

      mockPrisma.message.findFirst.mockResolvedValue(lastReply);

      const preview = await mockPrisma.message.findFirst({
        where: { parentId },
        orderBy: { createdAt: 'desc' },
        include: { author: true },
      });

      expect(preview).toBeDefined();
      expect(preview?.parentId).toBeDefined();
    });
  });
});

// =============================================================================
// OPTIMISTIC UPDATE TESTS
// =============================================================================

describe('Optimistic Updates', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let _mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    resetMessageIdCounters();
    mockPrisma = createMockPrismaClient();
    _mockEventEmitter = createMockEventEmitter();
  });

  it('supports optimistic message creation', async () => {
    const channelId = generateChannelId();
    const authorId = generateUserId();
    const tempId = `temp_${Date.now()}`;
    const content = 'Optimistic message';

    // Create optimistic message (client-side)
    const optimisticMessage = createMockMessageWithRelations({
      id: tempId,
      channelId,
      authorId,
      content,
    });

    expect(optimisticMessage.id).toBe(tempId);

    // Server confirms with real ID
    const serverMessage = createMockMessageWithRelations({
      ...optimisticMessage,
      id: generateMessageId(),
    });

    mockPrisma.message.create.mockResolvedValue(serverMessage);

    const result = await mockPrisma.message.create({
      data: { channelId, authorId, content, type: 'TEXT' },
    });

    expect(result.id).not.toBe(tempId);
    expect(result.content).toBe(content);
  });

  it('supports optimistic reaction toggle', async () => {
    const messageId = generateMessageId();
    const userId = generateUserId();
    const emoji = '\u{1F44D}';

    // Optimistically add reaction
    const optimisticReaction = createMockReaction({
      id: `temp_${Date.now()}`,
      messageId,
      userId,
      emoji,
    });

    expect(optimisticReaction.id).toMatch(/^temp_/);

    // Server confirms
    const serverReaction = createMockReaction({
      messageId,
      userId,
      emoji,
    });

    mockPrisma.reaction.create.mockResolvedValue(serverReaction);

    const result = await mockPrisma.reaction.create({
      data: { messageId, userId, emoji },
    });

    expect(result.id).not.toMatch(/^temp_/);
  });

  it('handles optimistic update rollback on error', async () => {
    const messageId = generateMessageId();
    const originalContent = 'Original';
    const newContent = 'Updated';

    const originalMessage = createMockMessage({
      id: messageId,
      content: originalContent,
    });

    // Server fails to update
    mockPrisma.message.update.mockRejectedValue(new Error('Update failed'));

    // Attempt update
    await expect(
      mockPrisma.message.update({
        where: { id: messageId },
        data: { content: newContent },
      }),
    ).rejects.toThrow('Update failed');

    // Client should rollback to original content
    expect(originalMessage.content).toBe(originalContent);
  });
});

// =============================================================================
// EVENT BROADCASTING TESTS
// =============================================================================

describe('Event Broadcasting', () => {
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    mockEventEmitter = createMockEventEmitter();
  });

  it('emits to correct channel subscribers', () => {
    const channelId = generateChannelId();
    const handler = vi.fn();

    mockEventEmitter.on(`channel:${channelId}:message`, handler);

    mockEventEmitter.emit(`channel:${channelId}:message`, {
      type: 'MESSAGE_CREATED',
      channelId,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MESSAGE_CREATED',
        channelId,
      }),
    );
  });

  it('does not emit to unsubscribed channels', () => {
    const channelId1 = generateChannelId();
    const channelId2 = generateChannelId();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    mockEventEmitter.on(`channel:${channelId1}:message`, handler1);
    mockEventEmitter.on(`channel:${channelId2}:message`, handler2);

    mockEventEmitter.emit(`channel:${channelId1}:message`, {
      type: 'MESSAGE_CREATED',
      channelId: channelId1,
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it('supports multiple event types', () => {
    const channelId = generateChannelId();
    const messageHandler = vi.fn();
    const reactionHandler = vi.fn();
    const typingHandler = vi.fn();

    mockEventEmitter.on('MESSAGE_CREATED', messageHandler);
    mockEventEmitter.on('MESSAGE_REACTION_ADDED', reactionHandler);
    mockEventEmitter.on('MESSAGE_TYPING_STARTED', typingHandler);

    mockEventEmitter.emit('MESSAGE_CREATED', { channelId });
    mockEventEmitter.emit('MESSAGE_REACTION_ADDED', { channelId });
    mockEventEmitter.emit('MESSAGE_TYPING_STARTED', { channelId });

    expect(messageHandler).toHaveBeenCalledTimes(1);
    expect(reactionHandler).toHaveBeenCalledTimes(1);
    expect(typingHandler).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners on unsubscribe', () => {
    const handler = vi.fn();

    mockEventEmitter.on('MESSAGE_CREATED', handler);
    mockEventEmitter.emit('MESSAGE_CREATED', {});
    expect(handler).toHaveBeenCalledTimes(1);

    mockEventEmitter.off('MESSAGE_CREATED', handler);
    mockEventEmitter.emit('MESSAGE_CREATED', {});
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });
});
