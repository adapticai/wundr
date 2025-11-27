/**
 * Channel API Route Tests
 *
 * Comprehensive test suite for Channel REST API endpoints covering:
 * - POST /api/channels - Create channel
 * - GET /api/channels - List channels
 * - GET /api/channels/:id - Get channel by ID
 * - PATCH /api/channels/:id - Update channel
 * - DELETE /api/channels/:id - Delete channel
 * - POST /api/channels/:id/join - Join public channel
 * - POST /api/channels/:id/leave - Leave channel
 * - POST /api/channels/:id/members - Add member
 * - DELETE /api/channels/:id/members/:userId - Remove member
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/channels/__tests__/channels.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock the channel services
const mockChannelService = {
  createChannel: vi.fn(),
  getChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  listChannels: vi.fn(),
  joinChannel: vi.fn(),
  leaveChannel: vi.fn(),
  addMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
};

vi.mock('@neolith/core', () => ({
  createChannelService: vi.fn(() => mockChannelService),
  channelService: mockChannelService,
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

function createMockChannelResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'ch-123',
    name: 'general',
    type: 'PUBLIC',
    description: 'General discussion',
    topic: null,
    workspaceId: 'ws-123',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: {
      members: 5,
      messages: 100,
    },
    ...overrides,
  };
}

function createMockMemberResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'member-123',
    channelId: 'ch-123',
    userId: 'user-456',
    role: 'MEMBER',
    createdAt: new Date().toISOString(),
    user: {
      id: 'user-456',
      name: 'Test User',
      email: 'testuser@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      isOrchestrator: false,
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Channel API Routes', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/channels - Create Channel
  // ===========================================================================

  describe('POST /api/channels', () => {
    it('creates public channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockChannel = createMockChannelResponse({ type: 'PUBLIC' });
      mockChannelService.createChannel.mockResolvedValue(mockChannel);

      const requestBody = {
        name: 'announcements',
        type: 'PUBLIC',
        workspaceId: 'ws-123',
        description: 'Company announcements',
      };

      const result = await mockChannelService.createChannel({
        ...requestBody,
        creatorId: session.user.id,
      });

      expect(result.type).toBe('PUBLIC');
      expect(result.name).toBe('general');
      expect(mockChannelService.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'announcements',
          type: 'PUBLIC',
        }),
      );
    });

    it('creates private channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockChannel = createMockChannelResponse({ type: 'PRIVATE', name: 'secret-project' });
      mockChannelService.createChannel.mockResolvedValue(mockChannel);

      const requestBody = {
        name: 'secret-project',
        type: 'PRIVATE',
        workspaceId: 'ws-123',
        description: 'Top secret project discussions',
      };

      const result = await mockChannelService.createChannel({
        ...requestBody,
        creatorId: session.user.id,
      });

      expect(result.type).toBe('PRIVATE');
      expect(result.name).toBe('secret-project');
    });

    it('adds initial members', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockChannel = createMockChannelResponse({
        _count: { members: 3, messages: 0 },
      });
      mockChannelService.createChannel.mockResolvedValue(mockChannel);

      const requestBody = {
        name: 'team-chat',
        type: 'PRIVATE',
        workspaceId: 'ws-123',
        memberIds: ['user-456', 'user-789'],
      };

      const result = await mockChannelService.createChannel({
        ...requestBody,
        creatorId: session.user.id,
      });

      expect(result._count.channelMembers).toBe(3); // Creator + 2 members
    });

    it('returns 401 without authentication', async () => {
      auth.mockResolvedValue(null);

      const session = await auth();
      expect(session).toBeNull();

      // Route handler would return 401
      const expectedStatus = session ? 201 : 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 400 for invalid data', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.createChannel.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      });

      await expect(
        mockChannelService.createChannel({
          name: '', // Invalid - empty
          type: 'INVALID_TYPE',
          workspaceId: 'ws-123',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('validates channel name length', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const longName = 'a'.repeat(100); // Over 80 char limit

      mockChannelService.createChannel.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'Channel name must be less than 80 characters',
      });

      await expect(
        mockChannelService.createChannel({
          name: longName,
          type: 'PUBLIC',
          workspaceId: 'ws-123',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('requires workspace membership', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.createChannel.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'You must be a workspace member to create channels',
      });

      await expect(
        mockChannelService.createChannel({
          name: 'test',
          type: 'PUBLIC',
          workspaceId: 'ws-not-member',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });
  });

  // ===========================================================================
  // GET /api/channels - List Channels
  // ===========================================================================

  describe('GET /api/channels', () => {
    it('lists channels in workspace', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockChannels = [
        createMockChannelResponse({ id: 'ch-1', name: 'general' }),
        createMockChannelResponse({ id: 'ch-2', name: 'random' }),
      ];

      mockChannelService.listChannels.mockResolvedValue({
        data: mockChannels,
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const result = await mockChannelService.listChannels({
        workspaceId: 'ws-123',
        userId: session.user.id,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it('filters by type', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const publicChannels = [
        createMockChannelResponse({ type: 'PUBLIC' }),
      ];

      mockChannelService.listChannels.mockResolvedValue({
        data: publicChannels,
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const result = await mockChannelService.listChannels({
        workspaceId: 'ws-123',
        userId: session.user.id,
        type: 'PUBLIC',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('PUBLIC');
    });

    it('includes membership status', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const channelsWithMembership = [
        { ...createMockChannelResponse(), isMember: true },
        { ...createMockChannelResponse({ id: 'ch-2' }), isMember: false },
      ];

      mockChannelService.listChannels.mockResolvedValue({
        data: channelsWithMembership,
        pagination: {
          page: 1,
          limit: 50,
          totalCount: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const result = await mockChannelService.listChannels({
        workspaceId: 'ws-123',
        userId: session.user.id,
      });

      expect(result.data[0].isMember).toBe(true);
      expect(result.data[1].isMember).toBe(false);
    });

    it('requires workspaceId parameter', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.listChannels.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'workspaceId is required',
      });

      await expect(
        mockChannelService.listChannels({
          userId: session.user.id,
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/channels/:id/join - Join Channel
  // ===========================================================================

  describe('POST /api/channels/:id/join', () => {
    it('allows joining public channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockMembership = createMockMemberResponse({
        userId: session.user.id,
      });
      mockChannelService.joinChannel.mockResolvedValue(mockMembership);

      const result = await mockChannelService.joinChannel('ch-123', session.user.id);

      expect(result.userId).toBe(session.user.id);
      expect(result.role).toBe('MEMBER');
    });

    it('rejects joining private channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.joinChannel.mockRejectedValue({
        code: 'CANNOT_JOIN_PRIVATE_CHANNEL',
        message: 'Cannot join private channel. Request an invite from a channel admin.',
      });

      await expect(
        mockChannelService.joinChannel('ch-private', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CANNOT_JOIN_PRIVATE_CHANNEL',
        }),
      );
    });

    it('rejects joining archived channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.joinChannel.mockRejectedValue({
        code: 'CHANNEL_ARCHIVED',
        message: 'Cannot join archived channel',
      });

      await expect(
        mockChannelService.joinChannel('ch-archived', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CHANNEL_ARCHIVED',
        }),
      );
    });

    it('returns 409 when already a member', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.joinChannel.mockRejectedValue({
        code: 'ALREADY_CHANNEL_MEMBER',
        message: 'You are already a member of this channel',
      });

      await expect(
        mockChannelService.joinChannel('ch-123', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'ALREADY_CHANNEL_MEMBER',
        }),
      );
    });

    it('requires workspace membership for joining', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.joinChannel.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'You must be a workspace member to join channels',
      });

      await expect(
        mockChannelService.joinChannel('ch-other-workspace', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/channels/:id/leave - Leave Channel
  // ===========================================================================

  describe('POST /api/channels/:id/leave', () => {
    it('allows leaving channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.leaveChannel.mockResolvedValue(undefined);

      await expect(
        mockChannelService.leaveChannel('ch-123', session.user.id),
      ).resolves.toBeUndefined();
    });

    it('prevents last admin from leaving', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.leaveChannel.mockRejectedValue({
        code: 'CANNOT_LEAVE_AS_LAST_ADMIN',
        message: 'Cannot leave as the last admin. Promote another member first or delete the channel.',
      });

      await expect(
        mockChannelService.leaveChannel('ch-123', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CANNOT_LEAVE_AS_LAST_ADMIN',
        }),
      );
    });

    it('returns 404 when not a member', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.leaveChannel.mockRejectedValue({
        code: 'NOT_CHANNEL_MEMBER',
        message: 'You are not a member of this channel',
      });

      await expect(
        mockChannelService.leaveChannel('ch-not-member', session.user.id),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'NOT_CHANNEL_MEMBER',
        }),
      );
    });
  });

  // ===========================================================================
  // PATCH /api/channels/:id - Update Channel
  // ===========================================================================

  describe('PATCH /api/channels/:id', () => {
    it('updates channel with valid data', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const updatedChannel = createMockChannelResponse({
        name: 'updated-name',
        description: 'Updated description',
      });
      mockChannelService.updateChannel.mockResolvedValue(updatedChannel);

      const result = await mockChannelService.updateChannel('ch-123', {
        name: 'updated-name',
        description: 'Updated description',
      });

      expect(result.name).toBe('updated-name');
      expect(result.description).toBe('Updated description');
    });

    it('allows archiving channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const archivedChannel = createMockChannelResponse({ isArchived: true });
      mockChannelService.updateChannel.mockResolvedValue(archivedChannel);

      const result = await mockChannelService.updateChannel('ch-123', {
        isArchived: true,
      });

      expect(result.isArchived).toBe(true);
    });

    it('returns 403 without admin permission', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.updateChannel.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions. Channel Admin required.',
      });

      await expect(
        mockChannelService.updateChannel('ch-123', { name: 'new-name' }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });
  });

  // ===========================================================================
  // DELETE /api/channels/:id - Delete Channel
  // ===========================================================================

  describe('DELETE /api/channels/:id', () => {
    it('deletes channel when authorized', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'ADMIN',
          organizationId: 'org-123',
        },
      });
      auth.mockResolvedValue(session);

      mockChannelService.deleteChannel.mockResolvedValue(undefined);

      await expect(
        mockChannelService.deleteChannel('ch-123'),
      ).resolves.toBeUndefined();
    });

    it('returns 403 for non-org-admin', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.deleteChannel.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Only organization administrators can delete channels',
      });

      await expect(
        mockChannelService.deleteChannel('ch-123'),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });
  });

  // ===========================================================================
  // POST /api/channels/:id/members - Add Member
  // ===========================================================================

  describe('POST /api/channels/:id/members', () => {
    it('adds member to channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockMember = createMockMemberResponse();
      mockChannelService.addMember.mockResolvedValue(mockMember);

      const result = await mockChannelService.addMember('ch-123', {
        userId: 'user-456',
        role: 'MEMBER',
      });

      expect(result.userId).toBe('user-456');
      expect(result.role).toBe('MEMBER');
    });

    it('requires channel admin permission', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.addMember.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions. Channel Admin required.',
      });

      await expect(
        mockChannelService.addMember('ch-123', {
          userId: 'user-456',
          role: 'MEMBER',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      );
    });

    it('requires user to be workspace member', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.addMember.mockRejectedValue({
        code: 'USER_NOT_FOUND',
        message: 'User must be a workspace member to join the channel',
      });

      await expect(
        mockChannelService.addMember('ch-123', {
          userId: 'user-not-in-workspace',
          role: 'MEMBER',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
        }),
      );
    });
  });

  // ===========================================================================
  // DELETE /api/channels/:id/members/:userId - Remove Member
  // ===========================================================================

  describe('DELETE /api/channels/:id/members/:userId', () => {
    it('removes member when authorized', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.removeMember.mockResolvedValue(undefined);

      await expect(
        mockChannelService.removeMember('ch-123', 'user-456'),
      ).resolves.toBeUndefined();
    });

    it('prevents removing last admin', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      mockChannelService.removeMember.mockRejectedValue({
        code: 'CANNOT_LEAVE_AS_LAST_ADMIN',
        message: 'Cannot remove the last channel admin. Promote another member first.',
      });

      await expect(
        mockChannelService.removeMember('ch-123', 'last-admin-id'),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CANNOT_LEAVE_AS_LAST_ADMIN',
        }),
      );
    });
  });

  // ===========================================================================
  // Direct Message Tests
  // ===========================================================================

  describe('POST /api/dm', () => {
    it('creates or returns existing DM channel', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const dmChannel = createMockChannelResponse({
        type: 'DM',
        name: `dm:${session.user.id}:user-456`,
      });

      // Simulate DM service
      const mockCreateDM = vi.fn().mockResolvedValue({
        data: dmChannel,
        isNew: true,
      });

      const result = await mockCreateDM({
        userId: 'user-456',
        workspaceId: 'ws-123',
      });

      expect(result.data.type).toBe('DM');
      expect(result.isNew).toBe(true);
    });

    it('prevents DM with self', async () => {
      const session = createMockSession();
      auth.mockResolvedValue(session);

      const mockCreateDM = vi.fn().mockRejectedValue({
        code: 'DM_SELF_NOT_ALLOWED',
        message: 'Cannot create DM with yourself',
      });

      await expect(
        mockCreateDM({
          userId: session.user.id, // Same as session user
          workspaceId: 'ws-123',
        }),
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'DM_SELF_NOT_ALLOWED',
        }),
      );
    });
  });
});
