/**
 * Communications API Route Handler Tests
 *
 * Unit tests for the communications route handlers covering:
 * - GET /api/communications - List communication logs with filters
 * - POST /api/communications - Create a new communication log
 *
 * Tests cover authentication, validation, and happy paths.
 *
 * @module app/api/communications/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockCommunicationLog = {
  count: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
};

const mockPrisma = {
  communicationLog: mockCommunicationLog,
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

function buildRequest(url: string, init?: RequestInit): NextRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/communications', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/communications');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns paginated communication logs', async () => {
    auth.mockResolvedValue(createMockSession());

    const mockLogs = [
      {
        id: 'log-1',
        orchestratorId: 'orch-1',
        channel: 'slack',
        direction: 'outbound',
        content: 'Hello team',
        status: 'delivered',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'log-2',
        orchestratorId: 'orch-1',
        channel: 'email',
        direction: 'inbound',
        content: 'Meeting update',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ];

    mockCommunicationLog.count.mockResolvedValue(2);
    mockCommunicationLog.findMany.mockResolvedValue(mockLogs);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/communications');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
  });

  it('returns 400 for invalid filter parameters', async () => {
    auth.mockResolvedValue(createMockSession());

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/communications?page=not-a-number'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('supports filtering by orchestratorId', async () => {
    auth.mockResolvedValue(createMockSession());

    mockCommunicationLog.count.mockResolvedValue(1);
    mockCommunicationLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        orchestratorId: 'orch-1',
        channel: 'slack',
        status: 'delivered',
      },
    ]);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/communications?orchestratorId=orch-1'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].orchestratorId).toBe('orch-1');
  });
});

describe('POST /api/communications', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/communications', {
      method: 'POST',
      body: JSON.stringify({ content: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/communications'),
      {
        method: 'POST',
        body: 'bad json {{{',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/communications', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('creates communication log successfully', async () => {
    auth.mockResolvedValue(createMockSession());

    const createdLog = {
      id: 'log-new',
      orchestratorId: 'orch-1',
      channel: 'slack',
      direction: 'outbound',
      recipientAddress: 'team@company.com',
      senderAddress: 'bot@company.com',
      content: 'Deployment notification',
      status: 'pending',
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    mockCommunicationLog.create.mockResolvedValue(createdLog);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/communications', {
      method: 'POST',
      body: JSON.stringify({
        orchestratorId: 'orch-1',
        channel: 'slack',
        direction: 'outbound',
        recipientAddress: 'team@company.com',
        senderAddress: 'bot@company.com',
        content: 'Deployment notification',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.channel).toBe('slack');
    expect(body.message).toContain('created');
  });
});
