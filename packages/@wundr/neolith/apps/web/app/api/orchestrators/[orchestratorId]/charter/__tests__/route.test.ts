/**
 * Orchestrator Charter API Route Handler Tests
 *
 * Unit tests for the charter route handlers covering:
 * - GET /api/orchestrators/:orchestratorId/charter - Get active charter
 * - POST /api/orchestrators/:orchestratorId/charter - Create/update charter
 *
 * Tests cover authentication, authorization, validation, and happy paths.
 *
 * @module app/api/orchestrators/[orchestratorId]/charter/__tests__/route.test
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
  organizationMember: { findMany: vi.fn() },
  orchestrator: { findUnique: vi.fn() },
  charterVersion: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, opts: { code: string }) {
        super(message);
        this.code = opts.code;
      }
    },
  },
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

function createRouteContext(orchestratorId: string) {
  return {
    params: Promise.resolve({ orchestratorId }),
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/orchestrators/:orchestratorId/charter', () => {
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
      'http://localhost:3000/api/orchestrators/orch-1/charter'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when orchestrator not found or no access', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-unknown/charter'
    );
    const response = await GET(request, createRouteContext('orch-unknown'));

    expect(response.status).toBe(404);
  });

  it('returns 404 when no active charter exists', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-1',
      organizationId: 'org-1',
      role: 'Engineer',
      discipline: 'Engineering',
    });
    mockPrisma.charterVersion.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/charter'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(404);
  });

  it('returns active charter successfully', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-1',
      organizationId: 'org-1',
      role: 'Engineer',
      discipline: 'Engineering',
    });

    const mockCharter = {
      id: 'cv-1',
      charterId: 'charter-1',
      orchestratorId: 'orch-1',
      version: 1,
      isActive: true,
      charterData: { identity: { name: 'Backend Engineer' } },
      creator: { id: 'user-123', name: 'Test', email: 'test@example.com' },
      orchestrator: { id: 'orch-1', organizationId: 'org-1', role: 'Engineer' },
    };
    mockPrisma.charterVersion.findFirst.mockResolvedValue(mockCharter);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/charter'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.isActive).toBe(true);
    expect(body.data.charterId).toBe('charter-1');
  });
});

describe('POST /api/orchestrators/:orchestratorId/charter', () => {
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
      'http://localhost:3000/api/orchestrators/orch-1/charter',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/orchestrators/orch-1/charter'),
      {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks admin/owner role', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'MEMBER' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-1',
      organizationId: 'org-1',
      role: 'Engineer',
      discipline: 'Engineering',
    });

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/charter',
      {
        method: 'POST',
        body: JSON.stringify({
          charterId: 'charter-1',
          name: 'Backend Engineer Charter',
          description: 'Charter for backend engineering',
          objectives: ['Build scalable APIs'],
          charterData: { identity: { name: 'Backend Engineer' } },
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(403);
  });

  it('creates charter version successfully for admin user', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { organizationId: 'org-1', role: 'ADMIN' },
    ]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-1',
      organizationId: 'org-1',
      role: 'Engineer',
      discipline: 'Engineering',
    });

    const createdVersion = {
      id: 'cv-new',
      charterId: 'charter-1',
      orchestratorId: 'orch-1',
      version: 1,
      isActive: true,
      charterData: { identity: { name: 'Backend Engineer' } },
      creator: { id: 'user-123', name: 'Test', email: 'test@example.com' },
      orchestrator: { id: 'orch-1', organizationId: 'org-1' },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma)
    );
    mockPrisma.charterVersion.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.charterVersion.findFirst.mockResolvedValue(null);
    mockPrisma.charterVersion.create.mockResolvedValue(createdVersion);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/charter',
      {
        method: 'POST',
        body: JSON.stringify({
          charterId: 'charter-1',
          name: 'Backend Engineer Charter',
          description: 'Charter for backend engineering',
          objectives: ['Build scalable APIs'],
          charterData: { identity: { name: 'Backend Engineer' } },
          changeLog: 'Initial creation',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.charterId).toBe('charter-1');
    expect(body.message).toContain('successfully');
  });
});
