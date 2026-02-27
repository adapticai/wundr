/**
 * Channel Messages API Route Handler Tests
 *
 * Unit tests for the channel messages route handlers covering:
 * - GET  /api/channels/:channelId/messages - List messages with cursor pagination
 * - POST /api/channels/:channelId/messages - Send a new message
 *
 * Tests cover authentication, channel membership enforcement, query/body
 * validation, the BigInt file-size transformation, and happy-path responses.
 *
 * @module app/api/channels/[channelId]/messages/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// NotificationService methods are fire-and-forget; stub them so tests are
// deterministic and produce no network activity.
vi.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    notifyMention: vi.fn().mockResolvedValue(undefined),
    notifyThreadReply: vi.fn().mockResolvedValue(undefined),
  },
}));

// Disable real HTTP traffic from the traffic-manager integration
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

const mockChannelMemberFindUnique = vi.fn();
const mockChannelMemberUpdate = vi.fn();
const mockChannelMemberFindMany = vi.fn();
const mockMessageFindUnique = vi.fn();
const mockMessageFindMany = vi.fn();
const mockMessageCreate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();

const mockPrisma = {
  channelMember: {
    findUnique: mockChannelMemberFindUnique,
    update: mockChannelMemberUpdate,
    findMany: mockChannelMemberFindMany,
  },
  message: {
    findUnique: mockMessageFindUnique,
    findMany: mockMessageFindMany,
    create: mockMessageCreate,
  },
  user: {
    findUnique: mockUserFindUnique,
    findMany: mockUserFindMany,
  },
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
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-123',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
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

/**
 * Channel membership object with the nested workspace included, matching the
 * shape returned by checkChannelMembership() in the route.
 */
function createMockMembership(overrides?: Record<string, unknown>) {
  return {
    channelId: 'channel-1',
    userId: 'user-123',
    role: 'MEMBER',
    channel: {
      id: 'channel-1',
      workspaceId: 'ws-1',
      workspace: {
        id: 'ws-1',
        organizationId: 'org-123',
      },
    },
    ...overrides,
  };
}

/**
 * Single message with BigInt file size, matching the Prisma include shape used
 * by both GET and POST handlers.
 */
function createMockMessage(overrides?: Record<string, unknown>) {
  return {
    id: 'msg-1',
    content: 'Hello channel',
    type: 'TEXT',
    channelId: 'channel-1',
    authorId: 'user-123',
    parentId: null,
    isDeleted: false,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    metadata: {},
    author: {
      id: 'user-123',
      name: 'Test User',
      displayName: 'Test',
      avatarUrl: null,
      isOrchestrator: false,
    },
    reactions: [],
    messageAttachments: [
      {
        id: 'attach-1',
        messageId: 'msg-1',
        fileId: 'file-1',
        file: {
          id: 'file-1',
          filename: 'doc.pdf',
          originalName: 'doc.pdf',
          mimeType: 'application/pdf',
          size: BigInt(4096),
          thumbnailUrl: null,
          s3Key: 'uploads/ws-1/doc.pdf',
          s3Bucket: 'neolith-files',
        },
      },
    ],
    _count: { replies: 0 },
    ...overrides,
  };
}

// =============================================================================
// TESTS – GET /api/channels/:channelId/messages
// =============================================================================

describe('GET /api/channels/:channelId/messages', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
    // Default: last-read update succeeds silently
    mockChannelMemberUpdate.mockResolvedValue({});
  });

  // ===== Authentication =====

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Channel membership =====

  it('returns 403 when user is not a channel member', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Happy path =====

  it('returns 200 with paginated messages for a channel member', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    const messages = [createMockMessage()];
    // findMany returns exactly `limit` items, so hasMore is false
    mockMessageFindMany.mockResolvedValue(messages);

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages?limit=50'
    );
    const response = await GET(request, createRouteContext('channel-1'));

    expect(response.status).toBe(200);
    const body = await response.json();

    // Shape assertions
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('msg-1');
    expect(body.data[0].content).toBe('Hello channel');

    // Reactions must be grouped
    expect(Array.isArray(body.data[0].reactions)).toBe(true);

    // BigInt file size must have been converted to a number
    expect(body.data[0].messageAttachments).toHaveLength(1);
    expect(typeof body.data[0].messageAttachments[0].file.size).toBe('number');
    expect(body.data[0].messageAttachments[0].file.size).toBe(4096);

    // Pagination envelope
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.hasMore).toBe('boolean');
  });

  // ===== Validation =====

  it('returns 400 when channelId param is an empty string', async () => {
    auth.mockResolvedValue(createMockSession());

    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels//messages'
    );
    const response = await GET(request, createRouteContext(''));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});

// =============================================================================
// TESTS – POST /api/channels/:channelId/messages
// =============================================================================

describe('POST /api/channels/:channelId/messages', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;

    // Default stubs used across most POST tests
    mockUserFindUnique.mockResolvedValue({ isOrchestrator: false });
    mockUserFindMany.mockResolvedValue([]);
    mockChannelMemberFindMany.mockResolvedValue([]);
  });

  // ===== Authentication =====

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Channel membership =====

  it('returns 403 when user is not a channel member', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Validation =====

  it('returns 400 when request body fails schema validation (empty content)', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when channelId param is an empty string', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels//messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext(''));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for malformed JSON body', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/channels/channel-1/messages'),
      {
        method: 'POST',
        body: 'not valid json',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Happy path =====

  it('returns 201 with the created message on success', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    const createdMessage = createMockMessage({ messageAttachments: [] });
    mockMessageCreate.mockResolvedValue(createdMessage);

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello channel' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('msg-1');
    expect(body.data.content).toBe('Hello channel');
    expect(body.message).toBe('Message sent successfully');
  });

  it('converts BigInt file sizes to numbers in the 201 response', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    // createMockMessage includes a BigInt(4096) size by default
    mockMessageCreate.mockResolvedValue(createMockMessage());

    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/channels/channel-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello with file' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('channel-1'));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.messageAttachments).toHaveLength(1);
    expect(typeof body.data.messageAttachments[0].file.size).toBe('number');
    expect(body.data.messageAttachments[0].file.size).toBe(4096);
  });
});
