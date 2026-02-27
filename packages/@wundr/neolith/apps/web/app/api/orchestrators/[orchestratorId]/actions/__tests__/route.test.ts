/**
 * OrchestratorActions API Route Handler Tests
 *
 * Unit tests for the actions route handler covering:
 * - POST /api/orchestrators/:orchestratorId/actions - Execute action (activate/deactivate/etc.)
 *
 * Tests cover authentication, authorization, validation, audit logging, and happy paths.
 *
 * @module app/api/orchestrators/[orchestratorId]/actions/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockAuditLogCreate = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  organizationMember: {
    findMany: vi.fn(),
  },
  orchestrator: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  $transaction: mockTransaction,
  auditLog: {
    create: mockAuditLogCreate,
  },
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/validations/orchestrator', async () => {
  const actual = await vi.importActual('@/lib/validations/orchestrator');
  return actual;
});

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

function createRouteContext(orchestratorId: string) {
  return {
    params: Promise.resolve({ orchestratorId }),
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

function createMockOrchestrator(overrides?: Record<string, unknown>) {
  return {
    id: 'orch-1',
    organizationId: 'org-1',
    role: 'Backend Engineer',
    discipline: 'Engineering',
    status: 'OFFLINE',
    user: {
      id: 'orch-user-1',
      name: 'Bot Engineer',
      email: 'bot@example.com',
      status: 'INACTIVE',
    },
    organization: {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
    },
    ...overrides,
  };
}

function createUpdatedOrchestrator(status: string) {
  return {
    id: 'orch-1',
    organizationId: 'org-1',
    role: 'Backend Engineer',
    discipline: 'Engineering',
    status,
    user: {
      id: 'orch-user-1',
      name: 'Bot Engineer',
      email: 'bot@example.com',
      displayName: 'Bot',
      avatarUrl: null,
      status: status === 'ONLINE' ? 'ACTIVE' : 'INACTIVE',
    },
    organization: {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/orchestrators/:orchestratorId/actions', () => {
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
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user is not an admin or owner', async () => {
    auth.mockResolvedValue(createMockSession());

    // User is a MEMBER, not ADMIN or OWNER
    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'MEMBER' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator()
    );

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user has no membership in the orchestrator organization', async () => {
    auth.mockResolvedValue(createMockSession());

    // User belongs to a different org than the orchestrator
    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-other', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator()
    );

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when orchestrator not found', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-missing/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-missing'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for an invalid action value', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid-action' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for invalid JSON body', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/orchestrators/orch-1/actions'),
      {
        method: 'POST',
        body: 'not-valid-json',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(400);
  });

  it('successfully performs action and creates audit log entry', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator({ status: 'OFFLINE' })
    );

    const updatedOrch = createUpdatedOrchestrator('ONLINE');
    mockTransaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.user.update.mockResolvedValue({ id: 'orch-user-1' });
    mockPrisma.orchestrator.update.mockResolvedValue(updatedOrch);
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.statusChanged).toBe(true);
    expect(body.previousStatus).toBe('OFFLINE');
    expect(body.newStatus).toBe('ONLINE');
    expect(body.data).toBeDefined();

    // Verify audit log was created
    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: 'user',
          actorId: 'user-123',
          action: 'orchestrator.activate',
          resourceType: 'orchestrator',
          resourceId: 'orch-1',
        }),
      })
    );
  });

  it('includes reason in audit log metadata when provided', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'OWNER' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator({ status: 'ONLINE' })
    );

    const updatedOrch = createUpdatedOrchestrator('OFFLINE');
    mockTransaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.user.update.mockResolvedValue({ id: 'orch-user-1' });
    mockPrisma.orchestrator.update.mockResolvedValue(updatedOrch);
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-2' });

    const reason = 'Scheduled maintenance window';

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'deactivate', reason }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reason).toBe(reason);
    expect(body.statusChanged).toBe(true);

    // Verify audit log includes reason in metadata
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'orchestrator.deactivate',
          metadata: expect.objectContaining({
            reason,
          }),
        }),
      })
    );
  });

  it('returns 200 with statusChanged false when already in target status', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    // Orchestrator is already ONLINE — activate maps to ONLINE
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator({ status: 'ONLINE' })
    );

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'activate' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.statusChanged).toBe(false);
    // No transaction or audit log should have been called
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('admin role is allowed to perform actions', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(
      createMockOrchestrator({ status: 'OFFLINE' })
    );

    const updatedOrch = createUpdatedOrchestrator('ONLINE');
    mockTransaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.user.update.mockResolvedValue({ id: 'orch-user-1' });
    mockPrisma.orchestrator.update.mockResolvedValue(updatedOrch);
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-3' });

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/actions',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
  });
});
