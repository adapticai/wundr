/**
 * @fileoverview Analytics service for usage tracking and insights
 *
 * This service provides comprehensive analytics tracking and insights generation
 * for workspace usage. It uses a batch processing approach for efficient event
 * storage and Redis for real-time counters.
 *
 * Required Prisma schema additions:
 * ```prisma
 * model AnalyticsEvent {
 *   id          String   @id @default(cuid())
 *   workspaceId String
 *   userId      String?
 *   vpId        String?
 *   eventType   String
 *   eventData   String   @db.Text
 *   sessionId   String?
 *   timestamp   DateTime @default(now())
 *   metadata    String?  @db.Text
 *
 *   @@index([workspaceId])
 *   @@index([timestamp])
 *   @@index([eventType])
 *   @@index([userId])
 * }
 * ```
 */


import {
  ANALYTICS_REDIS_KEYS,
  ANALYTICS_REDIS_TTL_SECONDS,
  DEFAULT_ANALYTICS_BATCH_SIZE,
  DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS,
} from '../types/analytics';

import type {
  AnalyticsEvent,
  AnalyticsPeriod,
  AnalyticsQuery,
  CallMetrics,
  ChannelMetrics,
  FileMetrics,
  InsightHighlight,
  InsightRecommendation,
  InsightReport,
  MessageMetrics,
  OrchestratorMetrics,
  TrendData,
  UsageMetrics,
  UserMetrics,
} from '../types/analytics';

// =============================================================================
// DATABASE CLIENT INTERFACES
// =============================================================================

/**
 * Input data for creating an analytics event in the database.
 */
export interface AnalyticsEventCreateInput {
  workspaceId: string;
  userId?: string | null;
  vpId?: string | null;
  eventType: string;
  eventData: string;
  sessionId?: string | null;
  timestamp: Date;
  metadata?: string | null;
}

/**
 * Raw analytics event record from the database.
 */
export interface AnalyticsEventRecord {
  id: string;
  workspaceId: string;
  userId?: string | null;
  vpId?: string | null;
  eventType: string;
  eventData: string;
  sessionId?: string | null;
  timestamp: Date;
  metadata?: string | null;
}

/**
 * Where clause for filtering analytics events.
 */
export interface AnalyticsEventWhereInput {
  workspaceId?: string;
  userId?: string;
  vpId?: string;
  eventType?: string | { in: string[] };
  timestamp?: { gte?: Date; lte?: Date };
}

/**
 * Order by clause for analytics event queries.
 */
export interface AnalyticsEventOrderByInput {
  timestamp?: 'asc' | 'desc';
  eventType?: 'asc' | 'desc';
}

/**
 * Analytics event database delegate interface.
 */
export interface AnalyticsEventDelegate {
  /**
   * Creates multiple analytics events in a batch.
   */
  createMany(args: { data: AnalyticsEventCreateInput[] }): Promise<{ count: number }>;
  /**
   * Finds multiple analytics events matching the criteria.
   */
  findMany(args: {
    where: AnalyticsEventWhereInput;
    orderBy?: AnalyticsEventOrderByInput;
    take?: number;
    skip?: number;
  }): Promise<AnalyticsEventRecord[]>;
  /**
   * Counts analytics events matching the criteria.
   */
  count(args: { where: AnalyticsEventWhereInput }): Promise<number>;
}

/**
 * Where clause for filtering messages.
 */
export interface MessageWhereInput {
  channel?: { workspaceId: string };
  createdAt?: { gte?: Date; lte?: Date };
  threadId?: { not?: null } | null;
}

/**
 * Where clause for filtering workspace members.
 */
export interface WorkspaceMemberWhereInput {
  workspaceId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

/**
 * Where clause for filtering channels.
 */
export interface ChannelWhereInput {
  workspaceId?: string;
  isPrivate?: boolean;
  createdAt?: { gte?: Date; lte?: Date };
}

/**
 * Where clause for filtering attachments.
 */
export interface AttachmentWhereInput {
  message?: { channel?: { workspaceId: string } };
  createdAt?: { gte?: Date; lte?: Date };
}

/**
 * Aggregation result for attachments.
 */
export interface AttachmentAggregateResult {
  _count?: number;
  _sum: { fileSize: number | null };
  _avg: { fileSize: number | null };
}

/**
 * Where clause for filtering Orchestrators.
 */
export interface OrchestratorWhereInput {
  workspaceId?: string;
  status?: string;
}

/**
 * Where clause for filtering reactions.
 */
export interface ReactionWhereInput {
  message?: { channel?: { workspaceId: string } };
  createdAt?: { gte?: Date; lte?: Date };
}

/**
 * Database client interface for analytics.
 * Abstracts the Prisma client for dependency injection and testing.
 */
export interface AnalyticsDatabaseClient {
  /** Analytics event delegate (optional - may not exist in schema yet) */
  analyticsEvent?: AnalyticsEventDelegate;
  /** Message count operations */
  message: {
    count(args: { where: MessageWhereInput }): Promise<number>;
  };
  /** Workspace member count operations */
  workspaceMember: {
    count(args: { where: WorkspaceMemberWhereInput }): Promise<number>;
  };
  /** Channel count operations */
  channel: {
    count(args: { where: ChannelWhereInput }): Promise<number>;
  };
  /** Attachment operations */
  attachment: {
    count(args: { where: AttachmentWhereInput }): Promise<number>;
    aggregate(args: {
      where: AttachmentWhereInput;
      _count?: boolean;
      _sum?: { fileSize: boolean };
      _avg?: { fileSize: boolean };
    }): Promise<AttachmentAggregateResult>;
  };
  /** Orchestrator count operations */
  orchestrator: {
    count(args: { where: OrchestratorWhereInput }): Promise<number>;
  };
  /** Reaction count operations */
  reaction: {
    count(args: { where: ReactionWhereInput }): Promise<number>;
  };
  /** Execute raw SQL query */
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

/**
 * Redis pipeline operation result.
 */
export type RedisPipelineResult = [Error | null, number | string | string[] | null];

/**
 * Redis pipeline interface for batching commands.
 */
export interface RedisPipeline {
  /** Increment hash field by integer */
  hincrby(key: string, field: string, increment: number): RedisPipeline;
  /** Add members to a set */
  sadd(key: string, ...members: string[]): RedisPipeline;
  /** Set key expiration */
  expire(key: string, seconds: number): RedisPipeline;
  /** Execute all queued commands */
  exec(): Promise<RedisPipelineResult[]>;
}

/**
 * Redis client interface for analytics real-time counters.
 */
export interface AnalyticsRedisClient {
  /** Increment hash field by integer */
  hincrby(key: string, field: string, increment: number): Promise<number>;
  /** Get all fields and values in a hash */
  hgetall(key: string): Promise<Record<string, string>>;
  /** Add members to a set */
  sadd(key: string, ...members: string[]): Promise<number>;
  /** Set key expiration time */
  expire(key: string, seconds: number): Promise<number>;
  /** Create a pipeline for batching commands */
  pipeline(): RedisPipeline;
}

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

export interface AnalyticsServiceConfig {
  prisma: AnalyticsDatabaseClient;
  redis: AnalyticsRedisClient;
  batchSize?: number;
  flushIntervalMs?: number;
}

// =============================================================================
// ERRORS
// =============================================================================

export class AnalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class AnalyticsFlushError extends AnalyticsError {
  constructor(message: string, public readonly failedCount: number) {
    super(message);
    this.name = 'AnalyticsFlushError';
  }
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface AnalyticsService {
  track(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void>;
  flush(): Promise<void>;
  getMetrics(query: AnalyticsQuery): Promise<UsageMetrics>;
  getTrend(
    workspaceId: string,
    metric: string,
    currentPeriod: { start: Date; end: Date },
    previousPeriod: { start: Date; end: Date }
  ): Promise<TrendData>;
  generateInsightReport(workspaceId: string, period: AnalyticsPeriod): Promise<InsightReport>;
  getRealTimeStats(workspaceId: string): Promise<Record<string, number>>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class AnalyticsServiceImpl implements AnalyticsService {
  private prisma: AnalyticsDatabaseClient;
  private redis: AnalyticsRedisClient;
  private batchSize: number;
  private flushIntervalMs: number;
  private eventQueue: Omit<AnalyticsEvent, 'id'>[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AnalyticsServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.batchSize = config.batchSize ?? DEFAULT_ANALYTICS_BATCH_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS;
  }

  /**
   * Track an analytics event
   */
  async track(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.eventQueue.push(fullEvent);

    // Flush if batch is full
    if (this.eventQueue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushIntervalMs);
    }

    // Update real-time counters in Redis
    await this.updateRealTimeCounters(fullEvent);
  }

  /**
   * Flush event queue to database
   */
  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.eventQueue.length === 0) {
return;
}

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      if (this.prisma.analyticsEvent) {
        await this.prisma.analyticsEvent.createMany({
          data: events.map((e) => ({
            workspaceId: e.workspaceId,
            userId: e.userId,
            vpId: e.orchestratorId,
            eventType: e.eventType,
            eventData: JSON.stringify(e.eventData),
            sessionId: e.sessionId,
            timestamp: e.timestamp,
            metadata: e.metadata ? JSON.stringify(e.metadata) : null,
          })),
        });
      }
    } catch (error) {
      // Re-queue failed events
      this.eventQueue.push(...events);
      throw new AnalyticsFlushError(
        `Failed to flush analytics events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        events.length,
      );
    }
  }

  /**
   * Update real-time counters in Redis
   */
  private async updateRealTimeCounters(event: Omit<AnalyticsEvent, 'id'>): Promise<void> {
    const today = new Date().toISOString().split('T')[0] as string;
    const hour = new Date().getHours();

    const dailyKey = ANALYTICS_REDIS_KEYS.dailyEvents(event.workspaceId, today);
    const hourlyKey = ANALYTICS_REDIS_KEYS.hourlyEvents(event.workspaceId, today, hour);

    const pipeline = this.redis.pipeline();

    // Daily event counter
    pipeline.hincrby(dailyKey, event.eventType, 1);
    pipeline.expire(dailyKey, ANALYTICS_REDIS_TTL_SECONDS);

    // Hourly counter for today
    pipeline.hincrby(hourlyKey, event.eventType, 1);
    pipeline.expire(hourlyKey, ANALYTICS_REDIS_TTL_SECONDS / 3); // ~2 days

    // Active users tracking
    if (event.userId) {
      const activeKey = ANALYTICS_REDIS_KEYS.activeUsers(event.workspaceId, today);
      pipeline.sadd(activeKey, event.userId);
      pipeline.expire(activeKey, ANALYTICS_REDIS_TTL_SECONDS);
    }

    await pipeline.exec();
  }

  /**
   * Get usage metrics for a period
   */
  async getMetrics(query: AnalyticsQuery): Promise<UsageMetrics> {
    const { startDate, endDate } = this.getPeriodDates(query.period, query.startDate, query.endDate);

    const [messages, users, channels, files, calls, orchestrator] = await Promise.all([
      this.getMessageMetrics(query.workspaceId, startDate, endDate),
      this.getUserMetrics(query.workspaceId, startDate, endDate),
      this.getChannelMetrics(query.workspaceId, startDate, endDate),
      this.getFileMetrics(query.workspaceId, startDate, endDate),
      this.getCallMetrics(query.workspaceId, startDate, endDate),
      this.getOrchestratorMetrics(query.workspaceId, startDate, endDate),
    ]);

    return {
      workspaceId: query.workspaceId,
      period: query.period,
      startDate,
      endDate,
      messages,
      users,
      channels,
      files,
      calls,
      orchestrator,
    };
  }

  /**
   * Get message metrics
   */
  private async getMessageMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MessageMetrics> {
    const [totalMessages, byDay, byChannel, byUser, threads, reactions] = await Promise.all([
      this.prisma.message.count({
        where: {
          channel: { workspaceId },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE(m."createdAt") as date, COUNT(*) as count
        FROM "Message" m
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
        GROUP BY DATE(m."createdAt")
        ORDER BY date
      `,
      this.prisma.$queryRaw<Array<{ channelId: string; channelName: string; count: bigint }>>`
        SELECT c.id as "channelId", c.name as "channelName", COUNT(*) as count
        FROM "Message" m
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
        GROUP BY c.id, c.name
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.$queryRaw<Array<{ userId: string; userName: string; count: bigint }>>`
        SELECT u.id as "userId", u.name as "userName", COUNT(*) as count
        FROM "Message" m
        JOIN "User" u ON m."senderId" = u.id
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
        GROUP BY u.id, u.name
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.message.count({
        where: {
          channel: { workspaceId },
          createdAt: { gte: startDate, lte: endDate },
          threadId: { not: null },
        },
      }),
      this.prisma.reaction.count({
        where: {
          message: { channel: { workspaceId } },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const days = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      total: totalMessages,
      byDay: byDay.map((d) => ({ date: d.date, count: Number(d.count) })),
      byChannel: byChannel.map((c) => ({
        channelId: c.channelId,
        channelName: c.channelName,
        count: Number(c.count),
      })),
      byUser: byUser.map((u) => ({ userId: u.userId, userName: u.userName, count: Number(u.count) })),
      averagePerDay: Math.round(totalMessages / days),
      threadsCreated: threads,
      reactionsAdded: reactions,
    };
  }

  /**
   * Get user metrics
   */
  private async getUserMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UserMetrics> {
    const [totalMembers, newUsers, activeUsers, dailyActive, topContributors] = await Promise.all([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.workspaceMember.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT m."senderId") as count
        FROM "Message" m
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
      `,
      this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE(m."createdAt") as date, COUNT(DISTINCT m."senderId") as count
        FROM "Message" m
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
        GROUP BY DATE(m."createdAt")
        ORDER BY date
      `,
      this.prisma.$queryRaw<Array<{ userId: string; userName: string; messageCount: bigint }>>`
        SELECT u.id as "userId", u.name as "userName", COUNT(*) as "messageCount"
        FROM "Message" m
        JOIN "User" u ON m."senderId" = u.id
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND m."createdAt" >= ${startDate}
          AND m."createdAt" <= ${endDate}
        GROUP BY u.id, u.name
        ORDER BY "messageCount" DESC
        LIMIT 10
      `,
    ]);

    return {
      totalMembers,
      activeUsers: Number(activeUsers[0]?.count ?? 0),
      newUsers,
      dailyActiveUsers: dailyActive.map((d) => ({ date: d.date, count: Number(d.count) })),
      weeklyActiveUsers: 0, // Would need weekly calculation
      monthlyActiveUsers: Number(activeUsers[0]?.count ?? 0),
      averageSessionDuration: 0, // Would need session tracking
      topContributors: topContributors.map((t) => ({
        userId: t.userId,
        userName: t.userName,
        messageCount: Number(t.messageCount),
      })),
    };
  }

  /**
   * Get channel metrics
   */
  private async getChannelMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ChannelMetrics> {
    const [total, publicCount, newChannels, mostActive] = await Promise.all([
      this.prisma.channel.count({ where: { workspaceId } }),
      this.prisma.channel.count({ where: { workspaceId, isPrivate: false } }),
      this.prisma.channel.count({
        where: {
          workspaceId,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.$queryRaw<
        Array<{ channelId: string; channelName: string; messageCount: bigint; memberCount: bigint }>
      >`
        SELECT
          c.id as "channelId",
          c.name as "channelName",
          COUNT(m.id) as "messageCount",
          (SELECT COUNT(*) FROM "ChannelMember" cm WHERE cm."channelId" = c.id) as "memberCount"
        FROM "Channel" c
        LEFT JOIN "Message" m ON m."channelId" = c.id AND m."createdAt" >= ${startDate} AND m."createdAt" <= ${endDate}
        WHERE c."workspaceId" = ${workspaceId}
        GROUP BY c.id, c.name
        ORDER BY "messageCount" DESC
        LIMIT 10
      `,
    ]);

    return {
      total,
      public: publicCount,
      private: total - publicCount,
      newChannels,
      mostActive: mostActive.map((m) => ({
        channelId: m.channelId,
        channelName: m.channelName,
        messageCount: Number(m.messageCount),
        memberCount: Number(m.memberCount),
      })),
      averageMessagesPerChannel:
        total > 0
          ? Math.round(mostActive.reduce((sum, c) => sum + Number(c.messageCount), 0) / total)
          : 0,
    };
  }

  /**
   * Get file metrics
   */
  private async getFileMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FileMetrics> {
    const [stats, byType, topUploaders] = await Promise.all([
      this.prisma.attachment.aggregate({
        where: {
          message: { channel: { workspaceId } },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
        _sum: { fileSize: true },
        _avg: { fileSize: true },
      }),
      this.prisma.$queryRaw<Array<{ type: string; count: bigint; size: bigint }>>`
        SELECT a."fileType" as type, COUNT(*) as count, SUM(a."fileSize") as size
        FROM "Attachment" a
        JOIN "Message" m ON a."messageId" = m.id
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND a."createdAt" >= ${startDate}
          AND a."createdAt" <= ${endDate}
        GROUP BY a."fileType"
        ORDER BY count DESC
      `,
      this.prisma.$queryRaw<Array<{ userId: string; userName: string; count: bigint; size: bigint }>>`
        SELECT u.id as "userId", u.name as "userName", COUNT(*) as count, SUM(a."fileSize") as size
        FROM "Attachment" a
        JOIN "Message" m ON a."messageId" = m.id
        JOIN "User" u ON m."senderId" = u.id
        JOIN "Channel" c ON m."channelId" = c.id
        WHERE c."workspaceId" = ${workspaceId}
          AND a."createdAt" >= ${startDate}
          AND a."createdAt" <= ${endDate}
        GROUP BY u.id, u.name
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    return {
      totalUploaded: stats._count ?? 0,
      totalSize: Number(stats._sum.fileSize ?? 0),
      byType: byType.map((t) => ({ type: t.type, count: Number(t.count), size: Number(t.size) })),
      topUploaders: topUploaders.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        count: Number(u.count),
        size: Number(u.size),
      })),
      averageSizeBytes: Number(stats._avg.fileSize ?? 0),
    };
  }

  /**
   * Get call metrics
   */
  private async getCallMetrics(
    _workspaceId: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<CallMetrics> {
    // Would require Call model - returning placeholder
    return {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      averageParticipants: 0,
      byDay: [],
      peakHours: [],
    };
  }

  /**
   * Get Orchestrator metrics
   */
  private async getOrchestratorMetrics(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrchestratorMetrics> {
    const [totalOrchestrators, activeOrchestrators, orchestratorMessages] = await Promise.all([
      this.prisma.orchestrator.count({ where: { workspaceId } }),
      this.prisma.orchestrator.count({ where: { workspaceId, status: 'active' } }),
      this.prisma.$queryRaw<
        Array<{ orchestratorId: string; orchestratorName: string; discipline: string; messagesSent: bigint }>
      >`
        SELECT
          o.id as "orchestratorId",
          o.name as "orchestratorName",
          o.discipline,
          COUNT(m.id) as "messagesSent"
        FROM "Orchestrator" o
        LEFT JOIN "Message" m ON m."senderId" = o.id AND m."senderType" = 'orchestrator'
          AND m."createdAt" >= ${startDate} AND m."createdAt" <= ${endDate}
        WHERE o."workspaceId" = ${workspaceId}
        GROUP BY o.id, o.name, o.discipline
      `,
    ]);

    const totalMessagesSent = orchestratorMessages.reduce((sum, v) => sum + Number(v.messagesSent), 0);

    return {
      totalOrchestrators,
      activeOrchestrators,
      messagesSent: totalMessagesSent,
      messagesReceived: 0,
      tasksCompleted: 0,
      averageResponseTime: 0,
      byOrchestrator: orchestratorMessages.map((v) => ({
        orchestratorId: v.orchestratorId,
        orchestratorName: v.orchestratorName,
        discipline: v.discipline,
        messagesSent: Number(v.messagesSent),
        tasksCompleted: 0,
      })),
    };
  }

  /**
   * Get trend data comparing two periods
   */
  async getTrend(
    workspaceId: string,
    metric: string,
    currentPeriod: { start: Date; end: Date },
    previousPeriod: { start: Date; end: Date },
  ): Promise<TrendData> {
    const [current, previous] = await Promise.all([
      this.getMetricValue(workspaceId, metric, currentPeriod.start, currentPeriod.end),
      this.getMetricValue(workspaceId, metric, previousPeriod.start, previousPeriod.end),
    ]);

    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;

    return {
      current,
      previous,
      change,
      changePercent: Math.round(changePercent * 10) / 10,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    };
  }

  /**
   * Get a single metric value
   */
  private async getMetricValue(
    workspaceId: string,
    metric: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    switch (metric) {
      case 'messages':
        return this.prisma.message.count({
          where: {
            channel: { workspaceId },
            createdAt: { gte: startDate, lte: endDate },
          },
        });
      case 'active_users': {
        const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT m."senderId") as count
          FROM "Message" m
          JOIN "Channel" c ON m."channelId" = c.id
          WHERE c."workspaceId" = ${workspaceId}
            AND m."createdAt" >= ${startDate}
            AND m."createdAt" <= ${endDate}
        `;
        return Number(result[0]?.count ?? 0);
      }
      case 'files':
        return this.prisma.attachment.count({
          where: {
            message: { channel: { workspaceId } },
            createdAt: { gte: startDate, lte: endDate },
          },
        });
      default:
        return 0;
    }
  }

  /**
   * Generate insight report
   */
  async generateInsightReport(workspaceId: string, period: AnalyticsPeriod): Promise<InsightReport> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { startDate: _startDate, endDate: _endDate } = this.getPeriodDates(period);
    const metrics = await this.getMetrics({ workspaceId, period });

    const highlights: InsightHighlight[] = [];
    const recommendations: InsightRecommendation[] = [];

    // Analyze message activity
    if (metrics.messages.total > 0) {
      highlights.push({
        type: 'positive',
        title: 'Active Communication',
        description: `${metrics.messages.total.toLocaleString()} messages sent this period`,
        metric: 'messages',
        value: metrics.messages.total,
      });
    }

    // Analyze user engagement
    if (metrics.users.activeUsers > 0) {
      const engagementRate = Math.round((metrics.users.activeUsers / metrics.users.totalMembers) * 100);
      highlights.push({
        type: engagementRate >= 50 ? 'positive' : 'neutral',
        title: 'User Engagement',
        description: `${engagementRate}% of members are active`,
        metric: 'engagement_rate',
        value: engagementRate,
      });

      if (engagementRate < 50) {
        recommendations.push({
          priority: 'medium',
          title: 'Boost Engagement',
          description:
            'Consider creating more focused channels or running team activities to increase participation.',
        });
      }
    }

    // Orchestrator utilization
    if (metrics.orchestrator.totalOrchestrators > 0 && metrics.orchestrator.activeOrchestrators < metrics.orchestrator.totalOrchestrators) {
      recommendations.push({
        priority: 'low',
        title: 'Activate Orchestrators',
        description: `${metrics.orchestrator.totalOrchestrators - metrics.orchestrator.activeOrchestrators} Orchestrators are not currently active. Review their configuration.`,
      });
    }

    // Channel recommendations
    if (metrics.channels.total > 0 && metrics.channels.averageMessagesPerChannel < 10) {
      recommendations.push({
        priority: 'low',
        title: 'Consolidate Channels',
        description: 'Some channels have low activity. Consider consolidating or archiving inactive channels.',
      });
    }

    return {
      id: `report_${Date.now()}`,
      workspaceId,
      period,
      generatedAt: new Date(),
      highlights,
      recommendations,
    };
  }

  /**
   * Get period dates
   */
  getPeriodDates(
    period: AnalyticsPeriod,
    customStart?: Date,
    customEnd?: Date,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        startDate = customStart ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = customEnd ?? now;
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
    }

    return { startDate, endDate };
  }

  /**
   * Get real-time stats from Redis
   */
  async getRealTimeStats(workspaceId: string): Promise<Record<string, number>> {
    const today = new Date().toISOString().split('T')[0] as string;
    const key = ANALYTICS_REDIS_KEYS.dailyEvents(workspaceId, today);

    const stats = await this.redis.hgetall(key);
    return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, parseInt(v) || 0]));
  }

  /**
   * Get event queue length (for testing)
   */
  getQueueLength(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear flush timeout (for cleanup)
   */
  clearFlushTimeout(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new AnalyticsService instance
 */
export function createAnalyticsService(config: AnalyticsServiceConfig): AnalyticsService {
  return new AnalyticsServiceImpl(config);
}

// Singleton instance holder
let analyticsServiceInstance: AnalyticsService | null = null;

/**
 * Get or create the singleton AnalyticsService instance
 */
export function getAnalyticsService(config?: AnalyticsServiceConfig): AnalyticsService {
  if (!analyticsServiceInstance && config) {
    analyticsServiceInstance = createAnalyticsService(config);
  }
  if (!analyticsServiceInstance) {
    throw new AnalyticsError('AnalyticsService not initialized. Provide config on first call.');
  }
  return analyticsServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetAnalyticsService(): void {
  analyticsServiceInstance = null;
}
