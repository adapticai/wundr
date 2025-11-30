/**
 * @genesis/core - Presence Service
 *
 * Redis-based real-time presence tracking for users, VPs (Virtual Persons),
 * and channel membership. Supports pub/sub for presence change notifications
 * and TTL-based automatic offline detection.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';
import {
  createRedisClient,
  createSubscriberClient,
  isRedisAvailable,
} from '../redis/client';
import {
  DEFAULT_PRESENCE_CONFIG,
  PRESENCE_KEY_PATTERNS,
} from '../types/presence';

import type {
  ChannelPresenceCallback,
  ChannelPresenceEvent,
  DaemonInfo,
  OrchestratorPresence,
  PresenceCallback,
  PresenceConfig,
  PresenceEvent,
  PresenceMetadata,
  PresenceStatus,
  UnsubscribeFunction,
  UserPresence,
  UserPresenceEvent,
  VPPresenceCallback,
  VPPresenceEvent,
} from '../types/presence';
import type Redis from 'ioredis';

/**
 * Union type for all presence event callback functions.
 * Used internally by the subscription system.
 */
type PresenceEventCallback = PresenceCallback | ChannelPresenceCallback | VPPresenceCallback;

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when presence operations fail.
 */
export class PresenceError extends GenesisError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PRESENCE_ERROR', 500, details);
    this.name = 'PresenceError';
  }
}

/**
 * Error thrown when Redis is unavailable.
 */
export class RedisUnavailableError extends GenesisError {
  constructor() {
    super(
      'Redis is not available. Presence service is operating in degraded mode.',
      'REDIS_UNAVAILABLE',
      503,
    );
    this.name = 'RedisUnavailableError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for presence tracking operations.
 */
export interface PresenceService {
  // ==========================================================================
  // User Presence
  // ==========================================================================

  /**
   * Sets a user as online with optional metadata.
   *
   * @param userId - The user ID
   * @param metadata - Optional presence metadata
   * @throws {PresenceError} If the operation fails
   */
  setUserOnline(userId: string, metadata?: PresenceMetadata): Promise<void>;

  /**
   * Sets a user as offline.
   *
   * @param userId - The user ID
   */
  setUserOffline(userId: string): Promise<void>;

  /**
   * Updates a user's presence status.
   *
   * @param userId - The user ID
   * @param status - The new status
   */
  setUserStatus(userId: string, status: PresenceStatus): Promise<void>;

  /**
   * Gets a user's current presence.
   *
   * @param userId - The user ID
   * @returns The user's presence or null if not found
   */
  getUserPresence(userId: string): Promise<UserPresence | null>;

  /**
   * Gets presence for multiple users.
   *
   * @param userIds - Array of user IDs
   * @returns Map of userId to UserPresence
   */
  getMultiplePresence(userIds: string[]): Promise<Map<string, UserPresence>>;

  // ==========================================================================
  // Channel Presence
  // ==========================================================================

  /**
   * Marks a user as joined to a channel.
   *
   * @param userId - The user ID
   * @param channelId - The channel ID
   */
  joinChannel(userId: string, channelId: string): Promise<void>;

  /**
   * Removes a user from a channel's presence.
   *
   * @param userId - The user ID
   * @param channelId - The channel ID
   */
  leaveChannel(userId: string, channelId: string): Promise<void>;

  /**
   * Gets all member IDs in a channel (online or not).
   *
   * @param channelId - The channel ID
   * @returns Array of user IDs
   */
  getChannelMembers(channelId: string): Promise<string[]>;

  /**
   * Gets only online members in a channel with their presence info.
   *
   * @param channelId - The channel ID
   * @returns Array of online user presences
   */
  getOnlineChannelMembers(channelId: string): Promise<UserPresence[]>;

  // ==========================================================================
  // VP/Daemon Presence
  // ==========================================================================

  /**
   * Sets a Orchestrator as online with daemon information.
   *
   * @param vpId - The OrchestratorID
   * @param daemonInfo - Information about the daemon process
   */
  setVPOnline(vpId: string, daemonInfo: DaemonInfo): Promise<void>;

  /**
   * Sets a Orchestrator as offline.
   *
   * @param vpId - The OrchestratorID
   */
  setVPOffline(vpId: string): Promise<void>;

  /**
   * Gets a VP's current presence.
   *
   * @param vpId - The OrchestratorID
   * @returns The VP's presence or null if not found
   */
  getVPPresence(vpId: string): Promise<OrchestratorPresence | null>;

  /**
   * Sends a heartbeat for a Orchestrator to keep it online.
   *
   * @param vpId - The OrchestratorID
   * @param metrics - Optional daemon metrics to update
   */
  vpHeartbeat(vpId: string, metrics?: DaemonInfo['metrics']): Promise<void>;

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  /**
   * Subscribes to presence changes for a specific user.
   *
   * @param userId - The user ID to watch
   * @param callback - Function called on presence changes
   * @returns Unsubscribe function
   */
  subscribeToUser(userId: string, callback: PresenceCallback): UnsubscribeFunction;

  /**
   * Subscribes to presence changes for a channel.
   *
   * @param channelId - The channel ID to watch
   * @param callback - Function called on presence changes
   * @returns Unsubscribe function
   */
  subscribeToChannel(channelId: string, callback: ChannelPresenceCallback): UnsubscribeFunction;

  /**
   * Subscribes to presence changes for a VP.
   *
   * @param vpId - The OrchestratorID to watch
   * @param callback - Function called on presence changes
   * @returns Unsubscribe function
   */
  subscribeToVP(vpId: string, callback: VPPresenceCallback): UnsubscribeFunction;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Checks if the presence service is available.
   */
  isAvailable(): boolean;

  /**
   * Gets service statistics.
   */
  getStats(): Promise<PresenceStats>;

  /**
   * Cleans up expired presence data.
   */
  cleanup(): Promise<number>;
}

/**
 * Presence service statistics.
 */
export interface PresenceStats {
  /** Number of online users */
  onlineUsers: number;

  /** Number of online VPs */
  onlineVPs: number;

  /** Number of active channels */
  activeChannels: number;

  /** Redis connection status */
  redisConnected: boolean;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Redis-based presence service implementation.
 * Provides real-time user, VP, and channel presence tracking with pub/sub notifications.
 */
export class PresenceServiceImpl implements PresenceService {
  /** Redis client for presence data operations */
  private readonly redis: Redis;
  /** Redis subscriber client for pub/sub operations */
  private readonly subscriber: Redis;
  /** Service configuration */
  private readonly config: PresenceConfig;
  /** Map of channel names to sets of callback functions */
  private readonly subscriptions: Map<string, Set<PresenceEventCallback>>;
  /** Whether the subscriber client is ready for operations */
  private isSubscriberReady: boolean = false;

  /**
   * Creates a new PresenceServiceImpl instance.
   *
   * @param redisClient - Optional Redis client instance
   * @param config - Optional presence configuration
   */
  constructor(redisClient?: Redis, config?: Partial<PresenceConfig>) {
    this.redis = redisClient ?? createRedisClient();
    this.subscriber = createSubscriberClient();
    this.config = { ...DEFAULT_PRESENCE_CONFIG, ...config };
    this.subscriptions = new Map();

    this.initializeSubscriber();
  }

  // ===========================================================================
  // User Presence Methods
  // ===========================================================================

  /**
   * Sets a user as online with optional metadata.
   */
  async setUserOnline(userId: string, metadata?: PresenceMetadata): Promise<void> {
    if (!this.isAvailable()) {
      return; // Graceful degradation
    }

    const key = this.getUserPresenceKey(userId);
    const heartbeatKey = this.getHeartbeatKey(userId);
    const now = new Date();

    const presenceData: Record<string, string> = {
      userId,
      status: 'ONLINE',
      lastSeen: now.toISOString(),
    };

    if (metadata) {
      presenceData.metadata = JSON.stringify(metadata);
    }

    try {
      const pipeline = this.redis.pipeline();

      // Set presence hash
      pipeline.hset(key, presenceData);

      // Set heartbeat key with TTL
      pipeline.setex(heartbeatKey, this.config.presenceTtlSeconds, '1');

      await pipeline.exec();

      // Publish presence event
      await this.publishUserEvent({
        type: 'user.online',
        timestamp: now,
        userId,
        currentStatus: 'ONLINE',
        metadata,
      });
    } catch (error) {
      throw new PresenceError('Failed to set user online', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sets a user as offline.
   */
  async setUserOffline(userId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getUserPresenceKey(userId);
    const heartbeatKey = this.getHeartbeatKey(userId);
    const now = new Date();

    try {
      // Get previous status for event
      const previousStatus = await this.redis.hget(key, 'status') as PresenceStatus | null;

      const pipeline = this.redis.pipeline();

      // Update presence
      pipeline.hset(key, {
        status: 'OFFLINE',
        lastSeen: now.toISOString(),
      });

      // Remove heartbeat key
      pipeline.del(heartbeatKey);

      await pipeline.exec();

      // Publish presence event
      await this.publishUserEvent({
        type: 'user.offline',
        timestamp: now,
        userId,
        previousStatus: previousStatus ?? undefined,
        currentStatus: 'OFFLINE',
      });
    } catch (error) {
      // Log but don't throw - graceful degradation
      this.logError('Failed to set user offline', error);
    }
  }

  /**
   * Updates a user's presence status.
   */
  async setUserStatus(userId: string, status: PresenceStatus): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getUserPresenceKey(userId);
    const heartbeatKey = this.getHeartbeatKey(userId);
    const now = new Date();

    try {
      // Get previous status
      const previousStatus = await this.redis.hget(key, 'status') as PresenceStatus | null;

      const pipeline = this.redis.pipeline();

      pipeline.hset(key, {
        status,
        lastSeen: now.toISOString(),
      });

      // Refresh heartbeat if not offline
      if (status !== 'OFFLINE') {
        pipeline.setex(heartbeatKey, this.config.presenceTtlSeconds, '1');
      } else {
        pipeline.del(heartbeatKey);
      }

      await pipeline.exec();

      // Publish status change event
      await this.publishUserEvent({
        type: 'user.status_changed',
        timestamp: now,
        userId,
        previousStatus: previousStatus ?? undefined,
        currentStatus: status,
      });
    } catch (error) {
      this.logError('Failed to set user status', error);
    }
  }

  /**
   * Gets a user's current presence.
   */
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const key = this.getUserPresenceKey(userId);
    const heartbeatKey = this.getHeartbeatKey(userId);

    try {
      const [data, heartbeatExists] = await Promise.all([
        this.redis.hgetall(key),
        this.redis.exists(heartbeatKey),
      ]);

      if (!data || Object.keys(data).length === 0 || !data.userId || !data.lastSeen) {
        return null;
      }

      // If no heartbeat, user is considered offline
      const status: PresenceStatus = heartbeatExists ? (data.status as PresenceStatus) : 'OFFLINE';

      return {
        userId: data.userId,
        status,
        lastSeen: new Date(data.lastSeen),
        customStatus: data.customStatus || undefined,
        metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
      };
    } catch (error) {
      this.logError('Failed to get user presence', error);
      return null;
    }
  }

  /**
   * Gets presence for multiple users.
   */
  async getMultiplePresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();

    if (!this.isAvailable() || userIds.length === 0) {
      return result;
    }

    // Limit batch size
    const limitedIds = userIds.slice(0, this.config.maxBulkQuerySize);

    try {
      // Fetch all presences in parallel
      const presences = await Promise.all(
        limitedIds.map((id) => this.getUserPresence(id)),
      );

      presences.forEach((presence, index) => {
        const userId = limitedIds[index];
        if (presence && userId) {
          result.set(userId, presence);
        }
      });

      return result;
    } catch (error) {
      this.logError('Failed to get multiple presences', error);
      return result;
    }
  }

  // ===========================================================================
  // Channel Presence Methods
  // ===========================================================================

  /**
   * Marks a user as joined to a channel.
   */
  async joinChannel(userId: string, channelId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getChannelMembersKey(channelId);
    const now = new Date();

    try {
      await this.redis.sadd(key, userId);

      // Publish channel event
      const memberCount = await this.redis.scard(key);
      await this.publishChannelEvent({
        type: 'channel.user_joined',
        timestamp: now,
        channelId,
        userId,
        onlineCount: memberCount,
      });
    } catch (error) {
      this.logError('Failed to join channel', error);
    }
  }

  /**
   * Removes a user from a channel's presence.
   */
  async leaveChannel(userId: string, channelId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getChannelMembersKey(channelId);
    const now = new Date();

    try {
      await this.redis.srem(key, userId);

      // Publish channel event
      const memberCount = await this.redis.scard(key);
      await this.publishChannelEvent({
        type: 'channel.user_left',
        timestamp: now,
        channelId,
        userId,
        onlineCount: memberCount,
      });
    } catch (error) {
      this.logError('Failed to leave channel', error);
    }
  }

  /**
   * Gets all member IDs in a channel.
   */
  async getChannelMembers(channelId: string): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const key = this.getChannelMembersKey(channelId);

    try {
      return await this.redis.smembers(key);
    } catch (error) {
      this.logError('Failed to get channel members', error);
      return [];
    }
  }

  /**
   * Gets only online members in a channel with their presence info.
   */
  async getOnlineChannelMembers(channelId: string): Promise<UserPresence[]> {
    const memberIds = await this.getChannelMembers(channelId);

    if (memberIds.length === 0) {
      return [];
    }

    const presenceMap = await this.getMultiplePresence(memberIds);
    const onlineMembers: UserPresence[] = [];

    presenceMap.forEach((presence) => {
      if (presence.status !== 'OFFLINE') {
        onlineMembers.push(presence);
      }
    });

    return onlineMembers;
  }

  // ===========================================================================
  // VP/Daemon Presence Methods
  // ===========================================================================

  /**
   * Sets a Orchestrator as online with daemon information.
   */
  async setVPOnline(vpId: string, daemonInfo: DaemonInfo): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getVPPresenceKey(vpId);
    const heartbeatKey = `${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:${vpId}`;
    const now = new Date();

    try {
      const pipeline = this.redis.pipeline();

      pipeline.hset(key, {
        vpId,
        status: 'ONLINE',
        lastHeartbeat: now.toISOString(),
        daemonInfo: JSON.stringify(daemonInfo),
      });

      pipeline.setex(heartbeatKey, this.config.presenceTtlSeconds, '1');

      await pipeline.exec();

      // Publish Orchestrator event
      await this.publishVPEvent({
        type: 'vp.online',
        timestamp: now,
        orchestratorId: vpId,
        currentStatus: 'ONLINE',
        daemonInfo,
      });
    } catch (error) {
      throw new PresenceError('Failed to set Orchestrator online', {
        vpId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sets a Orchestrator as offline.
   */
  async setVPOffline(vpId: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getVPPresenceKey(vpId);
    const heartbeatKey = `${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:${vpId}`;
    const now = new Date();

    try {
      const previousStatus = await this.redis.hget(key, 'status') as PresenceStatus | null;

      const pipeline = this.redis.pipeline();

      pipeline.hset(key, {
        status: 'OFFLINE',
        lastHeartbeat: now.toISOString(),
      });

      pipeline.del(heartbeatKey);

      await pipeline.exec();

      // Publish Orchestrator event
      await this.publishVPEvent({
        type: 'vp.offline',
        timestamp: now,
        orchestratorId: vpId,
        previousStatus: previousStatus ?? undefined,
        currentStatus: 'OFFLINE',
      });
    } catch (error) {
      this.logError('Failed to set Orchestrator offline', error);
    }
  }

  /**
   * Gets a VP's current presence.
   */
  async getVPPresence(vpId: string): Promise<OrchestratorPresence | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const key = this.getVPPresenceKey(vpId);
    const heartbeatKey = `${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:${vpId}`;

    try {
      const [data, heartbeatExists] = await Promise.all([
        this.redis.hgetall(key),
        this.redis.exists(heartbeatKey),
      ]);

      if (!data || Object.keys(data).length === 0 || !data.vpId || !data.lastHeartbeat) {
        return null;
      }

      const status: PresenceStatus = heartbeatExists ? (data.status as PresenceStatus) : 'OFFLINE';

      return {
        orchestratorId: data.vpId,
        status,
        lastHeartbeat: new Date(data.lastHeartbeat),
        daemonInfo: data.daemonInfo ? JSON.parse(data.daemonInfo) : {
          version: 'unknown',
          hostname: 'unknown',
          processId: 0,
          startedAt: new Date(),
        },
      };
    } catch (error) {
      this.logError('Failed to get Orchestrator presence', error);
      return null;
    }
  }

  /**
   * Sends a heartbeat for a VP.
   */
  async vpHeartbeat(vpId: string, metrics?: DaemonInfo['metrics']): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const key = this.getVPPresenceKey(vpId);
    const heartbeatKey = `${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:${vpId}`;
    const now = new Date();

    try {
      const pipeline = this.redis.pipeline();

      const updates: Record<string, string> = {
        lastHeartbeat: now.toISOString(),
        status: 'ONLINE',
      };

      // Update metrics if provided
      if (metrics) {
        const existingData = await this.redis.hget(key, 'daemonInfo');
        if (existingData) {
          const daemonInfo = JSON.parse(existingData) as DaemonInfo;
          daemonInfo.metrics = metrics;
          updates.daemonInfo = JSON.stringify(daemonInfo);
        }
      }

      pipeline.hset(key, updates);
      pipeline.setex(heartbeatKey, this.config.presenceTtlSeconds, '1');

      await pipeline.exec();

      // Publish heartbeat event
      await this.publishVPEvent({
        type: 'vp.heartbeat',
        timestamp: now,
        orchestratorId: vpId,
        currentStatus: 'ONLINE',
      });
    } catch (error) {
      this.logError('Failed to send Orchestrator heartbeat', error);
    }
  }

  // ===========================================================================
  // Subscription Methods
  // ===========================================================================

  /**
   * Subscribes to presence changes for a specific user.
   *
   * @param userId - The user ID to watch
   * @param callback - Function called when the user's presence changes
   * @returns Unsubscribe function to remove the subscription
   */
  subscribeToUser(userId: string, callback: PresenceCallback): UnsubscribeFunction {
    if (!this.config.enablePubSub) {
      return () => {};
    }

    const channel = `${PRESENCE_KEY_PATTERNS.USER_EVENTS}${userId}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Subscribes to presence changes for a channel.
   *
   * @param channelId - The channel ID to watch
   * @param callback - Function called when channel presence changes
   * @returns Unsubscribe function to remove the subscription
   */
  subscribeToChannel(channelId: string, callback: ChannelPresenceCallback): UnsubscribeFunction {
    if (!this.config.enablePubSub) {
      return () => {};
    }

    const channel = `${PRESENCE_KEY_PATTERNS.CHANNEL_EVENTS}${channelId}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Subscribes to presence changes for a VP.
   *
   * @param vpId - The OrchestratorID to watch
   * @param callback - Function called when the VP's presence changes
   * @returns Unsubscribe function to remove the subscription
   */
  subscribeToVP(vpId: string, callback: VPPresenceCallback): UnsubscribeFunction {
    if (!this.config.enablePubSub) {
      return () => {};
    }

    const channel = `${PRESENCE_KEY_PATTERNS.VP_EVENTS}${vpId}`;
    return this.subscribe(channel, callback);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Checks if the presence service is available.
   */
  isAvailable(): boolean {
    return isRedisAvailable();
  }

  /**
   * Gets service statistics.
   */
  async getStats(): Promise<PresenceStats> {
    if (!this.isAvailable()) {
      return {
        onlineUsers: 0,
        onlineVPs: 0,
        activeChannels: 0,
        redisConnected: false,
      };
    }

    try {
      // Count keys matching patterns
      const [userKeys, vpKeys, channelKeys] = await Promise.all([
        this.redis.keys(`${PRESENCE_KEY_PATTERNS.HEARTBEAT}*`),
        this.redis.keys(`${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:*`),
        this.redis.keys(`${PRESENCE_KEY_PATTERNS.CHANNEL_MEMBERS}*`),
      ]);

      // Filter user keys (exclude Orchestrator keys)
      const userOnlyKeys = userKeys.filter((k) => !k.includes(':vp:'));

      return {
        onlineUsers: userOnlyKeys.length,
        onlineVPs: vpKeys.length,
        activeChannels: channelKeys.length,
        redisConnected: true,
      };
    } catch (error) {
      this.logError('Failed to get stats', error);
      return {
        onlineUsers: 0,
        onlineVPs: 0,
        activeChannels: 0,
        redisConnected: false,
      };
    }
  }

  /**
   * Cleans up expired presence data.
   */
  async cleanup(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    let cleaned = 0;

    try {
      // Find all presence keys without active heartbeats
      const userPresenceKeys = await this.redis.keys(`${PRESENCE_KEY_PATTERNS.USER_PRESENCE}*`);

      for (const key of userPresenceKeys) {
        const userId = key.replace(PRESENCE_KEY_PATTERNS.USER_PRESENCE, '');
        const heartbeatKey = this.getHeartbeatKey(userId);
        const exists = await this.redis.exists(heartbeatKey);

        if (!exists) {
          // Update status to offline
          await this.redis.hset(key, 'status', 'OFFLINE');
          cleaned++;
        }
      }

      // Same for VPs
      const vpPresenceKeys = await this.redis.keys(`${PRESENCE_KEY_PATTERNS.VP_PRESENCE}*`);

      for (const key of vpPresenceKeys) {
        const vpId = key.replace(PRESENCE_KEY_PATTERNS.VP_PRESENCE, '');
        const heartbeatKey = `${PRESENCE_KEY_PATTERNS.HEARTBEAT}vp:${vpId}`;
        const exists = await this.redis.exists(heartbeatKey);

        if (!exists) {
          await this.redis.hset(key, 'status', 'OFFLINE');
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      this.logError('Failed to cleanup', error);
      return cleaned;
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Gets the Redis key for user presence.
   */
  private getUserPresenceKey(userId: string): string {
    return `${PRESENCE_KEY_PATTERNS.USER_PRESENCE}${userId}`;
  }

  /**
   * Gets the Redis key for Orchestrator presence.
   */
  private getVPPresenceKey(vpId: string): string {
    return `${PRESENCE_KEY_PATTERNS.VP_PRESENCE}${vpId}`;
  }

  /**
   * Gets the Redis key for channel members.
   */
  private getChannelMembersKey(channelId: string): string {
    return `${PRESENCE_KEY_PATTERNS.CHANNEL_MEMBERS}${channelId}${PRESENCE_KEY_PATTERNS.CHANNEL_MEMBERS_SUFFIX}`;
  }

  /**
   * Gets the Redis key for heartbeat.
   */
  private getHeartbeatKey(userId: string): string {
    return `${PRESENCE_KEY_PATTERNS.HEARTBEAT}${userId}`;
  }

  /**
   * Initializes the subscriber client for pub/sub.
   * Sets up event handlers for ready, message, and error events.
   */
  private initializeSubscriber(): void {
    if (!this.config.enablePubSub) {
      return;
    }

    this.subscriber.on('ready', () => {
      this.isSubscriberReady = true;
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        try {
          const event = JSON.parse(message) as PresenceEvent;
          callbacks.forEach((cb) => {
            // Call the callback with the appropriate event type
            // The callback will receive the correctly typed event
            (cb as (event: PresenceEvent) => void)(event);
          });
        } catch (error) {
          this.logError('Failed to parse pub/sub message', error);
        }
      }
    });

    this.subscriber.on('error', (error: Error) => {
      this.logError('Subscriber error', error);
    });
  }

  /**
   * Generic subscribe method for presence events.
   * Manages Redis pub/sub subscriptions and callback registration.
   *
   * @param channel - The Redis channel to subscribe to
   * @param callback - The callback function to invoke on events
   * @returns Unsubscribe function to remove the subscription
   */
  private subscribe(channel: string, callback: PresenceEventCallback): UnsubscribeFunction {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      // Subscribe to Redis channel if subscriber is ready
      if (this.isSubscriberReady) {
        this.subscriber.subscribe(channel).catch((err: Error) => {
          this.logError(`Failed to subscribe to ${channel}`, err);
        });
      }
    }

    const callbackSet = this.subscriptions.get(channel);
    if (callbackSet) {
      callbackSet.add(callback);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);

        // Unsubscribe from Redis if no more callbacks
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          if (this.isSubscriberReady) {
            this.subscriber.unsubscribe(channel).catch((err: Error) => {
              this.logError(`Failed to unsubscribe from ${channel}`, err);
            });
          }
        }
      }
    };
  }

  /**
   * Publishes a user presence event.
   */
  private async publishUserEvent(event: UserPresenceEvent): Promise<void> {
    if (!this.config.enablePubSub || !this.isAvailable()) {
      return;
    }

    try {
      const channel = `${PRESENCE_KEY_PATTERNS.USER_EVENTS}${event.userId}`;
      await this.redis.publish(channel, JSON.stringify(event));
      await this.redis.publish(PRESENCE_KEY_PATTERNS.GLOBAL_EVENTS, JSON.stringify(event));
    } catch (error) {
      this.logError('Failed to publish user event', error);
    }
  }

  /**
   * Publishes a Orchestrator presence event.
   */
  private async publishVPEvent(event: VPPresenceEvent): Promise<void> {
    if (!this.config.enablePubSub || !this.isAvailable()) {
      return;
    }

    try {
      const channel = `${PRESENCE_KEY_PATTERNS.VP_EVENTS}${event.orchestratorId}`;
      await this.redis.publish(channel, JSON.stringify(event));
      await this.redis.publish(PRESENCE_KEY_PATTERNS.GLOBAL_EVENTS, JSON.stringify(event));
    } catch (error) {
      this.logError('Failed to publish Orchestrator event', error);
    }
  }

  /**
   * Publishes a channel presence event.
   */
  private async publishChannelEvent(event: ChannelPresenceEvent): Promise<void> {
    if (!this.config.enablePubSub || !this.isAvailable()) {
      return;
    }

    try {
      const channel = `${PRESENCE_KEY_PATTERNS.CHANNEL_EVENTS}${event.channelId}`;
      await this.redis.publish(channel, JSON.stringify(event));
      await this.redis.publish(PRESENCE_KEY_PATTERNS.GLOBAL_EVENTS, JSON.stringify(event));
    } catch (error) {
      this.logError('Failed to publish channel event', error);
    }
  }

  /**
   * Error logging helper.
   */
  private logError(message: string, error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[PresenceService] ${message}:`, error instanceof Error ? error.message : error);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new presence service instance.
 *
 * @param redisClient - Optional Redis client instance
 * @param config - Optional presence configuration
 * @returns Presence service instance
 *
 * @example
 * ```typescript
 * const presenceService = createPresenceService();
 *
 * // Set user online
 * await presenceService.setUserOnline('user_123', {
 *   device: 'web',
 *   userAgent: 'Mozilla/5.0...',
 * });
 *
 * // Subscribe to presence changes
 * const unsubscribe = presenceService.subscribeToUser('user_123', (event) => {
 *   console.log('Presence changed:', event);
 * });
 *
 * // Later: clean up
 * unsubscribe();
 * ```
 */
export function createPresenceService(
  redisClient?: Redis,
  config?: Partial<PresenceConfig>,
): PresenceServiceImpl {
  return new PresenceServiceImpl(redisClient, config);
}

/**
 * Default presence service instance.
 * Note: This will create Redis connections on first use.
 */
let _presenceService: PresenceServiceImpl | null = null;

/**
 * Gets the singleton presence service instance.
 * Lazily initialized on first access.
 */
export function getPresenceService(): PresenceServiceImpl {
  if (!_presenceService) {
    _presenceService = createPresenceService();
  }
  return _presenceService;
}

/**
 * Type-safe property accessor for presence service.
 * Used by the proxy to access service methods and properties.
 */
type PresenceServiceProperty = keyof PresenceServiceImpl;

/**
 * Singleton presence service for convenience.
 * Uses a Proxy to lazily initialize the service on first access.
 *
 * @example
 * ```typescript
 * // The service is lazily initialized on first use
 * await presenceService.setUserOnline('user_123');
 * const presence = await presenceService.getUserPresence('user_123');
 * ```
 */
export const presenceService = new Proxy({} as PresenceServiceImpl, {
  get(_target, prop: string | symbol) {
    const service = getPresenceService();
    // Ensure prop is a valid key
    if (typeof prop === 'string' || typeof prop === 'symbol') {
      const key = prop as PresenceServiceProperty;
      const value = service[key];
      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(service);
      }
      return value;
    }
    return undefined;
  },
});
