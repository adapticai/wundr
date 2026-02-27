/**
 * Messages API Route Handler Tests
 *
 * Unit tests for the POST /api/messages route handler covering:
 * - POST /api/messages - Send a new message with optional file attachments
 *
 * The route accepts FormData so that file attachments can be included alongside
 * text content. Tests cover authentication, channel membership, content
 * validation, attachment-only messages, and the BigInt size transformation.
 *
 * @module app/api/messages/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Disable Redis so the broadcast branch is a no-op in tests
vi.mock('ioredis', () => ({ default: null }));

const mockChannelMemberFindUnique = vi.fn();
const mockMessageFindUnique = vi.fn();
const mockMessageCreate = vi.fn();
const mockNotificationCreateMany = vi.fn();
const mockFileCreate = vi.fn();

const mockPrisma = {
  channelMember: {
    findUnique: mockChannelMemberFindUnique,
  },
  message: {
    findUnique: mockMessageFindUnique,
    create: mockMessageCreate,
  },
  notification: {
    createMany: mockNotificationCreateMany,
  },
  file: {
    create: mockFileCreate,
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

/**
 * Build a NextRequest carrying a FormData body.
 * Vitest runs in Node so the global FormData / Blob are available via the
 * undici polyfill bundled with Next.js – or the native Node 18+ implementation.
 */
function buildFormDataRequest(
  data: Record<string, string>
): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return new NextRequest(new URL('http://localhost:3000/api/messages'), {
    method: 'POST',
    body: formData,
  });
}

/**
 * Standard channel membership returned when the user is a valid member.
 * Includes the nested channel.workspaceId and channel.workspace fields that
 * the route uses when uploading files and building notification URLs.
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
 * Full message object returned by prisma.message.create.
 * The file size is a BigInt to mirror the real Prisma output; the route is
 * expected to call Number() on it before serialising.
 */
function createMockMessage(overrides?: Record<string, unknown>) {
  return {
    id: 'msg-1',
    content: 'Hello world',
    type: 'TEXT',
    channelId: 'channel-1',
    authorId: 'user-123',
    parentId: null,
    isDeleted: false,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    metadata: { mentions: [] },
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
          filename: 'test.png',
          originalName: 'test.png',
          mimeType: 'image/png',
          size: BigInt(2048),
          s3Key: 'uploads/ws-1/test.png',
          s3Bucket: 'neolith-files',
          thumbnailUrl: '/api/files/uploads/ws-1/test.png/thumbnail',
        },
      },
    ],
    _count: { replies: 0 },
    ...overrides,
  };
}

// =============================================================================
// TESTS – POST /api/messages
// =============================================================================

describe('POST /api/messages', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  // ===== Authentication =====

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildFormDataRequest({
      content: 'Hello',
      channelId: 'channel-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Content / attachment validation =====

  it('returns 400 when no content and no attachments are provided', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    // Send channelId but omit content AND attachmentIds
    const request = buildFormDataRequest({ channelId: 'channel-1' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when channelId is missing', async () => {
    auth.mockResolvedValue(createMockSession());

    const { POST } = await import('../route');
    // Provide content but no channelId
    const request = buildFormDataRequest({ content: 'Hello world' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when content exceeds 4000 characters', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    const { POST } = await import('../route');
    const request = buildFormDataRequest({
      content: 'a'.repeat(4001),
      channelId: 'channel-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Channel membership =====

  it('returns 403 when user is not a channel member', async () => {
    auth.mockResolvedValue(createMockSession());
    // Return null to simulate "not a member"
    mockChannelMemberFindUnique.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildFormDataRequest({
      content: 'Hello world',
      channelId: 'channel-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ===== Success – message with text content =====

  it('returns 201 with transformed message when content is provided', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());
    mockMessageCreate.mockResolvedValue(createMockMessage());
    mockNotificationCreateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('../route');
    const request = buildFormDataRequest({
      content: 'Hello world',
      channelId: 'channel-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();

    // Basic message fields
    expect(body.id).toBe('msg-1');
    expect(body.content).toBe('Hello world');

    // BigInt sizes must have been converted to regular numbers
    expect(body.messageAttachments).toHaveLength(1);
    expect(typeof body.messageAttachments[0].file.size).toBe('number');
    expect(body.messageAttachments[0].file.size).toBe(2048);
  });

  // ===== Success – message with attachmentIds but no text content =====

  it('returns 201 when attachmentIds are provided without text content', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    const messageWithAttachment = createMockMessage({ content: '' });
    mockMessageCreate.mockResolvedValue(messageWithAttachment);
    mockNotificationCreateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('../route');
    // content is intentionally empty; attachmentIds carries the payload
    const request = buildFormDataRequest({
      channelId: 'channel-1',
      attachmentIds: JSON.stringify(['file-1']),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.messageAttachments).toHaveLength(1);
    // Verify BigInt size serialisation
    expect(typeof body.messageAttachments[0].file.size).toBe('number');
  });

  // ===== Validation – malformed mentions =====

  it('returns 400 when mentions field contains invalid JSON', async () => {
    auth.mockResolvedValue(createMockSession());
    mockChannelMemberFindUnique.mockResolvedValue(createMockMembership());

    const { POST } = await import('../route');
    const request = buildFormDataRequest({
      content: 'Hello',
      channelId: 'channel-1',
      mentions: 'not-valid-json',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
