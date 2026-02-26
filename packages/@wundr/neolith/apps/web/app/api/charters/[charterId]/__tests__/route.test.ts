/**
 * Charter [charterId] API Route Handler Tests
 *
 * Unit tests for single charter route handlers covering:
 * - GET /api/charters/:charterId - Get a single charter
 * - PATCH /api/charters/:charterId - Update charter
 * - DELETE /api/charters/:charterId - Delete charter
 *
 * Tests cover authentication, authorization, validation, and happy paths.
 *
 * @module app/api/charters/[charterId]/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockCharterFindUnique = vi.fn();
const mockCharterUpdate = vi.fn();
const mockCharterDelete = vi.fn();

const mockPrisma = {
  organizationMember: { findUnique: vi.fn() },
  charter: {
    findUnique: mockCharterFindUnique,
    update: mockCharterUpdate,
    delete: mockCharterDelete,
  },
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
    InputJsonValue: {},
  },
}));

// =============================================================================
// HELPERS
// =============================================================================

function createMockSession(role = 'MEMBER') {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role,
      organizationId: 'org-123',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function createRouteContext(charterId: string) {
  return {
    params: Promise.resolve({ charterId }),
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/charters/:charterId', () => {
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
      'http://localhost:3000/api/charters/charter-1'
    );
    const response = await GET(request, createRouteContext('charter-1'));

    expect(response.status).toBe(401);
  });

  it('returns 404 when charter not found', async () => {
    auth.mockResolvedValue(createMockSession());
    mockCharterFindUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-unknown'
    );
    const response = await GET(request, createRouteContext('charter-unknown'));

    expect(response.status).toBe(404);
  });

  it('returns 404 when user lacks org membership for charter', async () => {
    auth.mockResolvedValue(createMockSession());

    mockCharterFindUnique.mockResolvedValue({
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test Charter',
      version: 1,
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1'
    );
    const response = await GET(request, createRouteContext('charter-1'));

    expect(response.status).toBe(404);
  });

  it('returns charter when user has org membership', async () => {
    auth.mockResolvedValue(createMockSession());

    const mockCharter = {
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test Charter',
      version: 1,
      mission: 'Build great software',
    };

    // First call is for access check, second for full fetch
    mockCharterFindUnique
      .mockResolvedValueOnce({
        id: 'charter-1',
        organizationId: 'org-1',
        name: 'Test Charter',
        version: 1,
      })
      .mockResolvedValueOnce(mockCharter);

    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'ADMIN',
    });

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1'
    );
    const response = await GET(request, createRouteContext('charter-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe('charter-1');
    expect(body.data.name).toBe('Test Charter');
  });
});

describe('PATCH /api/charters/:charterId', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { PATCH } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'PATCH',
        body: JSON.stringify({ mission: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await PATCH(request, createRouteContext('charter-1'));

    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not ADMIN or OWNER', async () => {
    auth.mockResolvedValue(createMockSession());

    mockCharterFindUnique.mockResolvedValue({
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test',
      version: 1,
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'MEMBER',
    });

    const { PATCH } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'PATCH',
        body: JSON.stringify({ mission: 'Updated mission' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await PATCH(request, createRouteContext('charter-1'));

    expect(response.status).toBe(403);
  });

  it('updates charter successfully for ADMIN', async () => {
    auth.mockResolvedValue(createMockSession('ADMIN'));

    mockCharterFindUnique.mockResolvedValue({
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test',
      version: 1,
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'ADMIN',
    });

    const updatedCharter = {
      id: 'charter-1',
      name: 'Test',
      version: 2,
      mission: 'Updated mission',
    };
    mockCharterUpdate.mockResolvedValue(updatedCharter);

    const { PATCH } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'PATCH',
        body: JSON.stringify({ mission: 'Updated mission' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await PATCH(request, createRouteContext('charter-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.mission).toBe('Updated mission');
    expect(body.data.version).toBe(2);
  });
});

describe('DELETE /api/charters/:charterId', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { DELETE } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'DELETE',
      }
    );
    const response = await DELETE(request, createRouteContext('charter-1'));

    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not OWNER', async () => {
    auth.mockResolvedValue(createMockSession());

    mockCharterFindUnique.mockResolvedValue({
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test',
      version: 1,
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'ADMIN',
    });

    const { DELETE } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'DELETE',
      }
    );
    const response = await DELETE(request, createRouteContext('charter-1'));

    expect(response.status).toBe(403);
  });

  it('deletes charter successfully for OWNER', async () => {
    auth.mockResolvedValue(createMockSession('OWNER'));

    mockCharterFindUnique.mockResolvedValue({
      id: 'charter-1',
      organizationId: 'org-1',
      name: 'Test',
      version: 1,
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'OWNER',
    });
    mockCharterDelete.mockResolvedValue(undefined);

    const { DELETE } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/charters/charter-1',
      {
        method: 'DELETE',
      }
    );
    const response = await DELETE(request, createRouteContext('charter-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('deleted');
  });
});
