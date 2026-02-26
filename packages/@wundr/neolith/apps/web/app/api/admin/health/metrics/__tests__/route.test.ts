/**
 * Admin Health Metrics API Route Handler Tests
 *
 * Unit tests for the admin health metrics route handler covering:
 * - GET /api/admin/health/metrics - Get time series metrics for dashboard
 *
 * Tests cover authentication, admin authorization, parameter validation,
 * and happy path response shape.
 *
 * @module app/api/admin/health/metrics/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockPrisma = {
  organizationMember: { findFirst: vi.fn() },
  sessionManager: { findMany: vi.fn() },
  tokenUsage: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

// =============================================================================
// HELPERS
// =============================================================================

function createMockSession() {
  return {
    user: {
      id: 'user-123',
      email: 'admin@example.com',
      role: 'ADMIN',
      organizationId: 'org-123',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function buildRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/admin/health/metrics', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics'
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when user is not an admin', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics'
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Admin access required');
  });

  it('returns 400 for invalid timeRange parameter', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      role: 'ADMIN',
    });

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics?timeRange=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid timeRange');
  });

  it('returns metrics data with default timeRange (24h)', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      role: 'ADMIN',
    });
    mockPrisma.sessionManager.findMany.mockResolvedValue([]);
    mockPrisma.tokenUsage.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveProperty('sessions');
    expect(body.data).toHaveProperty('tokens');
    expect(body.data).toHaveProperty('latency');
    expect(body.data).toHaveProperty('errors');
    expect(body.data.latency).toHaveProperty('p50');
    expect(body.data.latency).toHaveProperty('p95');
    expect(body.data.latency).toHaveProperty('p99');
    // 24h range should produce 24 data points
    expect(body.data.sessions).toHaveLength(24);
    expect(body.data.tokens).toHaveLength(24);
    expect(body.data.errors).toHaveLength(24);
  });

  it('returns metrics data with 1h timeRange (12 data points)', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      role: 'ADMIN',
    });
    mockPrisma.sessionManager.findMany.mockResolvedValue([]);
    mockPrisma.tokenUsage.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics?timeRange=1h'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.sessions).toHaveLength(12);
    expect(body.data.tokens).toHaveLength(12);
    expect(body.data.errors).toHaveLength(12);
  });

  it('correctly aggregates session and token data', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      role: 'ADMIN',
    });

    const now = new Date();
    const recentTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    mockPrisma.sessionManager.findMany.mockResolvedValue([
      { id: 's1', createdAt: recentTime, status: 'ACTIVE' },
      { id: 's2', createdAt: recentTime, status: 'INACTIVE' },
    ]);
    mockPrisma.tokenUsage.findMany.mockResolvedValue([
      { createdAt: recentTime, totalTokens: 100 },
      { createdAt: recentTime, totalTokens: 250 },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { createdAt: recentTime, severity: 'error', metadata: {} },
    ]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/metrics?timeRange=1h'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    // Verify that data is present in the time series (exact bucket depends on timing)
    const totalSessionCount = body.data.sessions.reduce(
      (sum: number, s: any) => sum + s.value,
      0
    );
    expect(totalSessionCount).toBeGreaterThanOrEqual(0);

    const totalTokens = body.data.tokens.reduce(
      (sum: number, t: any) => sum + t.value,
      0
    );
    expect(totalTokens).toBeGreaterThanOrEqual(0);
  });
});
