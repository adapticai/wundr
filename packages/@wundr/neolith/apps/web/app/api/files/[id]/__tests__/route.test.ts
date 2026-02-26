/**
 * File Detail API Route Handler Tests
 *
 * Unit tests for the file detail route handlers covering:
 * - GET /api/files/:id - Get file metadata and details
 * - DELETE /api/files/:id - Delete file from storage and database
 *
 * Tests cover authentication, file not found, workspace membership checks,
 * S3 deletion, transaction-based cleanup, and happy paths.
 *
 * @module app/api/files/[id]/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockFile = {
  findUnique: vi.fn(),
};

const mockWorkspaceMember = {
  findUnique: vi.fn(),
};

const mockSavedItem = {
  deleteMany: vi.fn(),
};

const mockMessage = {
  updateMany: vi.fn(),
};

const mockFileDelete = vi.fn();

// Capture the transaction callback so we can execute it
let capturedTxCallback: ((tx: any) => Promise<void>) | null = null;
const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<void>) => {
  capturedTxCallback = cb;
  const tx = {
    savedItem: mockSavedItem,
    message: mockMessage,
    file: { delete: mockFileDelete },
  };
  return cb(tx);
});

const mockPrisma = {
  file: mockFile,
  workspaceMember: mockWorkspaceMember,
  $transaction: mockTransaction,
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

// Mock @aws-sdk/client-s3 — the route uses dynamic import so we mock the module
const mockS3Send = vi.fn().mockResolvedValue({});
const mockS3Client = vi.fn(() => ({ send: mockS3Send }));
const mockDeleteObjectCommand = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  DeleteObjectCommand: mockDeleteObjectCommand,
}));

// Mock upload validation helpers used by the route
vi.mock('@/lib/validations/upload', () => ({
  fileIdParamSchema: {
    safeParse: (params: any) => {
      if (params && typeof params.id === 'string' && params.id.length > 0) {
        return { success: true, data: params };
      }
      return {
        success: false,
        error: { flatten: () => ({ fieldErrors: {} }) },
      };
    },
  },
  createErrorResponse: (message: string, code: string) => ({
    error: code,
    message,
  }),
  UPLOAD_ERROR_CODES: {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  },
  generateFileUrl: (s3Key: string) => `/api/files/${s3Key}`,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

function createRouteContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function buildMockFile(overrides?: Record<string, unknown>) {
  return {
    id: 'file-123',
    filename: 'document.pdf',
    mimeType: 'application/pdf',
    size: BigInt(1024),
    s3Key: 'uploads/file-123.pdf',
    s3Bucket: 'my-bucket',
    workspaceId: 'ws-123',
    uploadedById: 'user-123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    uploadedBy: {
      id: 'user-123',
      name: 'Test User',
      displayName: 'Tester',
      avatarUrl: null,
    },
    workspace: {
      id: 'ws-123',
      name: 'My Workspace',
      organizationId: 'org-123',
    },
    messageAttachments: [],
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /api/files/:id', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedTxCallback = null;
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123');
    const response = await GET(request, createRouteContext('file-123'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when file does not exist', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-999');
    const response = await GET(request, createRouteContext('file-999'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user is not a member of the file workspace', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(buildMockFile());
    mockWorkspaceMember.findUnique.mockResolvedValue(null);

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123');
    const response = await GET(request, createRouteContext('file-123'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 with file metadata for an authorized member', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(buildMockFile());
    mockWorkspaceMember.findUnique.mockResolvedValue({
      workspaceId: 'ws-123',
      userId: 'user-123',
      role: 'MEMBER',
    });

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123');
    const response = await GET(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('file-123');
    expect(body.data.filename).toBe('document.pdf');
    expect(body.data.url).toBeDefined();
  });

  it('includes a computed URL in the response', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(buildMockFile());
    mockWorkspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123');
    const response = await GET(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.data.url).toBe('string');
    expect(body.data.url.length).toBeGreaterThan(0);
  });

  it('converts BigInt size to a plain number', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({ size: BigInt(2048) })
    );
    mockWorkspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123');
    const response = await GET(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    // JSON-serialised BigInt would throw; verifying it came through as a number
    expect(typeof body.data.size).toBe('number');
    expect(body.data.size).toBe(2048);
  });
});

describe('DELETE /api/files/:id', () => {
  let auth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedTxCallback = null;
    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;
    // Default: S3 delete succeeds silently
    mockS3Send.mockResolvedValue({});
    mockSavedItem.deleteMany.mockResolvedValue({ count: 0 });
    mockMessage.updateMany.mockResolvedValue({ count: 0 });
    mockFileDelete.mockResolvedValue({});
  });

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null);

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-123'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when file does not exist', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(null);

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-999', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-999'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 403 when non-uploader without admin role tries to delete', async () => {
    auth.mockResolvedValue(createMockSession({ user: { id: 'other-user' } }));
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({ uploadedById: 'user-123' })
    );
    // Non-uploader has MEMBER role, not ADMIN
    mockWorkspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-123'));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 and deletes file when uploader makes the request', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({
        uploadedById: 'user-123',
        messageAttachments: [],
      })
    );

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('deleted');
    expect(body.deletedMessageCount).toBe(0);
  });

  it('returns 200 and deletes file when workspace admin makes the request', async () => {
    // Admin user who is NOT the original uploader
    auth.mockResolvedValue(
      createMockSession({
        user: { id: 'admin-user', email: 'admin@example.com' },
      })
    );
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({
        uploadedById: 'original-uploader',
        messageAttachments: [],
      })
    );
    // Admin membership check passes
    mockWorkspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain('deleted');
  });

  it('soft-deletes messages that contained the file and reports the count', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({
        uploadedById: 'user-123',
        messageAttachments: [{ messageId: 'msg-1' }, { messageId: 'msg-2' }],
      })
    );

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, createRouteContext('file-123'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deletedMessageCount).toBe(2);
    // Verify the transaction ran message soft-delete
    expect(mockMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['msg-1', 'msg-2'] } },
        data: expect.objectContaining({ isDeleted: true }),
      })
    );
  });

  it('runs prisma.$transaction to ensure atomic deletion', async () => {
    auth.mockResolvedValue(createMockSession());
    mockFile.findUnique.mockResolvedValue(
      buildMockFile({ uploadedById: 'user-123', messageAttachments: [] })
    );

    const { DELETE } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/files/file-123', {
      method: 'DELETE',
    });
    await DELETE(request, createRouteContext('file-123'));

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockFileDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'file-123' } })
    );
  });
});
