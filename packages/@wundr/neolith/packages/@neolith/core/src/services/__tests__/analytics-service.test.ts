/**
 * @fileoverview Tests for AnalyticsService
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsPeriod } from '../../types/analytics';
import type { AnalyticsDatabaseClient, AnalyticsRedisClient } from '../analytics-service';
import {
  AnalyticsFlushError,
  AnalyticsServiceImpl,
  createAnalyticsService,
  getAnalyticsService,
  resetAnalyticsService,
} from '../analytics-service';

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockPrisma(): AnalyticsDatabaseClient {
  return {
    analyticsEvent: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    message: {
      count: vi.fn().mockResolvedValue(0),
    },
    workspaceMember: {
      count: vi.fn().mockResolvedValue(0),
    },
    channel: {
      count: vi.fn().mockResolvedValue(0),
    },
    attachment: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({
        _count: 0,
        _sum: { fileSize: null },
        _avg: { fileSize: null },
      }),
    },
    vP: {
      count: vi.fn().mockResolvedValue(0),
    },
    reaction: {
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

function createMockRedis(): AnalyticsRedisClient {
  const pipelineCommands: Array<() => void> = [];

  return {
    hincrby: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    sadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => ({
      hincrby: vi.fn(() => {
        pipelineCommands.push(vi.fn());
        return { hincrby: vi.fn(), sadd: vi.fn(), expire: vi.fn(), exec: vi.fn() };
      }),
      sadd: vi.fn(() => {
        pipelineCommands.push(vi.fn());
        return { hincrby: vi.fn(), sadd: vi.fn(), expire: vi.fn(), exec: vi.fn() };
      }),
      expire: vi.fn(() => {
        pipelineCommands.push(vi.fn());
        return { hincrby: vi.fn(), sadd: vi.fn(), expire: vi.fn(), exec: vi.fn() };
      }),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsServiceImpl;
  let mockPrisma: AnalyticsDatabaseClient;
  let mockRedis: AnalyticsRedisClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();

    analyticsService = new AnalyticsServiceImpl({
      prisma: mockPrisma,
      redis: mockRedis,
      batchSize: 10,
      flushIntervalMs: 5000,
    });
  });

  afterEach(() => {
    analyticsService.clearFlushTimeout();
    vi.useRealTimers();
    resetAnalyticsService();
  });

  // ===========================================================================
  // EVENT TRACKING TESTS
  // ===========================================================================

  describe('track', () => {
    it('should queue analytics events for batch processing', async () => {
      await analyticsService.track({
        workspaceId: 'ws-1',
        userId: 'user-1',
        eventType: 'message.sent',
        eventData: { channelId: 'ch-1' },
      });

      // Entry should be queued, not written yet
      expect(mockPrisma.analyticsEvent?.createMany).not.toHaveBeenCalled();
      expect(analyticsService.getQueueLength()).toBe(1);
    });

    it('should flush batch when size limit reached', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 10,
      });

      // Add 10 entries (batch size)
      for (let i = 0; i < 10; i++) {
        await analyticsService.track({
          workspaceId: 'ws-1',
          userId: `user-${i}`,
          eventType: 'message.sent',
          eventData: { index: i },
        });
      }

      expect(mockPrisma.analyticsEvent?.createMany).toHaveBeenCalled();
      expect(analyticsService.getQueueLength()).toBe(0);
    });

    it('should update Redis real-time counters', async () => {
      await analyticsService.track({
        workspaceId: 'ws-1',
        userId: 'user-1',
        eventType: 'message.sent',
        eventData: {},
      });

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should include session ID when provided', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        userId: 'user-1',
        eventType: 'user.login',
        eventData: {},
        sessionId: 'sess-123',
      });

      await analyticsService.flush();

      const createCall = (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data[0].sessionId).toBe('sess-123');
    });

    it('should include metadata when provided', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        userId: 'user-1',
        eventType: 'user.login',
        eventData: {},
        metadata: {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          platform: 'web',
        },
      });

      await analyticsService.flush();

      const createCall = (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const metadata = JSON.parse(createCall.data[0].metadata);
      expect(metadata.userAgent).toBe('Mozilla/5.0');
      expect(metadata.ipAddress).toBe('192.168.1.1');
    });

    it('should track Orchestrator events with vpId', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        vpId: 'orchestrator-1',
        eventType: 'vp.message.sent',
        eventData: { channelId: 'ch-1' },
      });

      await analyticsService.flush();

      const createCall = (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data[0].orchestratorId).toBe('orchestrator-1');
      expect(createCall.data[0].eventType).toBe('vp.message.sent');
    });
  });

  // ===========================================================================
  // FLUSH TESTS
  // ===========================================================================

  describe('flush', () => {
    it('should do nothing when queue is empty', async () => {
      await analyticsService.flush();
      expect(mockPrisma.analyticsEvent?.createMany).not.toHaveBeenCalled();
    });

    it('should flush queued events to database', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 3,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });
      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });
      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });

      await analyticsService.flush();

      expect(mockPrisma.analyticsEvent?.createMany).toHaveBeenCalledTimes(1);
      const createCall = (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data).toHaveLength(3);
    });

    it('should re-queue events on flush failure', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error'),
      );

      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });

      await expect(analyticsService.flush()).rejects.toThrow(AnalyticsFlushError);
      expect(analyticsService.getQueueLength()).toBe(1);
    });

    it('should serialize eventData as JSON', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: { channelId: 'ch-1', messageLength: 100 },
      });

      await analyticsService.flush();

      const createCall = (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const eventData = JSON.parse(createCall.data[0].eventData);
      expect(eventData.channelId).toBe('ch-1');
      expect(eventData.messageLength).toBe(100);
    });

    it('should auto-flush after interval', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });

      // Fast forward past flush interval
      await vi.advanceTimersByTimeAsync(6000);

      expect(mockPrisma.analyticsEvent?.createMany).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // METRICS TESTS
  // ===========================================================================

  describe('getMetrics', () => {
    it('should return usage metrics for a workspace', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      (mockPrisma.channel.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (mockPrisma.vP.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.workspaceId).toBe('ws-1');
      expect(metrics.period).toBe('week');
      expect(metrics.messages).toBeDefined();
      expect(metrics.users).toBeDefined();
      expect(metrics.channels).toBeDefined();
      expect(metrics.files).toBeDefined();
      expect(metrics.calls).toBeDefined();
      expect(metrics.orchestrator).toBeDefined();
    });

    it('should calculate message metrics correctly', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100) // total messages
        .mockResolvedValueOnce(20); // threads
      (mockPrisma.reaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { date: '2024-01-01', count: BigInt(30) },
          { date: '2024-01-02', count: BigInt(70) },
        ])
        .mockResolvedValueOnce([{ channelId: 'ch-1', channelName: 'general', count: BigInt(60) }])
        .mockResolvedValueOnce([{ userId: 'u-1', userName: 'John', count: BigInt(40) }])
        .mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.messages.total).toBe(100);
      expect(metrics.messages.threadsCreated).toBe(20);
      expect(metrics.messages.reactionsAdded).toBe(50);
      expect(metrics.messages.byDay).toHaveLength(2);
    });

    it('should calculate user metrics correctly', async () => {
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(50) // total members
        .mockResolvedValueOnce(5); // new users
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // byDay messages
        .mockResolvedValueOnce([]) // byChannel
        .mockResolvedValueOnce([]) // byUser
        .mockResolvedValueOnce([{ count: BigInt(30) }]) // active users
        .mockResolvedValueOnce([{ date: '2024-01-01', count: BigInt(25) }]) // daily active
        .mockResolvedValueOnce([
          { userId: 'u-1', userName: 'Alice', messageCount: BigInt(100) },
        ]) // top contributors
        .mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.users.totalMembers).toBe(50);
      expect(metrics.users.newUsers).toBe(5);
      expect(metrics.users.activeUsers).toBe(30);
    });

    it('should calculate channel metrics correctly', async () => {
      (mockPrisma.channel.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(10) // total channels
        .mockResolvedValueOnce(8) // public channels
        .mockResolvedValueOnce(2); // new channels
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // messages byDay
        .mockResolvedValueOnce([]) // byChannel
        .mockResolvedValueOnce([]) // byUser
        .mockResolvedValueOnce([{ count: BigInt(0) }]) // active users
        .mockResolvedValueOnce([]) // daily active
        .mockResolvedValueOnce([]) // top contributors
        .mockResolvedValueOnce([
          { channelId: 'ch-1', channelName: 'general', messageCount: BigInt(50), memberCount: BigInt(10) },
        ])
        .mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.channels.total).toBe(10);
      expect(metrics.channels.public).toBe(8);
      expect(metrics.channels.private).toBe(2);
      expect(metrics.channels.newChannels).toBe(2);
    });

    it('should calculate file metrics correctly', async () => {
      (mockPrisma.attachment.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: 25,
        _sum: { fileSize: 1024000 },
        _avg: { fileSize: 40960 },
      });
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // messages byDay
        .mockResolvedValueOnce([]) // byChannel
        .mockResolvedValueOnce([]) // byUser
        .mockResolvedValueOnce([{ count: BigInt(0) }]) // active users
        .mockResolvedValueOnce([]) // daily active
        .mockResolvedValueOnce([]) // top contributors
        .mockResolvedValueOnce([]) // most active channels
        .mockResolvedValueOnce([{ type: 'image/png', count: BigInt(15), size: BigInt(500000) }])
        .mockResolvedValueOnce([{ userId: 'u-1', userName: 'Bob', count: BigInt(10), size: BigInt(300000) }])
        .mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.files.totalUploaded).toBe(25);
      expect(metrics.files.totalSize).toBe(1024000);
      expect(metrics.files.averageSizeBytes).toBe(40960);
    });

    it('should calculate Orchestrator metrics correctly', async () => {
      (mockPrisma.vP.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5) // total VPs
        .mockResolvedValueOnce(3); // active VPs
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // messages byDay
        .mockResolvedValueOnce([]) // byChannel
        .mockResolvedValueOnce([]) // byUser
        .mockResolvedValueOnce([{ count: BigInt(0) }]) // active users
        .mockResolvedValueOnce([]) // daily active
        .mockResolvedValueOnce([]) // top contributors
        .mockResolvedValueOnce([]) // most active channels
        .mockResolvedValueOnce([]) // files byType
        .mockResolvedValueOnce([]) // top uploaders
        .mockResolvedValueOnce([
          { vpId: 'orchestrator-1', vpName: 'Sales VP', discipline: 'sales', messagesSent: BigInt(100) },
        ])
        .mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.orchestrator.totalOrchestrators).toBe(5);
      expect(metrics.orchestrator.activeOrchestrators).toBe(3);
      expect(metrics.orchestrator.messagesSent).toBe(100);
    });

    it('should return placeholder call metrics', async () => {
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-1',
        period: 'week',
      });

      expect(metrics.calls.totalCalls).toBe(0);
      expect(metrics.calls.totalDuration).toBe(0);
      expect(metrics.calls.byDay).toEqual([]);
    });
  });

  // ===========================================================================
  // TREND TESTS
  // ===========================================================================

  describe('getTrend', () => {
    it('should calculate positive trend', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(150) // current period
        .mockResolvedValueOnce(100); // previous period

      const trend = await analyticsService.getTrend(
        'ws-1',
        'messages',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.current).toBe(150);
      expect(trend.previous).toBe(100);
      expect(trend.change).toBe(50);
      expect(trend.changePercent).toBe(50);
      expect(trend.trend).toBe('up');
    });

    it('should calculate negative trend', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(50) // current period
        .mockResolvedValueOnce(100); // previous period

      const trend = await analyticsService.getTrend(
        'ws-1',
        'messages',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.change).toBe(-50);
      expect(trend.changePercent).toBe(-50);
      expect(trend.trend).toBe('down');
    });

    it('should calculate stable trend', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100);

      const trend = await analyticsService.getTrend(
        'ws-1',
        'messages',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.change).toBe(0);
      expect(trend.changePercent).toBe(0);
      expect(trend.trend).toBe('stable');
    });

    it('should handle zero previous value', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);

      const trend = await analyticsService.getTrend(
        'ws-1',
        'messages',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.changePercent).toBe(100);
      expect(trend.trend).toBe('up');
    });

    it('should calculate trend for active_users metric', async () => {
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([{ count: BigInt(20) }]);

      const trend = await analyticsService.getTrend(
        'ws-1',
        'active_users',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.current).toBe(30);
      expect(trend.previous).toBe(20);
      expect(trend.trend).toBe('up');
    });

    it('should calculate trend for files metric', async () => {
      (mockPrisma.attachment.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(20);

      const trend = await analyticsService.getTrend(
        'ws-1',
        'files',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.current).toBe(25);
      expect(trend.previous).toBe(20);
    });

    it('should return zero for unknown metrics', async () => {
      const trend = await analyticsService.getTrend(
        'ws-1',
        'unknown_metric',
        { start: new Date('2024-01-08'), end: new Date('2024-01-14') },
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      );

      expect(trend.current).toBe(0);
      expect(trend.previous).toBe(0);
      expect(trend.trend).toBe('stable');
    });
  });

  // ===========================================================================
  // INSIGHT REPORT TESTS
  // ===========================================================================

  describe('generateInsightReport', () => {
    it('should generate report with highlights', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(500);
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(30) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'week');

      expect(report.workspaceId).toBe('ws-1');
      expect(report.period).toBe('week');
      expect(report.highlights).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.id).toMatch(/^report_/);
    });

    it('should include active communication highlight', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(1000);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'month');

      const communicationHighlight = report.highlights.find((h) => h.metric === 'messages');
      expect(communicationHighlight).toBeDefined();
      expect(communicationHighlight?.type).toBe('positive');
      expect(communicationHighlight?.value).toBe(1000);
    });

    it('should include engagement rate highlight', async () => {
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100) // total members
        .mockResolvedValueOnce(0); // new users
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(60) }]) // active users
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'week');

      const engagementHighlight = report.highlights.find((h) => h.metric === 'engagement_rate');
      expect(engagementHighlight).toBeDefined();
      expect(engagementHighlight?.value).toBe(60);
      expect(engagementHighlight?.type).toBe('positive');
    });

    it('should recommend boosting engagement when low', async () => {
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(20) }]) // 20% engagement
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'week');

      const engagementRec = report.recommendations.find((r) => r.title === 'Boost Engagement');
      expect(engagementRec).toBeDefined();
      expect(engagementRec?.priority).toBe('medium');
    });

    it('should recommend activating VPs when some are inactive', async () => {
      (mockPrisma.vP.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5) // total VPs
        .mockResolvedValueOnce(2); // active VPs
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'week');

      const vpRec = report.recommendations.find((r) => r.title === 'Activate VPs');
      expect(vpRec).toBeDefined();
      expect(vpRec?.description).toContain('3 VPs are not currently active');
    });

    it('should recommend consolidating channels when low activity', async () => {
      (mockPrisma.channel.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(0);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ channelId: 'ch-1', channelName: 'test', messageCount: BigInt(5), memberCount: BigInt(2) }])
        .mockResolvedValue([]);

      const report = await analyticsService.generateInsightReport('ws-1', 'week');

      const channelRec = report.recommendations.find((r) => r.title === 'Consolidate Channels');
      expect(channelRec).toBeDefined();
    });
  });

  // ===========================================================================
  // PERIOD CALCULATION TESTS
  // ===========================================================================

  describe('getPeriodDates', () => {
    it('should calculate day period', () => {
      const { startDate, endDate } = analyticsService.getPeriodDates('day');

      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(endDate).toBeDefined();
    });

    it('should calculate week period', () => {
      const now = new Date();
      const { startDate } = analyticsService.getPeriodDates('week');

      const expectedStart = new Date(now);
      expectedStart.setDate(now.getDate() - 7);

      expect(startDate.getDate()).toBe(expectedStart.getDate());
    });

    it('should calculate month period', () => {
      const now = new Date();
      const { startDate } = analyticsService.getPeriodDates('month');

      const expectedStart = new Date(now);
      expectedStart.setMonth(now.getMonth() - 1);

      expect(startDate.getMonth()).toBe(expectedStart.getMonth());
    });

    it('should calculate quarter period', () => {
      const now = new Date();
      const { startDate } = analyticsService.getPeriodDates('quarter');

      const expectedStart = new Date(now);
      expectedStart.setMonth(now.getMonth() - 3);

      expect(startDate.getMonth()).toBe(expectedStart.getMonth());
    });

    it('should calculate year period', () => {
      const now = new Date();
      const { startDate } = analyticsService.getPeriodDates('year');

      const expectedStart = new Date(now);
      expectedStart.setFullYear(now.getFullYear() - 1);

      expect(startDate.getFullYear()).toBe(expectedStart.getFullYear());
    });

    it('should handle custom period with dates', () => {
      const customStart = new Date('2024-01-01');
      const customEnd = new Date('2024-01-31');

      const { startDate, endDate } = analyticsService.getPeriodDates('custom', customStart, customEnd);

      expect(startDate).toEqual(customStart);
      expect(endDate).toEqual(customEnd);
    });

    it('should default custom period without dates', () => {
      const { startDate } = analyticsService.getPeriodDates('custom');

      // Should default to 30 days ago
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      expect(Math.abs(startDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
    });
  });

  // ===========================================================================
  // REAL-TIME STATS TESTS
  // ===========================================================================

  describe('getRealTimeStats', () => {
    it('should return stats from Redis', async () => {
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({
        'message.sent': '100',
        'message.received': '50',
        'file.uploaded': '10',
      });

      const stats = await analyticsService.getRealTimeStats('ws-1');

      expect(stats['message.sent']).toBe(100);
      expect(stats['message.received']).toBe(50);
      expect(stats['file.uploaded']).toBe(10);
    });

    it('should return empty object when no stats', async () => {
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const stats = await analyticsService.getRealTimeStats('ws-1');

      expect(stats).toEqual({});
    });

    it('should handle invalid numeric values', async () => {
      (mockRedis.hgetall as ReturnType<typeof vi.fn>).mockResolvedValue({
        'message.sent': 'invalid',
        'file.uploaded': '20',
      });

      const stats = await analyticsService.getRealTimeStats('ws-1');

      expect(stats['message.sent']).toBe(0);
      expect(stats['file.uploaded']).toBe(20);
    });
  });

  // ===========================================================================
  // FACTORY FUNCTION TESTS
  // ===========================================================================

  describe('createAnalyticsService', () => {
    it('should create a new service instance', () => {
      const service = createAnalyticsService({
        prisma: mockPrisma,
        redis: mockRedis,
      });

      expect(service).toBeDefined();
      expect(service.track).toBeDefined();
      expect(service.getMetrics).toBeDefined();
    });
  });

  describe('getAnalyticsService', () => {
    it('should create singleton on first call with config', () => {
      const service = getAnalyticsService({
        prisma: mockPrisma,
        redis: mockRedis,
      });

      expect(service).toBeDefined();
    });

    it('should return same instance on subsequent calls', () => {
      const service1 = getAnalyticsService({
        prisma: mockPrisma,
        redis: mockRedis,
      });
      const service2 = getAnalyticsService();

      expect(service1).toBe(service2);
    });

    it('should throw if called without config before initialization', () => {
      resetAnalyticsService();

      expect(() => getAnalyticsService()).toThrow('AnalyticsService not initialized');
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle workspace with no activity', async () => {
      (mockPrisma.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockPrisma.workspaceMember.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockPrisma.channel.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockPrisma.vP.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const metrics = await analyticsService.getMetrics({
        workspaceId: 'ws-empty',
        period: 'week',
      });

      expect(metrics.messages.total).toBe(0);
      expect(metrics.users.totalMembers).toBe(0);
      expect(metrics.channels.total).toBe(0);
    });

    it('should handle service without analyticsEvent model', async () => {
      const prismaWithoutAnalytics = {
        ...mockPrisma,
        analyticsEvent: undefined,
      };

      const service = new AnalyticsServiceImpl({
        prisma: prismaWithoutAnalytics,
        redis: mockRedis,
        batchSize: 2,
      });

      await service.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });
      await service.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });

      // Should not throw even without analyticsEvent model
      await expect(service.flush()).resolves.not.toThrow();
    });

    it('should clear flush timeout on manual flush', async () => {
      await analyticsService.track({
        workspaceId: 'ws-1',
        eventType: 'message.sent',
        eventData: {},
      });

      await analyticsService.flush();

      // The timeout should be cleared
      expect(analyticsService.getQueueLength()).toBe(0);
    });

    it('should handle multiple different event types', async () => {
      (mockPrisma.analyticsEvent?.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 10,
      });

      const eventTypes: Array<{ type: string; data: Record<string, unknown> }> = [
        { type: 'message.sent', data: { channelId: 'ch-1' } },
        { type: 'message.received', data: { channelId: 'ch-1' } },
        { type: 'file.uploaded', data: { fileSize: 1024 } },
        { type: 'channel.joined', data: { channelId: 'ch-2' } },
        { type: 'user.login', data: { device: 'web' } },
        { type: 'vp.message.sent', data: { vpId: 'orchestrator-1' } },
        { type: 'search.performed', data: { query: 'test' } },
        { type: 'reaction.added', data: { emoji: ':thumbsup:' } },
        { type: 'thread.created', data: { parentId: 'msg-1' } },
        { type: 'call.started', data: { type: 'huddle' } },
      ];

      for (const event of eventTypes) {
        await analyticsService.track({
          workspaceId: 'ws-1',
          eventType: event.type as 'message.sent',
          eventData: event.data,
        });
      }

      // Should have triggered flush at 10 events
      expect(mockPrisma.analyticsEvent?.createMany).toHaveBeenCalled();
    });

    it('should handle all valid analytics periods', async () => {
      const periods: AnalyticsPeriod[] = ['day', 'week', 'month', 'quarter', 'year', 'custom'];

      for (const period of periods) {
        const { startDate, endDate } = analyticsService.getPeriodDates(period);
        expect(startDate).toBeInstanceOf(Date);
        expect(endDate).toBeInstanceOf(Date);
        expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });
  });
});
