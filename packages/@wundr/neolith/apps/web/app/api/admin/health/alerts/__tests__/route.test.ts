/**
 * Admin Health Alerts API Route Handler Tests
 *
 * Unit tests for the admin health alerts route handler covering:
 * - GET /api/admin/health/alerts - List active health alerts
 * - POST /api/admin/health/alerts - Acknowledge health alerts
 *
 * Tests cover authentication, admin authorization, filter parameters,
 * and happy-path alert aggregation from budget alerts and audit logs.
 *
 * @module app/api/admin/health/alerts/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockBudgetAlert = {
  findMany: vi.fn(),
  updateMany: vi.fn(),
};

const mockOrganizationMember = {
  findFirst: vi.fn(),
};

const mockAuditLog = {
  count: vi.fn(),
  findMany: vi.fn(),
};

const mockTokenUsage = {
  findMany: vi.fn(),
};

const mockOrchestratorFindMany = vi.fn();

const mockPrisma = {
  organizationMember: mockOrganizationMember,
  budgetAlert: mockBudgetAlert,
  auditLog: mockAuditLog,
  tokenUsage: mockTokenUsage,
  orchestrator: { findMany: mockOrchestratorFindMany },
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

// =============================================================================
// HELPERS
// =============================================================================

function createMockSession(overrides?: Record<string, unknown>) {
  return {
    user: {
      id: 'user-123',
      email: 'admin@example.com',
      role: 'ADMIN',
      organizationId: 'org-123',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

/** Stub all the "extra" prisma calls the route makes after budget alerts */
function stubSecondaryQueries() {
  mockAuditLog.count.mockResolvedValue(0);
  mockAuditLog.findMany.mockResolvedValue([]);
  mockTokenUsage.findMany.mockResolvedValue([]);
  mockOrchestratorFindMany.mockResolvedValue([]);
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/admin/health/alerts', () => {
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
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when user is not an admin', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Admin access required');
  });

  it('returns 200 with an empty alerts array when there are no alerts', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockBudgetAlert.findMany.mockResolvedValue([]);
    stubSecondaryQueries();

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
  });

  it('returns 200 and transforms budget alerts into health alerts', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });

    const mockBudgetAlerts = [
      {
        id: 'alert-1',
        level: 'critical',
        message: 'Budget critical',
        orchestratorId: 'orch-1',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        acknowledged: false,
        orchestrator: {
          id: 'orch-1',
          user: { name: 'Bot 1', displayName: 'Bot One' },
        },
      },
      {
        id: 'alert-2',
        level: 'warning',
        message: 'Budget warning',
        orchestratorId: 'orch-2',
        createdAt: new Date('2024-01-01T11:00:00Z'),
        acknowledged: true,
        orchestrator: {
          id: 'orch-2',
          user: { name: 'Bot 2', displayName: null },
        },
      },
    ];

    mockBudgetAlert.findMany.mockResolvedValue(mockBudgetAlerts);
    stubSecondaryQueries();

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const criticalAlert = body.data.find((a: any) => a.id === 'alert-1');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert.type).toBe('budget_exhaustion');
    expect(criticalAlert.severity).toBe('critical');
    expect(criticalAlert.acknowledged).toBe(false);

    const warningAlert = body.data.find((a: any) => a.id === 'alert-2');
    expect(warningAlert).toBeDefined();
    expect(warningAlert.severity).toBe('warning');
    expect(warningAlert.acknowledged).toBe(true);
  });

  it('generates a high_error_rate alert when audit log error count exceeds threshold', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockBudgetAlert.findMany.mockResolvedValue([]);

    // Simulate high error count (>10 threshold)
    mockAuditLog.count.mockResolvedValue(15);
    mockAuditLog.findMany.mockResolvedValue([]);
    mockTokenUsage.findMany.mockResolvedValue([]);
    mockOrchestratorFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const errorRateAlert = body.data.find(
      (a: any) => a.type === 'high_error_rate'
    );
    expect(errorRateAlert).toBeDefined();
    expect(errorRateAlert.severity).toBe('warning');
    expect(errorRateAlert.acknowledged).toBe(false);
  });

  it('generates a critical high_error_rate alert when error count is very high', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockBudgetAlert.findMany.mockResolvedValue([]);

    // Simulate very high error count (>50 = critical)
    mockAuditLog.count.mockResolvedValue(60);
    mockAuditLog.findMany.mockResolvedValue([]);
    mockTokenUsage.findMany.mockResolvedValue([]);
    mockOrchestratorFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const errorRateAlert = body.data.find(
      (a: any) => a.type === 'high_error_rate'
    );
    expect(errorRateAlert).toBeDefined();
    expect(errorRateAlert.severity).toBe('critical');
  });

  it('filters alerts by severity query parameter', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });

    mockBudgetAlert.findMany.mockResolvedValue([
      {
        id: 'alert-crit',
        level: 'critical',
        message: 'Critical budget',
        orchestratorId: 'orch-1',
        createdAt: new Date(),
        acknowledged: false,
        orchestrator: {
          id: 'orch-1',
          user: { name: 'Bot', displayName: null },
        },
      },
      {
        id: 'alert-warn',
        level: 'warning',
        message: 'Warning budget',
        orchestratorId: 'orch-2',
        createdAt: new Date(),
        acknowledged: false,
        orchestrator: {
          id: 'orch-2',
          user: { name: 'Bot2', displayName: null },
        },
      },
    ]);
    stubSecondaryQueries();

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts?severity=critical'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    // All returned alerts must have severity 'critical'
    expect(body.data.every((a: any) => a.severity === 'critical')).toBe(true);
  });

  it('filters alerts by type query parameter', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });

    mockBudgetAlert.findMany.mockResolvedValue([
      {
        id: 'alert-budget',
        level: 'warning',
        message: 'Budget warning',
        orchestratorId: 'orch-1',
        createdAt: new Date(),
        acknowledged: false,
        orchestrator: {
          id: 'orch-1',
          user: { name: 'Bot', displayName: null },
        },
      },
    ]);

    // Simulate a high error rate alert being generated too
    mockAuditLog.count.mockResolvedValue(20);
    mockAuditLog.findMany.mockResolvedValue([]);
    mockTokenUsage.findMany.mockResolvedValue([]);
    mockOrchestratorFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts?type=high_error_rate'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    // Only high_error_rate alerts should be present after type filter
    expect(body.data.every((a: any) => a.type === 'high_error_rate')).toBe(
      true
    );
  });

  it('generates a latency_spike alert when avg response time exceeds 5000ms', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockBudgetAlert.findMany.mockResolvedValue([]);
    mockAuditLog.count.mockResolvedValue(0);
    mockTokenUsage.findMany.mockResolvedValue([]);
    mockOrchestratorFindMany.mockResolvedValue([]);

    // Return audit log records with high responseTime metadata
    mockAuditLog.findMany.mockResolvedValue([
      { metadata: { responseTime: 6000 } },
      { metadata: { responseTime: 7000 } },
      { metadata: { responseTime: 8000 } },
    ]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const latencyAlert = body.data.find((a: any) => a.type === 'latency_spike');
    expect(latencyAlert).toBeDefined();
    expect(['warning', 'critical']).toContain(latencyAlert.severity);
  });
});

describe('POST /api/admin/health/alerts', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts',
      {
        method: 'POST',
        body: JSON.stringify({ alertIds: ['alert-1'] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when user is not an admin', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts',
      {
        method: 'POST',
        body: JSON.stringify({ alertIds: ['alert-1'] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/admin/health/alerts'),
      {
        method: 'POST',
        body: 'bad json {{{',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when alertIds is missing or empty', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts',
      {
        method: 'POST',
        body: JSON.stringify({ alertIds: [] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('acknowledges budget alerts and returns count', async () => {
    auth.mockResolvedValue(createMockSession());
    mockOrganizationMember.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockBudgetAlert.updateMany.mockResolvedValue({ count: 2 });

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/admin/health/alerts',
      {
        method: 'POST',
        body: JSON.stringify({ alertIds: ['alert-abc-1', 'alert-abc-2'] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.acknowledgedCount).toBe(2);
    expect(body.message).toContain('acknowledged');
  });
});
