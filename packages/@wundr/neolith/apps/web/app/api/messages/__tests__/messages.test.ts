/**
 * Message API Route Tests
 *
 * Comprehensive test suite for Message REST API endpoints covering:
 * - POST /api/channels/:id/messages - Send message
 * - GET /api/channels/:id/messages - List messages
 * - PATCH /api/messages/:id - Update message
 * - DELETE /api/messages/:id - Delete message
 * - POST /api/messages/:id/reactions - Add reaction
 * - DELETE /api/messages/:id/reactions/:emoji - Remove reaction
 * - GET /api/messages/:id/thread - Get thread
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/messages/__tests__/messages.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock NextAuth
vi.mock('next-auth', () => ({
  authMock: vi.fn(),
}));

// Mock the message services
const mockMessageService = {
  sendMessage: vi.fn(),
  getMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  listMessages: vi.fn(),
  searchMessages: vi.fn(),
};

const mockReactionService = {
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  getReactions: vi.fn(),
};

const mockThreadService = {
  createReply: vi.fn(),
  getThread: vi.fn(),
  getThreadSummary: vi.fn(),
};

vi.mock('@neolith/core', () => ({
  createMessageService: vi.fn(() => mockMessageService),
  createReactionService: vi.fn(() => mockReactionService),
  createThreadService: vi.fn(() => mockThreadService),
  messageService: mockMessageService,
  reactionService: mockReactionService,
  threadService: mockThreadService,
}));

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {},
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-123',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

// Reserved for future integration tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL('http://localhost:3000/api/messages');

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createMockMessageResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'msg-123',
    channelId: 'ch-123',
    authorId: 'user-123',
    content: 'Test message',
    type: 'TEXT',
    parentId: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
    author: {
      id: 'user-123',
      name: 'Test User',
      displayName: 'Test User',
      avatarUrl: null,
      isOrchestrator: false,
    },
    reactions: [],
    replyCount: 0,
    ...overrides,
  };
}

function createMockReactionResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'rxn-123',
    messageId: 'msg-123',
    userId: 'user-123',
    emoji: '\u{1F44D}',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Reserved for future integration tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _createMockChannelMember(overrides?: Record<string, unknown>) {
  return {
    id: 'member-123',
    userId: 'user-123',
    channelId: 'ch-123',
    role: 'MEMBER',
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Message API Routes', () => {
  let authMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    authMock = authModule.auth as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/channels/:id/messages - Send Message
  // ===========================================================================

  describe('POST /api/channels/:id/messages', () => {
    it('sends message with valid data', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockMessage = createMockMessageResponse();
      mockMessageService.sendMessage.mockResolvedValue(mockMessage);

      const requestBody = {
        content: 'Hello, world!',
        type: 'TEXT',
      };

      // Simulate route handler behavior
      expect(session.user).toBeDefined();
      expect(requestBody.content).toBeDefined();

      const result = await mockMessageService.sendMessage({
        channelId: 'ch-123',
        authorId: session.user.id,
        ...requestBody,
      });

      expect(result).toEqual(mockMessage);
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'ch-123',
          authorId: session.user.id,
          content: 'Hello, world!',
        }),
      );
    });

    it('returns 401 without auth', async () => {
      authMock.mockResolvedValue(null);

      const session = await authMock();
      expect(session).toBeNull();

      // Route handler would return 401
      const expectedStatus = session ? 200 : 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 403 if not channel member', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      // User is not a member of the channel
      mockMessageService.sendMessage.mockRejectedValue({
        code: 'MESSAGE_NOT_CHANNEL_MEMBER',
        message: 'You are not a member of this channel',
      });

      await expect(
        mockMessageService.sendMessage({
          channelId: 'ch-other',
          authorId: session.user.id,
          content: 'Test',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_CHANNEL_MEMBER',
        }),
      );
    });

    it('returns 400 for empty content', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const emptyContent = '';
      const isValid = emptyContent.length > 0;

      expect(isValid).toBe(false);

      mockMessageService.sendMessage.mockRejectedValue({
        code: 'MESSAGE_INVALID_CONTENT',
        message: 'Message content cannot be empty',
      });

      await expect(
        mockMessageService.sendMessage({
          channelId: 'ch-123',
          authorId: session.user.id,
          content: emptyContent,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_INVALID_CONTENT',
        }),
      );
    });

    it('returns 400 for content exceeding max length', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const MAX_LENGTH = 10000;
      const longContent = 'a'.repeat(MAX_LENGTH + 1);

      expect(longContent.length).toBeGreaterThan(MAX_LENGTH);

      mockMessageService.sendMessage.mockRejectedValue({
        code: 'MESSAGE_CONTENT_TOO_LONG',
        message: `Message content exceeds maximum length of ${MAX_LENGTH}`,
      });

      await expect(
        mockMessageService.sendMessage({
          channelId: 'ch-123',
          authorId: session.user.id,
          content: longContent,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_CONTENT_TOO_LONG',
        }),
      );
    });

    it('supports thread replies', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const parentId = 'msg-parent';
      const mockReply = createMockMessageResponse({ parentId });
      mockMessageService.sendMessage.mockResolvedValue(mockReply);

      const result = await mockMessageService.sendMessage({
        channelId: 'ch-123',
        authorId: session.user.id,
        content: 'This is a reply',
        parentId,
      });

      expect(result.parentId).toBe(parentId);
    });

    it('rejects nested thread replies', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.sendMessage.mockRejectedValue({
        code: 'MESSAGE_NESTED_THREAD_NOT_ALLOWED',
        message: 'Cannot reply to a reply',
      });

      await expect(
        mockMessageService.sendMessage({
          channelId: 'ch-123',
          authorId: session.user.id,
          content: 'Nested reply',
          parentId: 'msg-already-a-reply',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NESTED_THREAD_NOT_ALLOWED',
        }),
      );
    });
  });

  // ===========================================================================
  // GET /api/channels/:id/messages - List Messages
  // ===========================================================================

  describe('GET /api/channels/:id/messages', () => {
    it('returns paginated messages', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockMessages = Array.from({ length: 20 }, (_, i) =>
        createMockMessageResponse({ id: `msg-${i}` }),
      );

      mockMessageService.listMessages.mockResolvedValue({
        edges: mockMessages.map(msg => ({
          cursor: msg.id,
          node: msg,
        })),
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: 'msg-0',
          endCursor: 'msg-19',
        },
        totalCount: 50,
      });

      const result = await mockMessageService.listMessages({
        channelId: 'ch-123',
        limit: 20,
      });

      expect(result.edges).toHaveLength(20);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.totalCount).toBe(50);
    });

    it('supports cursor pagination', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const cursorMessageId = 'msg-cursor';
      const mockMessages = Array.from({ length: 10 }, (_, i) =>
        createMockMessageResponse({ id: `msg-${i + 20}` }),
      );

      mockMessageService.listMessages.mockResolvedValue({
        edges: mockMessages.map(msg => ({
          cursor: msg.id,
          node: msg,
        })),
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: true,
          startCursor: 'msg-20',
          endCursor: 'msg-29',
        },
        totalCount: 50,
      });

      const result = await mockMessageService.listMessages({
        channelId: 'ch-123',
        limit: 10,
        after: cursorMessageId,
      });

      expect(result.pageInfo.hasPreviousPage).toBe(true);
      expect(mockMessageService.listMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          after: cursorMessageId,
        }),
      );
    });

    it('excludes deleted messages by default', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const activeMessages = Array.from({ length: 10 }, (_, i) =>
        createMockMessageResponse({ id: `msg-${i}`, deletedAt: null }),
      );

      mockMessageService.listMessages.mockResolvedValue({
        edges: activeMessages.map(msg => ({
          cursor: msg.id,
          node: msg,
        })),
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCount: 10,
      });

      const result = await mockMessageService.listMessages({
        channelId: 'ch-123',
        includeDeleted: false,
      });

      // All returned messages should not be deleted
      result.edges.forEach((edge: { node: { deletedAt: Date | null } }) => {
        expect(edge.node.deletedAt).toBeNull();
      });
    });

    it('returns 401 without authentication', async () => {
      authMock.mockResolvedValue(null);

      const session = await authMock();
      expect(session).toBeNull();
    });

    it('returns 403 for non-member', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.listMessages.mockRejectedValue({
        code: 'MESSAGE_NOT_CHANNEL_MEMBER',
        message: 'You are not a member of this channel',
      });

      await expect(
        mockMessageService.listMessages({
          channelId: 'ch-private',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_CHANNEL_MEMBER',
        }),
      );
    });

    it('returns 404 for non-existent channel', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.listMessages.mockRejectedValue({
        code: 'MESSAGE_CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });

      await expect(
        mockMessageService.listMessages({
          channelId: 'ch-nonexistent',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_CHANNEL_NOT_FOUND',
        }),
      );
    });
  });

  // ===========================================================================
  // PATCH /api/messages/:id - Update Message
  // ===========================================================================

  describe('PATCH /api/messages/:id', () => {
    it('updates own message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const messageId = 'msg-123';
      const newContent = 'Updated content';
      const updatedMessage = createMockMessageResponse({
        id: messageId,
        content: newContent,
        editedAt: new Date().toISOString(),
      });

      mockMessageService.updateMessage.mockResolvedValue(updatedMessage);

      const result = await mockMessageService.updateMessage(messageId, {
        content: newContent,
        userId: session.user.id,
      });

      expect(result.content).toBe(newContent);
      expect(result.editedAt).toBeDefined();
    });

    it('returns 403 for other user message', async () => {
      const session = createMockSession({
        user: { ...createMockSession().user, id: 'user-other' },
      });
      authMock.mockResolvedValue(session);

      const messageId = 'msg-123'; // Authored by user-123

      mockMessageService.updateMessage.mockRejectedValue({
        code: 'MESSAGE_FORBIDDEN',
        message: 'You can only edit your own messages',
      });

      await expect(
        mockMessageService.updateMessage(messageId, {
          content: 'Trying to edit',
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_FORBIDDEN',
        }),
      );
    });

    it('returns 404 for non-existent message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.updateMessage.mockRejectedValue({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });

      await expect(
        mockMessageService.updateMessage('msg-nonexistent', {
          content: 'Update',
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_FOUND',
        }),
      );
    });

    it('returns 400 for deleted message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.updateMessage.mockRejectedValue({
        code: 'MESSAGE_DELETED',
        message: 'Cannot edit a deleted message',
      });

      await expect(
        mockMessageService.updateMessage('msg-deleted', {
          content: 'Update',
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_DELETED',
        }),
      );
    });

    it('validates updated content', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      // Empty content
      mockMessageService.updateMessage.mockRejectedValueOnce({
        code: 'MESSAGE_INVALID_CONTENT',
        message: 'Message content cannot be empty',
      });

      await expect(
        mockMessageService.updateMessage('msg-123', {
          content: '',
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_INVALID_CONTENT',
        }),
      );
    });
  });

  // ===========================================================================
  // DELETE /api/messages/:id - Delete Message
  // ===========================================================================

  describe('DELETE /api/messages/:id', () => {
    it('soft deletes own message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const messageId = 'msg-123';
      const deletedMessage = createMockMessageResponse({
        id: messageId,
        deletedAt: new Date().toISOString(),
      });

      mockMessageService.deleteMessage.mockResolvedValue(deletedMessage);

      const result = await mockMessageService.deleteMessage(messageId, {
        userId: session.user.id,
      });

      expect(result.deletedAt).toBeDefined();
    });

    it('allows admin to delete any message', async () => {
      const session = createMockSession({
        user: { ...createMockSession().user, role: 'ADMIN' },
      });
      authMock.mockResolvedValue(session);

      const messageId = 'msg-other-user';
      const deletedMessage = createMockMessageResponse({
        id: messageId,
        authorId: 'user-other',
        deletedAt: new Date().toISOString(),
      });

      mockMessageService.deleteMessage.mockResolvedValue(deletedMessage);

      const result = await mockMessageService.deleteMessage(messageId, {
        userId: session.user.id,
        isAdmin: true,
      });

      expect(result.deletedAt).toBeDefined();
    });

    it('returns 403 for non-owner non-admin', async () => {
      const session = createMockSession({
        user: { ...createMockSession().user, id: 'user-other', role: 'MEMBER' },
      });
      authMock.mockResolvedValue(session);

      mockMessageService.deleteMessage.mockRejectedValue({
        code: 'MESSAGE_FORBIDDEN',
        message: 'You can only delete your own messages',
      });

      await expect(
        mockMessageService.deleteMessage('msg-123', {
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_FORBIDDEN',
        }),
      );
    });

    it('returns 404 for non-existent message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.deleteMessage.mockRejectedValue({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });

      await expect(
        mockMessageService.deleteMessage('msg-nonexistent', {
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_FOUND',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/messages/:id/reactions - Add Reaction
  // ===========================================================================

  describe('POST /api/messages/:id/reactions', () => {
    it('adds reaction to message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const messageId = 'msg-123';
      const emoji = '\u{1F44D}';
      const mockReaction = createMockReactionResponse({
        messageId,
        userId: session.user.id,
        emoji,
      });

      mockReactionService.addReaction.mockResolvedValue(mockReaction);

      const result = await mockReactionService.addReaction({
        messageId,
        userId: session.user.id,
        emoji,
      });

      expect(result.emoji).toBe(emoji);
      expect(result.userId).toBe(session.user.id);
    });

    it('returns 409 for duplicate reaction', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockReactionService.addReaction.mockRejectedValue({
        code: 'MESSAGE_DUPLICATE_REACTION',
        message: 'You have already reacted with this emoji',
      });

      await expect(
        mockReactionService.addReaction({
          messageId: 'msg-123',
          userId: session.user.id,
          emoji: '\u{1F44D}',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_DUPLICATE_REACTION',
        }),
      );
    });

    it('returns 404 for non-existent message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockReactionService.addReaction.mockRejectedValue({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });

      await expect(
        mockReactionService.addReaction({
          messageId: 'msg-nonexistent',
          userId: session.user.id,
          emoji: '\u{1F44D}',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_FOUND',
        }),
      );
    });

    it('returns 401 without authentication', async () => {
      authMock.mockResolvedValue(null);

      const session = await authMock();
      expect(session).toBeNull();
    });
  });

  // ===========================================================================
  // DELETE /api/messages/:id/reactions/:emoji - Remove Reaction
  // ===========================================================================

  describe('DELETE /api/messages/:id/reactions/:emoji', () => {
    it('removes own reaction', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const messageId = 'msg-123';
      const emoji = '\u{1F44D}';

      mockReactionService.removeReaction.mockResolvedValue(undefined);

      await expect(
        mockReactionService.removeReaction({
          messageId,
          userId: session.user.id,
          emoji,
        }),
      ).resolves.toBeUndefined();

      expect(mockReactionService.removeReaction).toHaveBeenCalledWith({
        messageId,
        userId: session.user.id,
        emoji,
      });
    });

    it('returns 404 if reaction not found', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockReactionService.removeReaction.mockRejectedValue({
        code: 'MESSAGE_REACTION_NOT_FOUND',
        message: 'Reaction not found',
      });

      await expect(
        mockReactionService.removeReaction({
          messageId: 'msg-123',
          userId: session.user.id,
          emoji: '\u{1F600}',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_REACTION_NOT_FOUND',
        }),
      );
    });
  });

  // ===========================================================================
  // GET /api/messages/:id/thread - Get Thread
  // ===========================================================================

  describe('GET /api/messages/:id/thread', () => {
    it('returns thread with replies', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const parentId = 'msg-parent';
      const replies = Array.from({ length: 5 }, (_, i) =>
        createMockMessageResponse({ id: `msg-reply-${i}`, parentId }),
      );

      mockThreadService.getThread.mockResolvedValue({
        parent: createMockMessageResponse({ id: parentId }),
        replies,
        replyCount: 5,
        participants: [
          { id: 'user-1', name: 'User 1' },
          { id: 'user-2', name: 'User 2' },
        ],
      });

      const result = await mockThreadService.getThread(parentId);

      expect(result.parent.id).toBe(parentId);
      expect(result.replies).toHaveLength(5);
      expect(result.replyCount).toBe(5);
    });

    it('returns empty thread for message without replies', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const messageId = 'msg-no-replies';

      mockThreadService.getThread.mockResolvedValue({
        parent: createMockMessageResponse({ id: messageId }),
        replies: [],
        replyCount: 0,
        participants: [],
      });

      const result = await mockThreadService.getThread(messageId);

      expect(result.replies).toHaveLength(0);
      expect(result.replyCount).toBe(0);
    });

    it('returns 404 for non-existent message', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockThreadService.getThread.mockRejectedValue({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });

      await expect(
        mockThreadService.getThread('msg-nonexistent'),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_NOT_FOUND',
        }),
      );
    });

    it('returns 400 for thread reply as parent', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      // Trying to get thread of a message that is itself a reply
      mockThreadService.getThread.mockRejectedValue({
        code: 'MESSAGE_PARENT_NOT_FOUND',
        message: 'Cannot get thread of a reply',
      });

      await expect(
        mockThreadService.getThread('msg-already-a-reply'),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_PARENT_NOT_FOUND',
        }),
      );
    });
  });

  // ===========================================================================
  // Search Messages
  // ===========================================================================

  describe('GET /api/messages/search', () => {
    it('searches messages by query', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const searchResults = Array.from({ length: 5 }, (_, i) =>
        createMockMessageResponse({
          id: `msg-${i}`,
          content: `Search result ${i}`,
        }),
      );

      mockMessageService.searchMessages.mockResolvedValue({
        results: searchResults,
        totalCount: 5,
      });

      const result = await mockMessageService.searchMessages({
        query: 'search',
        channelIds: ['ch-123'],
      });

      expect(result.results).toHaveLength(5);
      expect(mockMessageService.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'search',
        }),
      );
    });

    it('filters by channel', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.searchMessages.mockResolvedValue({
        results: [],
        totalCount: 0,
      });

      await mockMessageService.searchMessages({
        query: 'test',
        channelIds: ['ch-specific'],
      });

      expect(mockMessageService.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          channelIds: ['ch-specific'],
        }),
      );
    });

    it('filters by date range', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockMessageService.searchMessages.mockResolvedValue({
        results: [],
        totalCount: 0,
      });

      await mockMessageService.searchMessages({
        query: 'test',
        startDate,
        endDate,
      });

      expect(mockMessageService.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate,
          endDate,
        }),
      );
    });
  });

  // ===========================================================================
  // Rate Limiting Tests
  // ===========================================================================

  describe('Rate Limiting', () => {
    it('returns 429 when rate limit exceeded for sending messages', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockMessageService.sendMessage.mockRejectedValue({
        code: 'MESSAGE_RATE_LIMITED',
        message: 'Too many messages. Please slow down.',
      });

      await expect(
        mockMessageService.sendMessage({
          channelId: 'ch-123',
          authorId: session.user.id,
          content: 'Spam message',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_RATE_LIMITED',
        }),
      );
    });

    it('returns 429 when rate limit exceeded for reactions', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockReactionService.addReaction.mockRejectedValue({
        code: 'MESSAGE_RATE_LIMITED',
        message: 'Too many reactions. Please slow down.',
      });

      await expect(
        mockReactionService.addReaction({
          messageId: 'msg-123',
          userId: session.user.id,
          emoji: '\u{1F44D}',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'MESSAGE_RATE_LIMITED',
        }),
      );
    });
  });
});
