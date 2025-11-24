/**
 * @fileoverview Tests for daemon API routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks
vi.mock('@/lib/prisma', () => ({
  prisma: {
    daemonCredential: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    channelMember: {
      findFirst: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    vP: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    publish: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    expire: vi.fn(),
    lrange: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
    hset: vi.fn(),
    hgetall: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('@genesis/core', () => ({
  DaemonAuthService: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
      scopes: ['messages:read', 'messages:write'],
      daemonId: 'daemon-1',
      vpId: 'vp-1',
    }),
    verifyAccessToken: vi.fn().mockResolvedValue({
      token: 'test-token',
      type: 'access',
      expiresAt: new Date(Date.now() + 3600000),
      daemonId: 'daemon-1',
      vpId: 'vp-1',
      workspaceId: 'ws-1',
      scopes: ['messages:read', 'messages:write', 'presence:write', 'vp:status', 'vp:config'],
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    }),
    hasScope: vi.fn().mockReturnValue(true),
    getActiveSessions: vi.fn().mockResolvedValue([]),
    updateHeartbeat: vi.fn(),
  })),
  DaemonApiService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue('msg-1'),
    getMessages: vi.fn().mockResolvedValue([]),
    getChannels: vi.fn().mockResolvedValue([]),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    updatePresence: vi.fn(),
    updateVPStatus: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({
      vpId: 'vp-1',
      workspaceId: 'ws-1',
      settings: { heartbeatIntervalMs: 30000 },
      features: { messaging: true },
    }),
    getPendingEvents: vi.fn().mockResolvedValue([]),
    acknowledgeEvents: vi.fn(),
    reportMetrics: vi.fn(),
  })),
}));

describe('Daemon API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/daemon/auth', () => {
    it('should authenticate with valid credentials', async () => {
      const { POST } = await import('../auth/route');

      const request = new NextRequest('http://localhost/api/daemon/auth', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: 'dk_test',
          apiSecret: 'secret',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });

    it('should require apiKey and apiSecret', async () => {
      const { POST } = await import('../auth/route');

      const request = new NextRequest('http://localhost/api/daemon/auth', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/daemon/auth/refresh', () => {
    it('should refresh token', async () => {
      const { POST } = await import('../auth/refresh/route');

      const request = new NextRequest('http://localhost/api/daemon/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: 'valid-refresh-token',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/daemon/messages', () => {
    it('should require authorization header', async () => {
      const { GET } = await import('../messages/route');

      const request = new NextRequest('http://localhost/api/daemon/messages?channelId=ch-1');

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should get messages with valid token', async () => {
      const { GET } = await import('../messages/route');

      const request = new NextRequest('http://localhost/api/daemon/messages?channelId=ch-1', {
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/daemon/messages', () => {
    it('should send message with valid token', async () => {
      const { POST } = await import('../messages/route');

      const request = new NextRequest('http://localhost/api/daemon/messages', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          channelId: 'ch-1',
          content: 'Hello from VP',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.messageId).toBeDefined();
    });
  });

  describe('PUT /api/daemon/presence', () => {
    it('should update presence', async () => {
      const { PUT } = await import('../presence/route');

      const request = new NextRequest('http://localhost/api/daemon/presence', {
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          status: 'online',
          statusText: 'Ready to help',
        }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });

    it('should reject invalid status', async () => {
      const { PUT } = await import('../presence/route');

      const request = new NextRequest('http://localhost/api/daemon/presence', {
        method: 'PUT',
        headers: {
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          status: 'invalid-status',
        }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/daemon/config', () => {
    it('should get VP configuration', async () => {
      const { GET } = await import('../config/route');

      const request = new NextRequest('http://localhost/api/daemon/config', {
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.vpId).toBeDefined();
      expect(data.features).toBeDefined();
    });
  });

  describe('POST /api/daemon/heartbeat', () => {
    it('should process heartbeat', async () => {
      const { POST } = await import('../heartbeat/route');

      const request = new NextRequest('http://localhost/api/daemon/heartbeat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          vpId: 'vp-1',
          apiKey: 'gns_test123',
          metrics: {
            cpuUsage: 45,
            memoryUsage: 60,
            activeConnections: 10,
            messageQueueSize: 5,
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/daemon/events', () => {
    it('should get pending events', async () => {
      const { GET } = await import('../events/route');

      const request = new NextRequest('http://localhost/api/daemon/events', {
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.events)).toBe(true);
    });
  });
});
