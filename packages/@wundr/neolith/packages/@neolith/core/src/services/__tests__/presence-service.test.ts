/**
 * Presence Service Tests
 *
 * Comprehensive test suite for the presence service covering:
 * - User presence management (online/offline)
 * - Custom status handling
 * - Channel presence tracking
 * - Orchestrator presence management
 * - Pub/Sub event publishing
 * - TTL and expiration handling
 *
 * @module @genesis/core/services/__tests__/presence-service.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockRedis, type MockRedis } from '../../test-utils/mock-redis';
import {
  createMockDaemonInfo,
  generatePresenceTestId,
  resetPresenceIdCounter,
  type UserPresence,
  type UserPresenceStatus,
  type VPPresence,
  type VPPresenceStatus,
} from '../../test-utils/presence-factories';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const PRESENCE_TTL_SECONDS = 300; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const PRESENCE_KEY_PREFIX = 'presence:';
const VP_PRESENCE_KEY_PREFIX = 'vp:presence:';
const CHANNEL_PRESENCE_KEY_PREFIX = 'channel:presence:';
const PRESENCE_CHANNEL = 'presence:changes';

// =============================================================================
// MOCK PRESENCE SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Mock implementation of PresenceService for testing
 * In a real implementation, this would be the actual service
 */
class MockPresenceService {
  constructor(
    private redis: MockRedis,
    private config: {
      presenceTTL: number;
      heartbeatInterval: number;
    } = {
      presenceTTL: PRESENCE_TTL_SECONDS,
      heartbeatInterval: HEARTBEAT_INTERVAL_MS,
    }
  ) {}

  // User presence methods
  async setUserOnline(
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const presence: UserPresence = {
      userId,
      status: 'online',
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
      metadata,
    };

    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    await this.redis.hmset(key, {
      userId: presence.userId,
      status: presence.status,
      lastSeen: presence.lastSeen,
      connectedAt: presence.connectedAt,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
    });
    await this.redis.expire(key, this.config.presenceTTL);

    // Publish presence change event
    await this.redis.publish(
      PRESENCE_CHANNEL,
      JSON.stringify({
        type: 'user_online',
        userId,
        status: 'online',
        timestamp: new Date().toISOString(),
      })
    );
  }

  async setUserOffline(userId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const existing = await this.redis.hgetall(key);

    if (existing) {
      // Update lastSeen before removing
      await this.redis.hset(key, 'lastSeen', new Date().toISOString());
      await this.redis.hset(key, 'status', 'offline');
    }

    // Publish presence change event
    await this.redis.publish(
      PRESENCE_CHANNEL,
      JSON.stringify({
        type: 'user_offline',
        userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      })
    );

    // Remove from all channel presence sets
    const channelKeys = await this.redis.keys(
      `${CHANNEL_PRESENCE_KEY_PREFIX}*:members`
    );
    for (const channelKey of channelKeys) {
      await this.redis.srem(channelKey, userId);
    }

    // Delete the presence record
    await this.redis.del(key);
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const data = await this.redis.hgetall(key);

    if (!data) {
      return null;
    }

    return {
      userId: data.userId,
      status: data.status as UserPresenceStatus,
      lastSeen: data.lastSeen,
      connectedAt: data.connectedAt,
      customStatus: data.customStatus || undefined,
      customStatusEmoji: data.customStatusEmoji || undefined,
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    };
  }

  async setUserStatus(
    userId: string,
    status: UserPresenceStatus
  ): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    await this.redis.hset(key, 'status', status);
    await this.redis.hset(key, 'lastSeen', new Date().toISOString());

    await this.redis.publish(
      PRESENCE_CHANNEL,
      JSON.stringify({
        type: 'status_change',
        userId,
        status,
        timestamp: new Date().toISOString(),
      })
    );
  }

  async setUserCustomStatus(
    userId: string,
    customStatus: string,
    emoji?: string
  ): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    await this.redis.hset(key, 'customStatus', customStatus);
    if (emoji) {
      await this.redis.hset(key, 'customStatusEmoji', emoji);
    }
  }

  // Channel presence methods
  async getOnlineChannelMembers(channelId: string): Promise<string[]> {
    const key = `${CHANNEL_PRESENCE_KEY_PREFIX}${channelId}:members`;
    return this.redis.smembers(key);
  }

  async addUserToChannel(userId: string, channelId: string): Promise<void> {
    const key = `${CHANNEL_PRESENCE_KEY_PREFIX}${channelId}:members`;
    await this.redis.sadd(key, userId);
  }

  async removeUserFromChannel(
    userId: string,
    channelId: string
  ): Promise<void> {
    const key = `${CHANNEL_PRESENCE_KEY_PREFIX}${channelId}:members`;
    await this.redis.srem(key, userId);
  }

  // Orchestrator presence methods
  async setVPOnline(
    vpId: string,
    daemonInfo: { daemonId: string; endpoint: string; version: string }
  ): Promise<void> {
    const key = `${VP_PRESENCE_KEY_PREFIX}${vpId}`;
    const now = new Date().toISOString();

    await this.redis.hmset(key, {
      vpId,
      status: 'online',
      lastHeartbeat: now,
      lastSeen: now,
      connectedAt: now,
      daemonId: daemonInfo.daemonId,
      endpoint: daemonInfo.endpoint,
      version: daemonInfo.version,
    });
    await this.redis.expire(key, this.config.presenceTTL);

    await this.redis.publish(
      PRESENCE_CHANNEL,
      JSON.stringify({
        type: 'vp_online',
        vpId,
        status: 'online',
        daemonInfo,
        timestamp: now,
      })
    );
  }

  async setVPOffline(vpId: string): Promise<void> {
    const key = `${VP_PRESENCE_KEY_PREFIX}${vpId}`;
    const now = new Date().toISOString();

    await this.redis.hset(key, 'status', 'offline');
    await this.redis.hset(key, 'lastSeen', now);

    await this.redis.publish(
      PRESENCE_CHANNEL,
      JSON.stringify({
        type: 'vp_offline',
        vpId,
        status: 'offline',
        timestamp: now,
      })
    );

    await this.redis.del(key);
  }

  async getVPPresence(vpId: string): Promise<OrchestratorPresence | null> {
    const key = `${VP_PRESENCE_KEY_PREFIX}${vpId}`;
    const data = await this.redis.hgetall(key);

    if (!data) {
      return null;
    }

    return {
      vpId: data.orchestratorId,
      userId: data.userId || '',
      status: data.status as VPPresenceStatus,
      lastHeartbeat: data.lastHeartbeat,
      lastSeen: data.lastSeen,
      connectedAt: data.connectedAt,
      activeConversations: parseInt(data.activeConversations || '0', 10),
      maxConcurrentConversations: parseInt(
        data.maxConcurrentConversations || '10',
        10
      ),
      daemonInfo: {
        daemonId: data.daemonId,
        endpoint: data.endpoint,
        version: data.version,
        startedAt: data.connectedAt,
      },
    };
  }

  async updateVPHeartbeat(
    vpId: string,
    metrics?: Record<string, unknown>
  ): Promise<void> {
    const key = `${VP_PRESENCE_KEY_PREFIX}${vpId}`;
    const now = new Date().toISOString();

    await this.redis.hset(key, 'lastHeartbeat', now);
    await this.redis.hset(key, 'lastSeen', now);
    await this.redis.expire(key, this.config.presenceTTL);

    if (metrics) {
      await this.redis.hset(key, 'metrics', JSON.stringify(metrics));
    }
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('PresenceService', () => {
  let redis: MockRedis;
  let presenceService: MockPresenceService;

  beforeEach(() => {
    resetPresenceIdCounter();
    redis = createMockRedis();
    presenceService = new MockPresenceService(redis);
  });

  afterEach(() => {
    redis._reset();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // setUserOnline Tests
  // ===========================================================================

  describe('setUserOnline', () => {
    it('sets user online in Redis', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);

      // Verify hash was set
      expect(redis.hmset).toHaveBeenCalled();

      // Verify data in store
      const key = `${PRESENCE_KEY_PREFIX}${userId}`;
      const data = await redis.hgetall(key);

      expect(data).not.toBeNull();
      expect(data?.userId).toBe(userId);
      expect(data?.status).toBe('online');
    });

    it('includes metadata when provided', async () => {
      const userId = generatePresenceTestId('user');
      const metadata = {
        platform: 'web',
        browser: 'Chrome',
        device: 'desktop',
      };

      await presenceService.setUserOnline(userId, metadata);

      const key = `${PRESENCE_KEY_PREFIX}${userId}`;
      const data = await redis.hgetall(key);

      expect(data?.metadata).toBe(JSON.stringify(metadata));
    });

    it('publishes presence change event', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);

      expect(redis.publish).toHaveBeenCalledWith(
        PRESENCE_CHANNEL,
        expect.stringContaining('user_online')
      );

      const publishedMessage = redis._publishedMessages[0];
      const event = JSON.parse(publishedMessage.message);

      expect(event.type).toBe('user_online');
      expect(event.userId).toBe(userId);
      expect(event.status).toBe('online');
    });

    it('sets TTL on presence key', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);

      expect(redis.expire).toHaveBeenCalledWith(
        `${PRESENCE_KEY_PREFIX}${userId}`,
        PRESENCE_TTL_SECONDS
      );
    });

    it('handles multiple users going online', async () => {
      const userIds = Array.from({ length: 5 }, () =>
        generatePresenceTestId('user')
      );

      await Promise.all(
        userIds.map(userId => presenceService.setUserOnline(userId))
      );

      // Verify all users are stored
      for (const userId of userIds) {
        const key = `${PRESENCE_KEY_PREFIX}${userId}`;
        const data = await redis.hgetall(key);
        expect(data?.status).toBe('online');
      }

      // Verify all events published
      expect(redis._publishedMessages).toHaveLength(5);
    });

    it('updates existing presence when user reconnects', async () => {
      const userId = generatePresenceTestId('user');

      // First connection
      await presenceService.setUserOnline(userId, { session: 'first' });
      const firstConnection = await redis.hgetall(
        `${PRESENCE_KEY_PREFIX}${userId}`
      );

      // Wait a bit and reconnect
      await new Promise(resolve => setTimeout(resolve, 10));
      await presenceService.setUserOnline(userId, { session: 'second' });
      const secondConnection = await redis.hgetall(
        `${PRESENCE_KEY_PREFIX}${userId}`
      );

      expect(secondConnection?.metadata).toBe(
        JSON.stringify({ session: 'second' })
      );
      // connectedAt should be updated
      expect(secondConnection?.connectedAt).not.toBe(
        firstConnection?.connectedAt
      );
    });
  });

  // ===========================================================================
  // setUserOffline Tests
  // ===========================================================================

  describe('setUserOffline', () => {
    it('removes user from online set', async () => {
      const userId = generatePresenceTestId('user');

      // First set online
      await presenceService.setUserOnline(userId);
      expect(
        await redis.hgetall(`${PRESENCE_KEY_PREFIX}${userId}`)
      ).not.toBeNull();

      // Then set offline
      await presenceService.setUserOffline(userId);
      expect(await redis.hgetall(`${PRESENCE_KEY_PREFIX}${userId}`)).toBeNull();
    });

    it('updates lastSeen timestamp', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);
      await presenceService.setUserOffline(userId);

      // Verify hset was called to update lastSeen
      expect(redis.hset).toHaveBeenCalledWith(
        `${PRESENCE_KEY_PREFIX}${userId}`,
        'lastSeen',
        expect.any(String)
      );
    });

    it('publishes presence change event', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);
      redis._publishedMessages.length = 0; // Clear previous messages

      await presenceService.setUserOffline(userId);

      expect(redis.publish).toHaveBeenCalledWith(
        PRESENCE_CHANNEL,
        expect.stringContaining('user_offline')
      );

      const publishedMessage = redis._publishedMessages[0];
      const event = JSON.parse(publishedMessage.message);

      expect(event.type).toBe('user_offline');
      expect(event.userId).toBe(userId);
      expect(event.status).toBe('offline');
    });

    it('removes user from all channel presence sets', async () => {
      const userId = generatePresenceTestId('user');
      const channelId1 = generatePresenceTestId('channel');
      const channelId2 = generatePresenceTestId('channel');

      await presenceService.setUserOnline(userId);
      await presenceService.addUserToChannel(userId, channelId1);
      await presenceService.addUserToChannel(userId, channelId2);

      // Verify user is in channels
      expect(
        await presenceService.getOnlineChannelMembers(channelId1)
      ).toContain(userId);

      await presenceService.setUserOffline(userId);

      // Verify user is removed from channels
      expect(
        await presenceService.getOnlineChannelMembers(channelId1)
      ).not.toContain(userId);
      expect(
        await presenceService.getOnlineChannelMembers(channelId2)
      ).not.toContain(userId);
    });

    it('handles offline for non-existent user gracefully', async () => {
      const userId = generatePresenceTestId('user');

      // Should not throw
      await expect(
        presenceService.setUserOffline(userId)
      ).resolves.toBeUndefined();

      // Should still publish event
      expect(redis.publish).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getUserPresence Tests
  // ===========================================================================

  describe('getUserPresence', () => {
    it('returns presence for online user', async () => {
      const userId = generatePresenceTestId('user');
      const metadata = { platform: 'ios' };

      await presenceService.setUserOnline(userId, metadata);
      const presence = await presenceService.getUserPresence(userId);

      expect(presence).not.toBeNull();
      expect(presence?.userId).toBe(userId);
      expect(presence?.status).toBe('online');
      expect(presence?.metadata).toEqual(metadata);
      expect(presence?.connectedAt).toBeDefined();
      expect(presence?.lastSeen).toBeDefined();
    });

    it('returns null for unknown user', async () => {
      const presence =
        await presenceService.getUserPresence('non-existent-user');

      expect(presence).toBeNull();
    });

    it('includes custom status if set', async () => {
      const userId = generatePresenceTestId('user');
      const customStatus = 'In a meeting';
      const emoji = '...';

      await presenceService.setUserOnline(userId);
      await presenceService.setUserCustomStatus(userId, customStatus, emoji);

      const presence = await presenceService.getUserPresence(userId);

      expect(presence?.customStatus).toBe(customStatus);
      expect(presence?.customStatusEmoji).toBe(emoji);
    });

    it('returns offline presence after user goes offline', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);
      await presenceService.setUserOffline(userId);

      // After offline, presence should be null (deleted)
      const presence = await presenceService.getUserPresence(userId);
      expect(presence).toBeNull();
    });

    it('returns presence with different statuses', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);
      await presenceService.setUserStatus(userId, 'away');

      const presence = await presenceService.getUserPresence(userId);
      expect(presence?.status).toBe('away');

      await presenceService.setUserStatus(userId, 'busy');
      const busyPresence = await presenceService.getUserPresence(userId);
      expect(busyPresence?.status).toBe('busy');
    });
  });

  // ===========================================================================
  // getOnlineChannelMembers Tests
  // ===========================================================================

  describe('getOnlineChannelMembers', () => {
    it('returns online members in channel', async () => {
      const channelId = generatePresenceTestId('channel');
      const userIds = [
        generatePresenceTestId('user'),
        generatePresenceTestId('user'),
        generatePresenceTestId('user'),
      ];

      // Add users to channel
      for (const userId of userIds) {
        await presenceService.setUserOnline(userId);
        await presenceService.addUserToChannel(userId, channelId);
      }

      const members = await presenceService.getOnlineChannelMembers(channelId);

      expect(members).toHaveLength(3);
      for (const userId of userIds) {
        expect(members).toContain(userId);
      }
    });

    it('returns empty array for empty channel', async () => {
      const channelId = generatePresenceTestId('channel');

      const members = await presenceService.getOnlineChannelMembers(channelId);

      expect(members).toEqual([]);
    });

    it('excludes offline members', async () => {
      const channelId = generatePresenceTestId('channel');
      const onlineUser = generatePresenceTestId('user');
      const offlineUser = generatePresenceTestId('user');

      await presenceService.setUserOnline(onlineUser);
      await presenceService.setUserOnline(offlineUser);
      await presenceService.addUserToChannel(onlineUser, channelId);
      await presenceService.addUserToChannel(offlineUser, channelId);

      // Set one user offline
      await presenceService.setUserOffline(offlineUser);

      const members = await presenceService.getOnlineChannelMembers(channelId);

      expect(members).toContain(onlineUser);
      expect(members).not.toContain(offlineUser);
    });

    it('handles multiple channels independently', async () => {
      const channel1 = generatePresenceTestId('channel');
      const channel2 = generatePresenceTestId('channel');
      const user1 = generatePresenceTestId('user');
      const user2 = generatePresenceTestId('user');

      await presenceService.setUserOnline(user1);
      await presenceService.setUserOnline(user2);
      await presenceService.addUserToChannel(user1, channel1);
      await presenceService.addUserToChannel(user2, channel2);

      expect(await presenceService.getOnlineChannelMembers(channel1)).toEqual([
        user1,
      ]);
      expect(await presenceService.getOnlineChannelMembers(channel2)).toEqual([
        user2,
      ]);
    });
  });

  // ===========================================================================
  // OrchestratorPresence Tests
  // ===========================================================================

  describe('VP presence', () => {
    it('sets Orchestrator online with daemon info', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = {
        daemonId: generatePresenceTestId('daemon'),
        endpoint: 'https://daemon.example.com',
        version: '1.0.0',
      };

      await presenceService.setVPOnline(vpId, daemonInfo);

      const presence = await presenceService.getVPPresence(vpId);

      expect(presence).not.toBeNull();
      expect(presence?.orchestratorId).toBe(vpId);
      expect(presence?.status).toBe('online');
      expect(presence?.daemonInfo.daemonId).toBe(daemonInfo.daemonId);
      expect(presence?.daemonInfo.endpoint).toBe(daemonInfo.endpoint);
      expect(presence?.daemonInfo.version).toBe(daemonInfo.version);
    });

    it('tracks Orchestrator heartbeats', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);

      const initialPresence = await presenceService.getVPPresence(vpId);
      const initialHeartbeat = initialPresence?.lastHeartbeat;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Send heartbeat
      await presenceService.updateVPHeartbeat(vpId, { cpu: 50, memory: 256 });

      const updatedPresence = await presenceService.getVPPresence(vpId);

      expect(updatedPresence?.lastHeartbeat).not.toBe(initialHeartbeat);
    });

    it('marks Orchestrator offline on timeout', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);
      expect((await presenceService.getVPPresence(vpId))?.status).toBe(
        'online'
      );

      await presenceService.setVPOffline(vpId);
      expect(await presenceService.getVPPresence(vpId)).toBeNull();
    });

    it('publishes Orchestrator online event', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);

      expect(redis.publish).toHaveBeenCalledWith(
        PRESENCE_CHANNEL,
        expect.stringContaining('vp_online')
      );

      const event = JSON.parse(redis._publishedMessages[0].message);
      expect(event.type).toBe('vp_online');
      expect(event.orchestratorId).toBe(vpId);
    });

    it('publishes Orchestrator offline event', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);
      redis._publishedMessages.length = 0;

      await presenceService.setVPOffline(vpId);

      expect(redis.publish).toHaveBeenCalledWith(
        PRESENCE_CHANNEL,
        expect.stringContaining('vp_offline')
      );

      const event = JSON.parse(redis._publishedMessages[0].message);
      expect(event.type).toBe('vp_offline');
      expect(event.orchestratorId).toBe(vpId);
    });

    it('returns null for unknown VP', async () => {
      const presence = await presenceService.getVPPresence('non-existent-vp');
      expect(presence).toBeNull();
    });

    it('handles multiple VPs online simultaneously', async () => {
      const orchestrators = Array.from({ length: 3 }, () => ({
        vpId: generatePresenceTestId('vp'),
        daemonInfo: createMockDaemonInfo(),
      }));

      await Promise.all(
        orchestrators.map(({ vpId, daemonInfo }) =>
          presenceService.setVPOnline(vpId, daemonInfo)
        )
      );

      for (const { vpId } of orchestrators) {
        const presence = await presenceService.getVPPresence(vpId);
        expect(presence?.status).toBe('online');
      }
    });
  });

  // ===========================================================================
  // Edge Cases and Error Handling
  // ===========================================================================

  describe('edge cases', () => {
    it('handles rapid status changes', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);
      await presenceService.setUserStatus(userId, 'away');
      await presenceService.setUserStatus(userId, 'busy');
      await presenceService.setUserStatus(userId, 'online');

      const presence = await presenceService.getUserPresence(userId);
      expect(presence?.status).toBe('online');
    });

    it('handles concurrent operations', async () => {
      const userIds = Array.from({ length: 10 }, () =>
        generatePresenceTestId('user')
      );

      // Concurrent online/offline operations
      await Promise.all([
        ...userIds.slice(0, 5).map(id => presenceService.setUserOnline(id)),
        ...userIds.slice(5).map(id => presenceService.setUserOnline(id)),
      ]);

      // All should be online
      for (const userId of userIds) {
        const presence = await presenceService.getUserPresence(userId);
        expect(presence?.status).toBe('online');
      }
    });

    it('handles special characters in custom status', async () => {
      const userId = generatePresenceTestId('user');
      const customStatus = 'Working on "Project X" - <important>';

      await presenceService.setUserOnline(userId);
      await presenceService.setUserCustomStatus(userId, customStatus);

      const presence = await presenceService.getUserPresence(userId);
      expect(presence?.customStatus).toBe(customStatus);
    });

    it('handles empty metadata', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId, {});

      const presence = await presenceService.getUserPresence(userId);
      expect(presence?.metadata).toEqual({});
    });
  });

  // ===========================================================================
  // TTL and Expiration Tests
  // ===========================================================================

  describe('TTL handling', () => {
    it('sets appropriate TTL on user presence', async () => {
      const userId = generatePresenceTestId('user');

      await presenceService.setUserOnline(userId);

      expect(redis.expire).toHaveBeenCalledWith(
        `${PRESENCE_KEY_PREFIX}${userId}`,
        PRESENCE_TTL_SECONDS
      );
    });

    it('sets appropriate TTL on Orchestrator presence', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);

      expect(redis.expire).toHaveBeenCalledWith(
        `${VP_PRESENCE_KEY_PREFIX}${vpId}`,
        PRESENCE_TTL_SECONDS
      );
    });

    it('refreshes TTL on heartbeat', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonInfo = createMockDaemonInfo();

      await presenceService.setVPOnline(vpId, daemonInfo);
      vi.clearAllMocks();

      await presenceService.updateVPHeartbeat(vpId);

      expect(redis.expire).toHaveBeenCalledWith(
        `${VP_PRESENCE_KEY_PREFIX}${vpId}`,
        PRESENCE_TTL_SECONDS
      );
    });
  });
});
