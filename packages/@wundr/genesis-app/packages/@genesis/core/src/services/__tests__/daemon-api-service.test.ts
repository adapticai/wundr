/**
 * @fileoverview Tests for DaemonApiService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockRedis, type MockRedis } from '../../test-utils/mock-redis';
import { createMockPrismaClient } from '../../test-utils/vp-factories';
import { DaemonApiService } from '../daemon-api-service';
import { DaemonAuthService } from '../daemon-auth-service';

import type { DaemonToken, DaemonScope } from '../../types/daemon';

// =============================================================================
// Extended Mock Redis with List Operations
// =============================================================================

interface ExtendedMockRedis extends MockRedis {
  lpush: ReturnType<typeof vi.fn>;
  rpush: ReturnType<typeof vi.fn>;
  lrange: ReturnType<typeof vi.fn>;
  ltrim: ReturnType<typeof vi.fn>;
}

function createExtendedMockRedis(): ExtendedMockRedis {
  const baseMock = createMockRedis();
  return {
    ...baseMock,
    lpush: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    ltrim: vi.fn().mockResolvedValue('OK'),
  } as ExtendedMockRedis;
}

// =============================================================================
// Mock Prisma Client Extension
// =============================================================================

function createExtendedMockPrisma() {
  const baseMock = createMockPrismaClient();

  return {
    ...baseMock,
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    messageAttachment: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    channelMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
    },
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('DaemonApiService', () => {
  let apiService: DaemonApiService;
  let authService: DaemonAuthService;
  let mockPrisma: ReturnType<typeof createExtendedMockPrisma>;
  let mockRedis: ExtendedMockRedis;

  const allScopes: DaemonScope[] = [
    'messages:read',
    'messages:write',
    'channels:read',
    'channels:join',
    'users:read',
    'presence:write',
    'vp:status',
    'vp:config',
  ];

  const mockToken: DaemonToken = {
    token: 'test-token',
    type: 'access',
    expiresAt: new Date(Date.now() + 3600000),
    daemonId: 'daemon-1',
    vpId: 'vp-1',
    workspaceId: 'ws-1',
    scopes: allScopes,
  };

  beforeEach(() => {
    mockPrisma = createExtendedMockPrisma();
    mockRedis = createExtendedMockRedis();

    authService = new DaemonAuthService({
      prisma: mockPrisma as unknown as Parameters<typeof DaemonAuthService['prototype']['constructor']>[0]['prisma'],
      redis: mockRedis as unknown as Parameters<typeof DaemonAuthService['prototype']['constructor']>[0]['redis'],
      jwtSecret: 'test-secret',
    });

    apiService = new DaemonApiService({
      prisma: mockPrisma as unknown as Parameters<typeof DaemonApiService['prototype']['constructor']>[0]['prisma'],
      redis: mockRedis as unknown as Parameters<typeof DaemonApiService['prototype']['constructor']>[0]['redis'],
      authService,
    });
  });

  // ===========================================================================
  // sendMessage Tests
  // ===========================================================================

  describe('sendMessage', () => {
    beforeEach(() => {
      // Setup VP lookup
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should send a message to a channel', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        channelId: 'ch-1',
        content: 'Hello',
        authorId: 'user-vp-1',
        createdAt: new Date(),
      });

      const messageId = await apiService.sendMessage(mockToken, {
        channelId: 'ch-1',
        content: 'Hello',
      });

      expect(messageId).toBe('msg-1');
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: { connect: { id: 'ch-1' } },
          content: 'Hello',
          author: { connect: { id: 'user-vp-1' } },
        }),
      });
      expect(mockRedis.publish).toHaveBeenCalled();
    });

    it('should handle attachments when sending a message', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        channelId: 'ch-1',
        content: 'Hello with attachment',
        authorId: 'user-vp-1',
        createdAt: new Date(),
      });
      mockPrisma.messageAttachment.createMany.mockResolvedValue({ count: 1 });

      const messageId = await apiService.sendMessage(mockToken, {
        channelId: 'ch-1',
        content: 'Hello with attachment',
        attachments: [
          {
            type: 'image/png',
            url: 'https://example.com/image.png',
            name: 'image.png',
            size: 1024,
          },
        ],
      });

      expect(messageId).toBe('msg-1');
      expect(mockPrisma.messageAttachment.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            messageId: 'msg-1',
            caption: 'image.png',
          }),
        ],
      });
    });

    it('should reject without channel access', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue(null);

      await expect(
        apiService.sendMessage(mockToken, { channelId: 'ch-1', content: 'Hello' }),
      ).rejects.toThrow('VP does not have access to this channel');
    });

    it('should reject without write scope', async () => {
      const limitedToken: DaemonToken = {
        ...mockToken,
        scopes: ['messages:read'] as DaemonScope[],
      };

      await expect(
        apiService.sendMessage(limitedToken, { channelId: 'ch-1', content: 'Hello' }),
      ).rejects.toThrow('Missing required scope');
    });
  });

  // ===========================================================================
  // getMessages Tests
  // ===========================================================================

  describe('getMessages', () => {
    beforeEach(() => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should get messages from channel', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          content: 'Hello',
          authorId: 'user-1',
          createdAt: new Date(),
          parentId: null,
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'John' },
      ]);

      const messages = await apiService.getMessages(mockToken, 'ch-1');

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello');
      expect(messages[0].authorName).toBe('John');
    });

    it('should support pagination with before cursor', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await apiService.getMessages(mockToken, 'ch-1', { limit: 10, before: 'msg-5' });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channelId: 'ch-1', id: { lt: 'msg-5' } },
          take: 10,
        }),
      );
    });

    it('should support pagination with after cursor', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await apiService.getMessages(mockToken, 'ch-1', { limit: 10, after: 'msg-5' });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channelId: 'ch-1', id: { gt: 'msg-5' } },
          take: 10,
        }),
      );
    });

    it('should limit results to max 100', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await apiService.getMessages(mockToken, 'ch-1', { limit: 500 });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  // ===========================================================================
  // getChannels Tests
  // ===========================================================================

  describe('getChannels', () => {
    beforeEach(() => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should return channels VP is member of', async () => {
      mockPrisma.channelMember.findMany.mockResolvedValue([
        {
          channel: {
            id: 'ch-1',
            name: 'general',
            description: 'General discussion',
            type: 'PUBLIC',
            _count: { members: 10 },
          },
        },
      ]);

      const channels = await apiService.getChannels(mockToken);

      expect(channels).toHaveLength(1);
      expect(channels[0]).toEqual({
        id: 'ch-1',
        name: 'general',
        description: 'General discussion',
        type: 'public',
        memberCount: 10,
        vpCanAccess: true,
      });
    });

    it('should mark private channels correctly', async () => {
      mockPrisma.channelMember.findMany.mockResolvedValue([
        {
          channel: {
            id: 'ch-2',
            name: 'private-channel',
            type: 'PRIVATE',
            _count: { members: 3 },
          },
        },
      ]);

      const channels = await apiService.getChannels(mockToken);

      expect(channels[0].type).toBe('private');
    });
  });

  // ===========================================================================
  // joinChannel Tests
  // ===========================================================================

  describe('joinChannel', () => {
    beforeEach(() => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should join a public channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({
        id: 'ch-1',
        name: 'general',
        type: 'PUBLIC',
      });
      mockPrisma.channelMember.upsert.mockResolvedValue({
        id: 'mem-1',
        channelId: 'ch-1',
        userId: 'user-vp-1',
      });

      await apiService.joinChannel(mockToken, 'ch-1');

      expect(mockPrisma.channelMember.upsert).toHaveBeenCalledWith({
        where: {
          channelId_userId: { channelId: 'ch-1', userId: 'user-vp-1' },
        },
        create: {
          channelId: 'ch-1',
          userId: 'user-vp-1',
          role: 'MEMBER',
        },
        update: {},
      });
    });

    it('should reject joining non-existent channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(apiService.joinChannel(mockToken, 'ch-404')).rejects.toThrow(
        'Channel not found',
      );
    });

    it('should reject joining private channel', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue({
        id: 'ch-1',
        type: 'PRIVATE',
      });

      await expect(apiService.joinChannel(mockToken, 'ch-1')).rejects.toThrow(
        'Cannot join private channel',
      );
    });
  });

  // ===========================================================================
  // leaveChannel Tests
  // ===========================================================================

  describe('leaveChannel', () => {
    beforeEach(() => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should leave a channel', async () => {
      mockPrisma.channelMember.deleteMany.mockResolvedValue({ count: 1 });

      await apiService.leaveChannel(mockToken, 'ch-1');

      expect(mockPrisma.channelMember.deleteMany).toHaveBeenCalledWith({
        where: { channelId: 'ch-1', userId: 'user-vp-1' },
      });
    });
  });

  // ===========================================================================
  // getUsers Tests
  // ===========================================================================

  describe('getUsers', () => {
    it('should return workspace users', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        {
          role: 'ADMIN',
          user: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ]);

      const users = await apiService.getUsers(mockToken);

      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'ADMIN',
        isOnline: false,
      });
    });

    it('should support search filter', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

      await apiService.getUsers(mockToken, { search: 'john' });

      expect(mockPrisma.workspaceMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-1',
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // updatePresence Tests
  // ===========================================================================

  describe('updatePresence', () => {
    it('should update VP presence to online', async () => {
      await apiService.updatePresence(mockToken, 'online', 'Working');

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalled();
    });

    it('should delete presence when offline', async () => {
      await apiService.updatePresence(mockToken, 'offline');

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should publish presence update', async () => {
      await apiService.updatePresence(mockToken, 'away', 'In a meeting');

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `workspace:${mockToken.workspaceId}:presence`,
        expect.stringContaining('away'),
      );
    });
  });

  // ===========================================================================
  // getConfig Tests
  // ===========================================================================

  describe('getConfig', () => {
    it('should return VP configuration', async () => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        capabilities: ['messaging', 'calls'],
      });

      const config = await apiService.getConfig(mockToken);

      expect(config.vpId).toBe('vp-1');
      expect(config.features.messaging).toBe(true);
      expect(config.features.calls).toBe(true);
    });

    it('should throw if VP not found', async () => {
      mockPrisma.vP.findUnique.mockResolvedValue(null);

      await expect(apiService.getConfig(mockToken)).rejects.toThrow('VP not found');
    });

    it('should handle VP without capabilities', async () => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        capabilities: null,
      });

      const config = await apiService.getConfig(mockToken);

      expect(config.features.calls).toBe(false);
      expect(config.features.fileAccess).toBe(false);
    });
  });

  // ===========================================================================
  // updateVPStatus Tests
  // ===========================================================================

  describe('updateVPStatus', () => {
    it('should update VP status', async () => {
      mockPrisma.vP.update.mockResolvedValue({
        id: 'vp-1',
        status: 'ONLINE',
      });

      await apiService.updateVPStatus(mockToken, 'active', 'Ready');

      expect(mockPrisma.vP.update).toHaveBeenCalledWith({
        where: { id: 'vp-1' },
        data: {
          status: 'ONLINE',
        },
      });
    });

    it('should update presence based on status', async () => {
      mockPrisma.vP.update.mockResolvedValue({});

      await apiService.updateVPStatus(mockToken, 'paused', 'Taking a break');

      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // reportMetrics Tests
  // ===========================================================================

  describe('reportMetrics', () => {
    it('should store metrics in Redis', async () => {
      await apiService.reportMetrics(mockToken, {
        messagesSent: 10,
        messagesReceived: 20,
        errors: 0,
      });

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `daemon:metrics:${mockToken.daemonId}`,
        expect.objectContaining({
          messagesSent: 10,
          messagesReceived: 20,
          errors: 0,
        }),
      );
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event Handling Tests
  // ===========================================================================

  describe('event handling', () => {
    beforeEach(() => {
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
    });

    it('should subscribe to channel', async () => {
      mockPrisma.channelMember.findFirst.mockResolvedValue({ id: 'mem-1' });

      const topic = await apiService.subscribeToChannel(mockToken, 'ch-1');

      expect(topic).toBe('channel:ch-1:messages');
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        `daemon:subscriptions:${mockToken.daemonId}`,
        'ch-1',
      );
    });

    it('should unsubscribe from channel', async () => {
      await apiService.unsubscribeFromChannel(mockToken, 'ch-1');

      expect(mockRedis.srem).toHaveBeenCalledWith(
        `daemon:subscriptions:${mockToken.daemonId}`,
        'ch-1',
      );
    });

    it('should get pending events', async () => {
      const mockEvent = {
        id: 'evt-1',
        type: 'message.received',
        daemonId: 'daemon-1',
        vpId: 'vp-1',
        payload: { messageId: 'msg-1' },
        timestamp: new Date().toISOString(),
      };
      mockRedis.lrange.mockResolvedValue([JSON.stringify(mockEvent)]);

      const events = await apiService.getPendingEvents(mockToken);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message.received');
    });

    it('should filter events by since date', async () => {
      const oldEvent = {
        id: 'evt-1',
        type: 'message.received',
        timestamp: new Date(Date.now() - 10000).toISOString(),
      };
      const newEvent = {
        id: 'evt-2',
        type: 'message.sent',
        timestamp: new Date().toISOString(),
      };
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify(oldEvent),
        JSON.stringify(newEvent),
      ]);

      const since = new Date(Date.now() - 5000);
      const events = await apiService.getPendingEvents(mockToken, since);

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt-2');
    });

    it('should acknowledge events', async () => {
      const events = [
        JSON.stringify({ id: 'evt-1' }),
        JSON.stringify({ id: 'evt-2' }),
      ];
      mockRedis.lrange.mockResolvedValue(events);

      await apiService.acknowledgeEvents(mockToken, ['evt-1']);

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ id: 'evt-2' }),
      );
    });
  });

  // ===========================================================================
  // Scope Validation Tests
  // ===========================================================================

  describe('scope validation', () => {
    it('should reject operations without required scope', async () => {
      const noScopeToken: DaemonToken = {
        ...mockToken,
        scopes: [],
      };

      await expect(apiService.getChannels(noScopeToken)).rejects.toThrow(
        'Missing required scope: channels:read',
      );
    });

    it('should allow operations with required scope', async () => {
      const channelReadToken: DaemonToken = {
        ...mockToken,
        scopes: ['channels:read'] as DaemonScope[],
      };
      mockPrisma.vP.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-vp-1',
      });
      mockPrisma.channelMember.findMany.mockResolvedValue([]);

      const channels = await apiService.getChannels(channelReadToken);

      expect(channels).toEqual([]);
    });
  });
});
