/**
 * Delegations API Route Handler Tests
 *
 * Unit tests for the delegations route handler covering:
 * - GET /api/workspaces/:workspaceSlug/delegations - List task delegations
 *
 * Tests cover authentication, workspace access, filtering, and happy path.
 *
 * @module app/api/workspaces/[workspaceSlug]/delegations/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockTaskDelegationFindMany = vi.fn();

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  organizationMember: { findUnique: vi.fn() },
  taskDelegation: {
    findMany: mockTaskDelegationFindMany,
  },
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

function createRouteContext(workspaceSlug: string) {
  return {
    params: Promise.resolve({ workspaceSlug }),
  };
}

function buildRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/workspaces/:workspaceSlug/delegations', () => {
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
      'http://localhost:3000/api/workspaces/my-workspace/delegations'
    );
    const response = await GET(request, createRouteContext('my-workspace'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when workspace not found', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/workspaces/nonexistent/delegations'
    );
    const response = await GET(request, createRouteContext('nonexistent'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Workspace not found');
  });

  it('returns 403 when user is not an org member', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: 'ws-1',
      organizationId: 'org-1',
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/workspaces/my-workspace/delegations'
    );
    const response = await GET(request, createRouteContext('my-workspace'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Access denied to workspace');
  });

  it('returns delegation records for authorized user', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: 'ws-1',
      organizationId: 'org-1',
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'MEMBER',
    });

    const mockDelegations = [
      {
        id: 'del-1',
        taskId: 'task-1',
        taskTitle: 'Review PR',
        fromOrchestratorId: 'orch-1',
        fromOrchestrator: {
          id: 'orch-1',
          title: 'Lead Engineer',
          discipline: 'Engineering',
        },
        toOrchestratorId: 'orch-2',
        toOrchestrator: {
          id: 'orch-2',
          title: 'Backend Dev',
          discipline: 'Engineering',
        },
        createdAt: new Date('2026-01-15T10:00:00Z'),
        completedAt: null,
        status: 'pending',
        priority: 'high',
        note: null,
      },
    ];

    mockTaskDelegationFindMany.mockResolvedValue(mockDelegations);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/workspaces/my-workspace/delegations'
    );
    const response = await GET(request, createRouteContext('my-workspace'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty('taskId', 'task-1');
    expect(body.data[0]).toHaveProperty(
      'fromOrchestratorTitle',
      'Lead Engineer'
    );
    expect(body.data[0]).toHaveProperty('toOrchestratorTitle', 'Backend Dev');
  });

  it('returns empty array when taskDelegation model is unavailable', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: 'ws-1',
      organizationId: 'org-1',
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      role: 'MEMBER',
    });

    // Simulate model not existing (throws)
    mockTaskDelegationFindMany.mockRejectedValue(
      new Error('Model taskDelegation does not exist')
    );

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/workspaces/my-workspace/delegations'
    );
    const response = await GET(request, createRouteContext('my-workspace'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });
});
