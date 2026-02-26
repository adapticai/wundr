/**
 * Task API Route Handler Tests
 *
 * Unit tests for the Task CRUD route handlers covering:
 * - GET /api/tasks - List tasks with filters and pagination
 * - POST /api/tasks - Create a new task
 *
 * Tests cover authentication, validation, authorization, and happy paths.
 *
 * @module app/api/tasks/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/services/task-service', () => ({
  validateTaskDependencies: vi.fn().mockResolvedValue({ valid: true }),
}));

const mockPrisma = {
  workspaceMember: { findMany: vi.fn(), findFirst: vi.fn() },
  workspace: { findFirst: vi.fn() },
  orchestrator: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  task: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
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

function createMockSession(overrides?: Record<string, unknown>) {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-123',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/tasks', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns empty array when user has no workspace memberships', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.totalCount).toBe(0);
  });

  it('returns paginated tasks for authenticated user', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      { workspaceId: 'ws-1' },
    ]);

    const mockTasks = [
      { id: 'task-1', title: 'Task One', status: 'TODO', priority: 'HIGH' },
      {
        id: 'task-2',
        title: 'Task Two',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
      },
    ];

    mockPrisma.task.findMany.mockResolvedValue(mockTasks);
    mockPrisma.task.count.mockResolvedValue(2);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/tasks?page=1&limit=20'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('totalCount');
    expect(body.pagination).toHaveProperty('hasNextPage');
  });

  it('returns 400 for invalid query parameters', async () => {
    auth.mockResolvedValue(createMockSession());

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/tasks?limit=not-a-number'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when accessing workspace user does not belong to', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      { workspaceId: 'ws-1' },
    ]);
    mockPrisma.workspace.findFirst.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/tasks?workspaceId=ws-forbidden'
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

describe('POST /api/tasks', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Task' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/tasks'),
      {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ description: 'No title provided' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('creates task successfully with valid input', async () => {
    auth.mockResolvedValue(createMockSession());

    mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'ws-1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-123',
      role: 'MEMBER',
    });
    mockPrisma.orchestrator.findFirst.mockResolvedValue({
      id: 'orch-1',
      workspaceId: 'ws-1',
    });

    const createdTask = {
      id: 'task-new',
      title: 'New Task',
      description: 'Test description',
      priority: 'HIGH',
      status: 'TODO',
      orchestratorId: 'orch-1',
      workspaceId: 'ws-1',
      createdById: 'user-123',
    };
    mockPrisma.task.create.mockResolvedValue(createdTask);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Task',
        description: 'Test description',
        priority: 'HIGH',
        status: 'TODO',
        orchestratorId: 'orch-1',
        workspaceId: 'ws-1',
        creatorId: 'user-123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.title).toBe('New Task');
    expect(body.message).toBe('Task created successfully');
  });

  it('returns 404 when workspace is not found', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.workspace.findFirst.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Task',
        priority: 'HIGH',
        status: 'TODO',
        orchestratorId: 'orch-1',
        workspaceId: 'ws-nonexistent',
        creatorId: 'user-123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
  });
});
