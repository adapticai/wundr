/**
 * Typing Indicator API Route Handler Tests
 *
 * Unit tests for the typing indicator route handlers covering:
 * - POST /api/channels/:channelId/typing - Signal typing status
 * - GET  /api/channels/:channelId/typing - Retrieve current typing users
 *
 * Tests cover authentication, authorization, validation, Redis fallback
 * to in-memory store, and happy paths.
 *
 * @module app/api/channels/[channelId]/typing/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockChannelMemberFindUnique = vi.fn();

const mockPrisma = {
  channelMember: {
    findUnique: mockChannelMemberFindUnique,
  },
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

// Force ioredis to return null so the route falls back to the in-memory store
vi.mock('ioredis', () => ({ default: null }));

vi.mock('@/lib/validations/message', async () => {
  const actual = await vi.importActual('@/lib/validations/message');
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

function createRouteContext(channelId: string) {
  return {
    params: Promise.resolve({ channelId }),
  };
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

function createMockChannelMembership(overrides?: Record<string, unknown>) {
  return {
    channelId: 'channel-1',
    userId: 'user-123',
    role: 'MEMBER',
    user: {
      id: 'user-123',
      name: 'Test User',
      displayName: 'Test',
    },
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/channels/:channelId/typing', () => {
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
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for an invalid (empty) channel ID', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    // Pass an empty string as channelId — channelIdParamSchema requires min(1)
    const request = buildRequest('http://localhost:3000/api/channels//typing', {
      method: 'POST',
      body: JSON.stringify({ isTyping: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, createRouteContext(''));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user is not a channel member', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 and sets typing status using in-memory fallback when isTyping is true', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.channelId).toBe('channel-1');
    expect(body.data.isTyping).toBe(true);
    expect(Array.isArray(body.data.typingUsers)).toBe(true);
  });

  it('returns 200 and removes typing status when isTyping is false', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { POST } = await import('../route');

    // First signal typing so there is a record to remove
    const startRequest = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await POST(startRequest, createRouteContext('channel-1'));

    // Now stop typing
    const stopRequest = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: false }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(stopRequest, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.isTyping).toBe(false);
    expect(body.data.channelId).toBe('channel-1');
  });

  it('accepts request with no body and defaults isTyping to true', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { POST } = await import('../route');
    // Body is omitted — the route uses an empty object as default
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.isTyping).toBe(true);
  });

  it('excludes the current user from the typingUsers list', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing',
      {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    // The current user (user-123) must not appear in the returned typing list
    const selfInList = body.data.typingUsers.some(
      (u: { userId: string }) => u.userId === 'user-123'
    );
    expect(selfInList).toBe(false);
  });
});

describe('GET /api/channels/:channelId/typing', () => {
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
      'http://localhost:3000/api/channels/channel-1/typing'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user is not a channel member', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 with current typing users for a channel member', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.channelId).toBe('channel-1');
    expect(Array.isArray(body.data.typingUsers)).toBe(true);
  });

  it('returns 400 for an invalid (empty) channel ID', async () => {
    auth.mockResolvedValue(createMockSession());

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/channels//typing');
    const response = await GET(request, createRouteContext(''));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('does not include current user in returned typing users', async () => {
    auth.mockResolvedValue(createMockSession());

    mockChannelMemberFindUnique.mockResolvedValue(
      createMockChannelMembership()
    );

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/typing'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    const selfInList = body.data.typingUsers.some(
      (u: { userId: string }) => u.userId === 'user-123'
    );
    expect(selfInList).toBe(false);
  });
});
