/**
 * Audit Logs API Route Tests
 *
 * Comprehensive test suite for audit logs REST API endpoints covering:
 * - GET /api/workspaces/:workspaceId/admin/audit-logs - Query audit logs
 * - POST /api/workspaces/:workspaceId/admin/audit-logs/export - Request export
 * - GET /api/workspaces/:workspaceId/admin/audit-logs/export - Get export status
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/workspaces/[workspaceId]/admin/audit-logs/__tests__/audit.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@genesis/database', () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock('@genesis/core/redis', () => ({
  redis: {},
}));

// Mock AuditService
const mockAuditService = {
  query: vi.fn(),
  getStats: vi.fn(),
  requestExport: vi.fn(),
  getExport: vi.fn(),
  log: vi.fn(),
};

vi.mock('@genesis/core', () => ({
  AuditServiceImpl: vi.fn().mockImplementation(() => mockAuditService),
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      name: 'Test Admin',
      email: 'admin@example.com',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function createMockAuditResponse() {
  return {
    entries: [
      {
        id: 'audit-1',
        timestamp: new Date(),
        action: 'user.login',
        category: 'authentication',
        severity: 'info',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'Test User',
        resourceType: 'session',
        resourceId: 'session-1',
        workspaceId: 'ws-1',
        success: true,
      },
    ],
    total: 1,
    pagination: {
      hasMore: false,
    },
  };
}

function createMockMembership(role: string) {
  return {
    id: 'mem-1',
    userId: 'user-123',
    workspaceId: 'ws-1',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Audit Logs API Routes', () => {
  let auth: ReturnType<typeof vi.fn>;
  let prisma: { workspaceMember: { findFirst: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    vi.clearAllMocks();

    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;

    const prismaModule = await import('@genesis/database');
    prisma = prismaModule.prisma as typeof prisma;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // GET /api/workspaces/:workspaceId/admin/audit-logs - Query Logs
  // ===========================================================================

  describe('GET /api/workspaces/:workspaceId/admin/audit-logs', () => {
    it('should require authentication', async () => {
      auth.mockResolvedValue(null);

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/admin/audit-logs');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should require admin role', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('member'));

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/admin/audit-logs');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should return audit logs for admin', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/admin/audit-logs');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('entries');
      expect(data).toHaveProperty('total');
      expect(data.entries).toHaveLength(1);
    });

    it('should return audit logs for owner', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('owner'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/admin/audit-logs');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
    });

    it('should pass filter parameters', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs?severity=critical&category=security&limit=25',
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockAuditService.query).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          severities: ['critical'],
          categories: ['security'],
        }),
        expect.objectContaining({
          limit: 25,
        }),
        undefined,
      );
    });

    it('should handle sort parameters', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs?sort=timestamp&order=asc',
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockAuditService.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          field: 'timestamp',
          direction: 'asc',
        }),
      );
    });

    it('should handle date range filters', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const fromDate = '2024-01-01T00:00:00Z';
      const toDate = '2024-12-31T23:59:59Z';
      const request = new NextRequest(
        `http://localhost/api/workspaces/ws-1/admin/audit-logs?from=${fromDate}&to=${toDate}`,
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockAuditService.query).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
          }),
        }),
        expect.anything(),
        undefined,
      );
    });

    it('should handle search parameter', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.query.mockResolvedValue(createMockAuditResponse());

      const { GET } = await import('../route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs?search=login',
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockAuditService.query).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'login',
        }),
        expect.anything(),
        undefined,
      );
    });
  });

  // ===========================================================================
  // Export Tests
  // ===========================================================================

  describe('Audit Logs Export', () => {
    it('should create export for admin', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.requestExport.mockResolvedValue({
        id: 'export-1',
        status: 'pending',
        format: 'csv',
        createdAt: new Date(),
      });

      const { POST } = await import('../export/route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/admin/audit-logs/export', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv' }),
      });
      const response = await POST(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('pending');
    });

    it('should get export status', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.getExport.mockResolvedValue({
        id: 'export-1',
        status: 'completed',
        format: 'csv',
        fileUrl: 'https://example.com/export.csv',
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const { GET } = await import('../export/route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs/export?id=export-1',
      );
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('completed');
      expect(data.fileUrl).toBeDefined();
    });

    it('should return 404 for missing export', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));
      mockAuditService.getExport.mockResolvedValue(null);

      const { GET } = await import('../export/route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs/export?id=non-existent',
      );
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(404);
    });

    it('should require export ID', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(createMockMembership('admin'));

      const { GET } = await import('../export/route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/admin/audit-logs/export',
      );
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(400);
    });
  });
});
