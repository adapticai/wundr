/**
 * Traffic Manager Metrics API Route Handler Tests
 *
 * Unit tests for the traffic manager metrics route handler covering:
 * - GET /api/traffic-manager/metrics - Get traffic metrics and decisions
 *
 * Tests cover authentication, parameter validation, and happy path.
 *
 * @module app/api/traffic-manager/metrics/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockRoutingDecision = {
  count: vi.fn(),
  groupBy: vi.fn(),
  aggregate: vi.fn(),
  findMany: vi.fn(),
};

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  routingDecision: mockRoutingDecision,
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
      email: 'test@example.com',
      role: 'MEMBER',
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

describe('GET /api/traffic-manager/metrics', () => {
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
      'http://localhost:3000/api/traffic-manager/metrics?workspaceId=ws-1'
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when workspaceId is missing', async () => {
    auth.mockResolvedValue(createMockSession());

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/traffic-manager/metrics'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when workspace is not found', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/traffic-manager/metrics?workspaceId=ws-nonexistent'
    );
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it('returns metrics data for valid workspace', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue({
      organizationId: 'org-1',
    });

    // Set up all the aggregation mocks
    mockRoutingDecision.count.mockResolvedValue(50);
    mockRoutingDecision.groupBy.mockResolvedValue([]);
    mockRoutingDecision.aggregate.mockResolvedValue({
      _avg: { routingLatencyMs: 120 },
    });
    mockRoutingDecision.findMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/traffic-manager/metrics?workspaceId=ws-1'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveProperty('totalMessagesRouted');
    expect(body.data).toHaveProperty('averageRoutingLatencyMs');
    expect(body.data).toHaveProperty('messagesPerMinute');
    expect(body.data).toHaveProperty('escalationRate');
    expect(body.data).toHaveProperty('fallbackRate');
    expect(body.data).toHaveProperty('routingMethodDistribution');
    expect(body.data).toHaveProperty('agentUtilization');
    expect(body.data).toHaveProperty('recentDecisions');
  });

  it('handles graceful fallback when routingDecision model errors', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue({
      organizationId: 'org-1',
    });

    // All model calls throw (simulating model not yet generated)
    mockRoutingDecision.count.mockRejectedValue(new Error('Model not found'));
    mockRoutingDecision.groupBy.mockRejectedValue(new Error('Model not found'));
    mockRoutingDecision.aggregate.mockRejectedValue(
      new Error('Model not found')
    );
    mockRoutingDecision.findMany.mockRejectedValue(
      new Error('Model not found')
    );

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/traffic-manager/metrics?workspaceId=ws-1'
    );
    const response = await GET(request);

    // Should still return 200 due to .catch() fallbacks in the route
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.totalMessagesRouted).toBe(0);
    expect(body.data.recentDecisions).toEqual([]);
  });
});
