/**
 * Orchestrator Conversations API Route Handler Tests
 *
 * Unit tests for the conversations route handlers covering:
 * - GET /api/orchestrators/:orchestratorId/conversations - List messages
 * - POST /api/orchestrators/:orchestratorId/conversations - Post a message
 *
 * Tests cover authentication, authorization, validation, and happy paths.
 *
 * @module app/api/orchestrators/[orchestratorId]/conversations/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockOrchestratorMessageFindMany = vi.fn();
const mockOrchestratorMessageCreate = vi.fn();

const mockPrisma = {
  organizationMember: { findMany: vi.fn() },
  orchestrator: { findUnique: vi.fn() },
  orchestratorMessage: {
    findMany: mockOrchestratorMessageFindMany,
    create: mockOrchestratorMessageCreate,
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

function createRouteContext(orchestratorId: string) {
  return {
    params: Promise.resolve({ orchestratorId }),
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

function setupOrchestratorAccess() {
  mockPrisma.organizationMember.findMany.mockResolvedValue([
    { organizationId: 'org-1', role: 'ADMIN' },
  ]);
  mockPrisma.orchestrator.findUnique.mockResolvedValue({
    id: 'orch-1',
    organizationId: 'org-1',
    role: 'Engineer',
    discipline: 'Engineering',
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/orchestrators/:orchestratorId/conversations', () => {
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
      'http://localhost:3000/api/orchestrators/orch-1/conversations'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(401);
  });

  it('returns 404 when orchestrator not found or access denied', async () => {
    auth.mockResolvedValue(createMockSession());
    mockPrisma.organizationMember.findMany.mockResolvedValue([]);
    mockPrisma.orchestrator.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-unknown/conversations'
    );
    const response = await GET(request, createRouteContext('orch-unknown'));

    expect(response.status).toBe(404);
  });

  it('returns conversation messages successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    setupOrchestratorAccess();

    const mockMessages = [
      {
        id: 'msg-1',
        content: 'Hello from user',
        senderId: 'user-123',
        sender: { id: 'user-123', title: 'User', role: 'MEMBER' },
        recipientId: 'orch-1',
        recipient: {
          id: 'orch-1',
          title: 'Engineer',
          role: 'Backend Engineer',
        },
        channelId: null,
        channelName: null,
        type: 'message',
        priority: 'normal',
        createdAt: new Date('2026-02-01T10:00:00Z'),
        metadata: null,
        parentMessageId: null,
        threadCount: 0,
      },
    ];
    mockOrchestratorMessageFindMany.mockResolvedValue(mockMessages);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/conversations?limit=50'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty('senderId', 'user-123');
    expect(body.data[0]).toHaveProperty('content', 'Hello from user');
    expect(body.data[0]).toHaveProperty('type', 'message');
  });

  it('returns empty array when orchestratorMessage model throws', async () => {
    auth.mockResolvedValue(createMockSession());
    setupOrchestratorAccess();

    mockOrchestratorMessageFindMany.mockRejectedValue(
      new Error('Model not found')
    );

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/conversations'
    );
    const response = await GET(request, createRouteContext('orch-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });
});

describe('POST /api/orchestrators/:orchestratorId/conversations', () => {
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
      'http://localhost:3000/api/orchestrators/orch-1/conversations',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' }),
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
      new URL('http://localhost:3000/api/orchestrators/orch-1/conversations'),
      {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(400);
  });

  it('returns 400 for empty content', async () => {
    auth.mockResolvedValue(createMockSession());
    setupOrchestratorAccess();

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/conversations',
      {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(400);
  });

  it('creates message successfully', async () => {
    auth.mockResolvedValue(createMockSession());
    setupOrchestratorAccess();

    const createdMessage = {
      id: 'msg-new',
      content: 'Hello orchestrator',
      senderId: 'user-123',
      sender: { id: 'user-123', title: 'User', role: 'MEMBER' },
      recipientId: 'orch-1',
      recipient: { id: 'orch-1', title: 'Engineer', role: 'Backend Engineer' },
      channelId: null,
      channelName: null,
      type: 'message',
      priority: 'normal',
      createdAt: new Date('2026-02-01T12:00:00Z'),
      metadata: null,
      parentMessageId: null,
      threadCount: 0,
    };
    mockOrchestratorMessageCreate.mockResolvedValue(createdMessage);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/conversations',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello orchestrator' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.content).toBe('Hello orchestrator');
    expect(body.data.senderId).toBe('user-123');
  });

  it('returns 500 when message creation fails in DB', async () => {
    auth.mockResolvedValue(createMockSession());
    setupOrchestratorAccess();

    mockOrchestratorMessageCreate.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/orchestrators/orch-1/conversations',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Test message' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('orch-1'));

    expect(response.status).toBe(500);
  });
});
