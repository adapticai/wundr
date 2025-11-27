/**
 * @fileoverview Daemon API service for VP-to-platform communication
 * Provides methods for daemons to interact with Genesis platform
 *
 * @packageDocumentation
 */

import type { ChannelType, PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type {
  DaemonConfig,
  DaemonEvent,
  DaemonEventPayload,
  DaemonEventType,
  DaemonMetrics,
  DaemonScope,
  DaemonToken,
} from '../types/daemon';
import type { DaemonAuthService } from './daemon-auth-service';

// =============================================================================
// Configuration Types
// =============================================================================

export interface DaemonApiServiceConfig {
  prisma: PrismaClient;
  redis: Redis;
  authService: DaemonAuthService;
  eventPrefix?: string;
}

/**
 * Attachment data for a message sent via the daemon API.
 */
export interface DaemonMessageAttachment {
  /** Attachment type (e.g., 'image', 'document', 'file') */
  type: string;
  /** URL or identifier for the attachment */
  url: string;
  /** Display name of the attachment */
  name: string;
  /** File size in bytes */
  size: number;
}

/**
 * Metadata for daemon messages.
 * Contains structured data about how the message was generated or processed.
 */
export interface DaemonMessageMetadata {
  /** Source of the message (e.g., 'automated', 'triggered', 'scheduled') */
  source?: string;
  /** Reference ID for tracking (e.g., workflow execution ID) */
  referenceId?: string;
  /** Priority level for message handling */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Tags for categorization */
  tags?: string[];
  /** Additional custom properties */
  [key: string]: string | string[] | boolean | number | undefined;
}

/**
 * Parameters for sending a message via the daemon API.
 */
export interface SendMessageParams {
  /** Target channel ID */
  channelId: string;
  /** Message content */
  content: string;
  /** Parent message ID for threading */
  parentId?: string;
  /** File attachments */
  attachments?: DaemonMessageAttachment[];
  /** Message metadata */
  metadata?: DaemonMessageMetadata;
}

/**
 * Channel information returned by the daemon API.
 */
export interface ChannelInfo {
  /** Channel unique identifier */
  id: string;
  /** Channel display name */
  name: string;
  /** Channel description */
  description?: string;
  /** Channel type */
  type: 'public' | 'private' | 'dm';
  /** Number of members in the channel */
  memberCount: number;
  /** Whether the Orchestrator has access to this channel */
  vpCanAccess: boolean;
}

/**
 * User information returned by the daemon API.
 */
export interface UserInfo {
  /** User unique identifier */
  id: string;
  /** User display name */
  name: string;
  /** User email address */
  email: string;
  /** User role in the workspace */
  role: string;
  /** User discipline (for VPs) */
  discipline?: string;
  /** Whether the user is currently online */
  isOnline: boolean;
}

/**
 * Message query filter for cursor-based pagination.
 */
interface MessageQueryFilter {
  channelId: string;
  id?: { lt?: string; gt?: string };
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown by daemon API operations.
 */
export class DaemonApiError extends Error {
  /** Error code for programmatic handling */
  code: string;

  /**
   * Creates a new DaemonApiError.
   *
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   */
  constructor(message: string, code: string) {
    super(message);
    this.name = 'DaemonApiError';
    this.code = code;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function mapChannelType(type: ChannelType): 'public' | 'private' | 'dm' {
  switch (type) {
    case 'PRIVATE':
      return 'private';
    case 'DM':
      return 'dm';
    default:
      return 'public';
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Service for daemon-to-platform API operations.
 *
 * Provides methods for Orchestrator daemons to interact with the Genesis platform,
 * including sending messages, reading channels, managing presence, and
 * subscribing to events.
 */
export class DaemonApiService {
  private prisma: PrismaClient;
  private redis: Redis;
  private authService: DaemonAuthService;
  private eventPrefix: string;

  /**
   * Creates a new DaemonApiService instance.
   *
   * @param config - Service configuration options
   */
  constructor(config: DaemonApiServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.authService = config.authService;
    this.eventPrefix = config.eventPrefix ?? 'daemon:events:';
  }

  /**
   * Send a message to a channel as the VP
   */
  async sendMessage(token: DaemonToken, params: SendMessageParams): Promise<string> {
    this.requireScope(token, 'messages:write');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    // Verify Orchestrator has access to channel
    const hasAccess = await this.checkChannelAccess(orchestrator.userId, params.channelId);
    if (!hasAccess) {
      throw new DaemonApiError('VP does not have access to this channel', 'CHANNEL_ACCESS_DENIED');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        channel: { connect: { id: params.channelId } },
        author: { connect: { id: orchestrator.userId } },
        content: params.content,
        parent: params.parentId ? { connect: { id: params.parentId } } : undefined,
        // Cast metadata to satisfy Prisma's InputJsonValue type
        metadata: (params.metadata ?? {}) as Parameters<typeof this.prisma.message.create>[0]['data']['metadata'],
      },
    });

    // Handle attachments via MessageAttachment
    if (params.attachments?.length) {
      await this.prisma.messageAttachment.createMany({
        data: params.attachments.map(att => ({
          messageId: message.id,
          fileId: att.url, // In real impl, this would be a file ID
          caption: att.name,
        })),
      });
    }

    // Publish event
    await this.publishEvent(token.daemonId, token.orchestratorId, 'message.sent', {
      messageId: message.id,
      channelId: params.channelId,
    });

    // Notify via Redis pub/sub for real-time updates
    await this.redis.publish(`channel:${params.channelId}:messages`, JSON.stringify({
      type: 'message.new',
      messageId: message.id,
      authorId: orchestrator.userId,
      orchestratorId: token.orchestratorId,
    }));

    return message.id;
  }

  /**
   * Get messages from a channel
   */
  async getMessages(
    token: DaemonToken,
    channelId: string,
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<Array<{
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
    parentId?: string;
  }>> {
    this.requireScope(token, 'messages:read');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    const hasAccess = await this.checkChannelAccess(orchestrator.userId, channelId);
    if (!hasAccess) {
      throw new DaemonApiError('VP does not have access to this channel', 'CHANNEL_ACCESS_DENIED');
    }

    const limit = Math.min(options?.limit ?? 50, 100);
    const where: MessageQueryFilter = { channelId };

    if (options?.before) {
      where.id = { lt: options.before };
    } else if (options?.after) {
      where.id = { gt: options.after };
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Get author names for all messages
    // Note: Using type assertion since Prisma generates different types for mapped columns
    type MessageWithAuthor = typeof messages[0] & { authorId: string };
    const messagesTyped = messages as unknown as MessageWithAuthor[];
    const authorIds = [...new Set(messagesTyped.map(m => m.authorId))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a.name ?? 'Unknown']));

    return messagesTyped.map(msg => ({
      id: msg.id,
      content: msg.content,
      authorId: msg.authorId,
      authorName: authorMap.get(msg.authorId) ?? 'Unknown',
      createdAt: msg.createdAt,
      parentId: msg.parentId ?? undefined,
    }));
  }

  /**
   * Get channels accessible by VP
   */
  async getChannels(token: DaemonToken): Promise<ChannelInfo[]> {
    this.requireScope(token, 'channels:read');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    // Get channels Orchestrator is a member of
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId: orchestrator.userId },
      include: {
        channel: {
          include: {
            _count: { select: { channelMembers: true } },
          },
        },
      },
    });

    return memberships.map(m => ({
      id: m.channel.id,
      name: m.channel.name,
      description: m.channel.description ?? undefined,
      type: mapChannelType(m.channel.type),
      memberCount: m.channel._count.channelMembers,
      vpCanAccess: true,
    }));
  }

  /**
   * Join a channel
   */
  async joinChannel(token: DaemonToken, channelId: string): Promise<void> {
    this.requireScope(token, 'channels:join');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    // Check if channel exists and is accessible
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new DaemonApiError('Channel not found', 'CHANNEL_NOT_FOUND');
    }

    if (channel.type === 'PRIVATE') {
      throw new DaemonApiError('Cannot join private channel', 'CHANNEL_PRIVATE');
    }

    // Add Orchestrator to channel
    await this.prisma.channelMember.upsert({
      where: {
        channelId_userId: { channelId, userId: orchestrator.userId },
      },
      create: {
        channelId,
        userId: orchestrator.userId,
        role: 'MEMBER',
      },
      update: {},
    });

    await this.publishEvent(token.daemonId, token.orchestratorId, 'channel.joined', { channelId });
  }

  /**
   * Leave a channel
   */
  async leaveChannel(token: DaemonToken, channelId: string): Promise<void> {
    this.requireScope(token, 'channels:join');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    await this.prisma.channelMember.deleteMany({
      where: { channelId, userId: orchestrator.userId },
    });

    await this.publishEvent(token.daemonId, token.orchestratorId, 'channel.left', { channelId });
  }

  /**
   * Get workspace users
   */
  async getUsers(
    token: DaemonToken,
    options?: { limit?: number; search?: string },
  ): Promise<UserInfo[]> {
    this.requireScope(token, 'users:read');

    const limit = Math.min(options?.limit ?? 50, 100);

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: token.workspaceId,
        ...(options?.search ? {
          user: {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { email: { contains: options.search, mode: 'insensitive' } },
            ],
          },
        } : {}),
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get online status from Redis
    const userIds = members.map(m => m.user.id);
    const onlineStatus = await this.getOnlineStatus(userIds);

    return members.map(m => ({
      id: m.user.id,
      name: m.user.name ?? '',
      email: m.user.email,
      role: m.role,
      isOnline: onlineStatus.get(m.user.id) ?? false,
    }));
  }

  /**
   * Update Orchestrator presence status
   */
  async updatePresence(
    token: DaemonToken,
    status: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string,
  ): Promise<void> {
    this.requireScope(token, 'presence:write');

    const presenceKey = `presence:${token.workspaceId}:${token.orchestratorId}`;
    const presenceData = {
      status,
      statusText,
      lastSeen: new Date().toISOString(),
      entityType: 'vp',
    };

    if (status === 'offline') {
      await this.redis.del(presenceKey);
    } else {
      await this.redis.setex(presenceKey, 300, JSON.stringify(presenceData));
    }

    // Publish presence update
    await this.redis.publish(`workspace:${token.workspaceId}:presence`, JSON.stringify({
      userId: token.orchestratorId,
      ...presenceData,
    }));

    await this.publishEvent(token.daemonId, token.orchestratorId, 'presence.updated', { status, statusText });
  }

  /**
   * Get Orchestrator configuration
   */
  async getConfig(token: DaemonToken): Promise<DaemonConfig> {
    this.requireScope(token, 'vp:config');

    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    const capabilities = orchestrator.capabilities as string[] | null;

    return {
      orchestratorId: token.orchestratorId,
      workspaceId: token.workspaceId,
      settings: {
        maxConcurrentConnections: 5,
        heartbeatIntervalMs: 30000,
        messageRateLimitPerMinute: 60,
        autoReconnect: true,
        logLevel: 'info',
      },
      features: {
        messaging: true,
        presence: true,
        calls: Array.isArray(capabilities) && capabilities.includes('calls'),
        fileAccess: Array.isArray(capabilities) && capabilities.includes('files'),
      },
    };
  }

  /**
   * Update Orchestrator status
   */
  async updateVPStatus(
    token: DaemonToken,
    status: 'active' | 'paused' | 'error',
    message?: string,
  ): Promise<void> {
    this.requireScope(token, 'vp:status');

    // Map status to VPStatus enum
    const vpStatus = status === 'active' ? 'ONLINE' : status === 'paused' ? 'AWAY' : 'BUSY';

    await this.prisma.orchestrator.update({
      where: { id: token.orchestratorId },
      data: {
        status: vpStatus,
      },
    });

    // Update presence
    await this.updatePresence(
      token,
      status === 'active' ? 'online' : status === 'paused' ? 'away' : 'busy',
      message,
    );
  }

  /**
   * Report metrics
   */
  async reportMetrics(token: DaemonToken, metrics: DaemonMetrics): Promise<void> {
    const metricsKey = `daemon:metrics:${token.daemonId}`;

    await this.redis.hset(metricsKey, {
      ...metrics,
      timestamp: Date.now(),
    });
    await this.redis.expire(metricsKey, 3600); // 1 hour

    // Update session with metrics
    const sessions = await this.authService.getActiveSessions(token.daemonId);
    for (const session of sessions) {
      await this.authService.updateHeartbeat(session.id, 'active', metrics);
    }
  }

  /**
   * Subscribe to channel events
   */
  async subscribeToChannel(token: DaemonToken, channelId: string): Promise<string> {
    this.requireScope(token, 'messages:read');

    // Get the VP's associated user ID
    const orchestrator = await this.prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      throw new DaemonApiError('VP not found', 'VP_NOT_FOUND');
    }

    const hasAccess = await this.checkChannelAccess(orchestrator.userId, channelId);
    if (!hasAccess) {
      throw new DaemonApiError('VP does not have access to this channel', 'CHANNEL_ACCESS_DENIED');
    }

    // Add to subscription set
    await this.redis.sadd(`daemon:subscriptions:${token.daemonId}`, channelId);

    return `channel:${channelId}:messages`;
  }

  /**
   * Unsubscribe from channel events
   */
  async unsubscribeFromChannel(token: DaemonToken, channelId: string): Promise<void> {
    await this.redis.srem(`daemon:subscriptions:${token.daemonId}`, channelId);
  }

  /**
   * Get pending events for daemon
   */
  async getPendingEvents(
    token: DaemonToken,
    since?: Date,
  ): Promise<DaemonEvent[]> {
    const eventsKey = `${this.eventPrefix}${token.daemonId}`;
    const events = await this.redis.lrange(eventsKey, 0, 99);

    return events
      .map(e => JSON.parse(e) as DaemonEvent)
      .filter(e => !since || new Date(e.timestamp) > since);
  }

  /**
   * Acknowledge events
   */
  async acknowledgeEvents(token: DaemonToken, eventIds: string[]): Promise<void> {
    const eventsKey = `${this.eventPrefix}${token.daemonId}`;

    // Get all events and filter out acknowledged ones
    const events = await this.redis.lrange(eventsKey, 0, -1);
    const remaining = events.filter(e => {
      const event = JSON.parse(e) as DaemonEvent;
      return !eventIds.includes(event.id);
    });

    // Replace list with remaining events
    if (remaining.length > 0) {
      await this.redis.del(eventsKey);
      await this.redis.rpush(eventsKey, ...remaining);
    } else {
      await this.redis.del(eventsKey);
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Check if Orchestrator has access to channel
   */
  private async checkChannelAccess(userId: string, channelId: string): Promise<boolean> {
    const membership = await this.prisma.channelMember.findFirst({
      where: { channelId, userId },
    });
    return !!membership;
  }

  /**
   * Get online status for users
   */
  private async getOnlineStatus(userIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    for (const userId of userIds) {
      const keys = await this.redis.keys(`presence:*:${userId}`);
      result.set(userId, keys.length > 0);
    }

    return result;
  }

  /**
   * Publishes a daemon event to Redis for delivery.
   *
   * @param daemonId - The daemon instance ID
   * @param orchestratorId - The OrchestratorID associated with the event
   * @param type - The event type
   * @param payload - Event-specific data payload
   */
  private async publishEvent(
    daemonId: string,
    orchestratorId: string,
    type: DaemonEventType,
    payload: DaemonEventPayload,
  ): Promise<void> {
    const event: DaemonEvent = {
      id: `evt_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
      daemonId,
      orchestratorId,
      type,
      payload,
      timestamp: new Date(),
    };

    const eventsKey = `${this.eventPrefix}${daemonId}`;
    await this.redis.lpush(eventsKey, JSON.stringify(event));
    await this.redis.ltrim(eventsKey, 0, 999); // Keep last 1000 events
    await this.redis.expire(eventsKey, 86400); // 24 hours
  }

  /**
   * Require specific scope
   */
  private requireScope(token: DaemonToken, scope: DaemonScope): void {
    if (!this.authService.hasScope(token, scope)) {
      throw new DaemonApiError(`Missing required scope: ${scope}`, 'INSUFFICIENT_SCOPE');
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new DaemonApiService instance.
 */
export function createDaemonApiService(config: DaemonApiServiceConfig): DaemonApiService {
  return new DaemonApiService(config);
}

export default DaemonApiService;
