/**
 * @fileoverview Tests for analytics API routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// MOCKS
// =============================================================================

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Prisma
const mockPrisma = {
  workspaceMember: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  message: {
    count: vi.fn(),
  },
  channel: {
    count: vi.fn(),
  },
  attachment: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  vP: {
    count: vi.fn(),
  },
  reaction: {
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock('@genesis/database', () => ({
  prisma: mockPrisma,
}));

// Mock Redis
vi.mock('@/lib/redis', () => ({
  redis: {
    hgetall: vi.fn(),
    hincrby: vi.fn(),
    expire: vi.fn(),
    sadd: vi.fn(),
    pipeline: vi.fn(() => ({
      hincrby: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
  },
}));

vi.mock('@genesis/core', () => ({
  AnalyticsService: vi.fn().mockImplementation(() => ({
    getMetrics: vi.fn().mockResolvedValue({
      workspaceId: 'ws-1',
      period: 'month',
      startDate: new Date(),
      endDate: new Date(),
      messages: {
        total: 1000,
        averagePerDay: 33,
        byDay: [],
        byChannel: [],
        byUser: [],
        threadsCreated: 50,
        reactionsAdded: 200,
      },
      users: {
        totalMembers: 50,
        activeUsers: 30,
        newUsers: 5,
        dailyActiveUsers: [],
        weeklyActiveUsers: 40,
        monthlyActiveUsers: 45,
        averageSessionDuration: 3600,
        topContributors: [],
      },
      channels: {
        total: 20,
        public: 15,
        private: 5,
        newChannels: 2,
        mostActive: [],
        averageMessagesPerChannel: 50,
      },
      files: {
        totalUploaded: 100,
        totalSize: 1024000,
        byType: [],
        topUploaders: [],
        averageSizeBytes: 10240,
      },
      calls: {
        totalCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        averageParticipants: 0,
        byDay: [],
        peakHours: [],
      },
      vp: {
        totalVPs: 5,
        activeVPs: 3,
        messagesSent: 100,
        messagesReceived: 500,
        tasksCompleted: 50,
        averageResponseTime: 1000,
        byVP: [],
      },
    }),
    getTrend: vi.fn().mockResolvedValue({
      current: 100,
      previous: 80,
      change: 20,
      changePercent: 25,
      trend: 'up',
    }),
    getRealTimeStats: vi.fn().mockResolvedValue({
      'message.sent': 50,
      'message.received': 100,
      'user.active': 20,
    }),
    generateInsightReport: vi.fn().mockResolvedValue({
      id: 'report-1',
      workspaceId: 'ws-1',
      period: 'month',
      generatedAt: new Date(),
      highlights: [
        {
          type: 'positive',
          title: 'Active Communication',
          description: '1000 messages sent',
          metric: 'messages',
          value: 1000,
        },
      ],
      recommendations: [],
    }),
    track: vi.fn(),
  })),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@genesis/database';

describe('Analytics API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/workspaces/[workspaceId]/analytics/metrics', () => {
    it('should require authentication', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const { GET } = await import('../metrics/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/metrics');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(401);
    });

    it('should require workspace membership', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);

      const { GET } = await import('../metrics/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/metrics');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(403);
    });

    it('should return metrics for authorized user', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const { GET } = await import('../metrics/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/metrics?period=month');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages.total).toBe(1000);
    });

    it('should support different periods', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'member',
      } as any);

      const { GET } = await import('../metrics/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/metrics?period=week');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/workspaces/[workspaceId]/analytics/realtime', () => {
    it('should return real-time stats', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'member',
      } as any);

      const { GET } = await import('../realtime/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/realtime');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.stats).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/workspaces/[workspaceId]/analytics/trends', () => {
    it('should return trend data', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'member',
      } as any);

      const { GET } = await import('../trends/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/trends?metric=messages');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.trend).toBeDefined();
      expect(data.trend.trend).toBe('up');
    });
  });

  describe('GET /api/workspaces/[workspaceId]/analytics/insights', () => {
    it('should generate insights report', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'member',
      } as any);

      const { GET } = await import('../insights/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/insights?period=month');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.highlights).toBeDefined();
      expect(data.recommendations).toBeDefined();
    });
  });

  describe('POST /api/workspaces/[workspaceId]/analytics/track', () => {
    it('should track analytics event', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });

      const { POST } = await import('../track/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'message.sent',
          eventData: { channelId: 'ch-1' },
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should require event type', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });

      const { POST } = await import('../track/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/track', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/workspaces/[workspaceId]/analytics/export', () => {
    it('should require admin role', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'member',
      } as any);

      const { POST } = await import('../export/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/export', {
        method: 'POST',
        body: JSON.stringify({ period: 'month', format: 'json' }),
      });
      const response = await POST(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(403);
    });

    it('should export analytics for admin', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-1', name: 'Test' },
        expires: '',
      });
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'mem-1',
        role: 'admin',
      } as any);

      const { POST } = await import('../export/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/analytics/export', {
        method: 'POST',
        body: JSON.stringify({ period: 'month', format: 'json' }),
      });
      const response = await POST(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
    });
  });
});
