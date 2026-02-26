/**
 * Webhooks [provider] API Route Handler Tests
 *
 * Unit tests for the webhook ingestion route handler covering:
 * - POST /api/webhooks/:provider - Receive webhook from external provider
 * - GET /api/webhooks/:provider - Provider verification (custom only)
 *
 * Tests cover empty body rejection, unknown provider rejection, and happy-path
 * processing for GitHub push, GitLab pipeline, and Linear issue webhooks.
 *
 * @module app/api/webhooks/[provider]/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockAuditLog = {
  create: vi.fn(),
};

const mockPrisma = {
  auditLog: mockAuditLog,
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock signature verification — we control pass/fail per test
const mockVerifySlackSignature = vi.fn();
const mockVerifyGitHubSignature = vi.fn();

vi.mock('@/lib/services/integration-service', () => ({
  verifySlackSignature: mockVerifySlackSignature,
  verifyGitHubSignature: mockVerifyGitHubSignature,
}));

vi.mock('@/lib/validations/integration', () => ({
  INTEGRATION_ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    WEBHOOK_SECRET_MISMATCH: 'WEBHOOK_SECRET_MISMATCH',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

vi.mock('@/lib/validations/organization', () => ({
  createErrorResponse: (message: string, code: string) => ({
    error: { message, code },
  }),
}));

// =============================================================================
// HELPERS
// =============================================================================

function buildRequest(url: string, init?: RequestInit): NextRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

function createRouteContext(provider: string) {
  return {
    params: Promise.resolve({ provider }),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/webhooks/:provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: GitHub signature verification passes
    mockVerifyGitHubSignature.mockReturnValue(true);
    mockVerifySlackSignature.mockReturnValue(true);
    // Default: auditLog.create is a no-op
    mockAuditLog.create.mockResolvedValue({});
  });

  it('returns 400 when request body is empty', async () => {
    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, createRouteContext('github'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for an unknown provider', async () => {
    const { POST } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/webhooks/unknownprovider',
      {
        method: 'POST',
        body: JSON.stringify({ event: 'ping' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, createRouteContext('unknownprovider'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 for a GitHub push webhook with valid signature', async () => {
    mockVerifyGitHubSignature.mockReturnValue(true);

    const githubPushPayload = {
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'my-repo', full_name: 'org/my-repo' },
      pusher: { name: 'alice', email: 'alice@example.com' },
      sender: { login: 'alice', id: 1 },
      commits: [
        {
          id: 'abc123',
          message: 'fix: bug fix',
          author: { name: 'Alice' },
        },
      ],
    };

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: JSON.stringify(githubPushPayload),
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=valid-sig',
        'x-github-event': 'push',
      },
    });
    const response = await POST(request, createRouteContext('github'));

    expect(response.status).toBe(200);
    // audit log should have been written for the push event
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'github.push',
          resourceType: 'repository',
        }),
      })
    );
  });

  it('returns 401 when GitHub signature is missing', async () => {
    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: JSON.stringify({ ref: 'refs/heads/main' }),
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'push',
        // deliberately no x-hub-signature-256 header
      },
    });
    const response = await POST(request, createRouteContext('github'));

    expect(response.status).toBe(401);
  });

  it('returns 401 when GitHub signature verification fails', async () => {
    mockVerifyGitHubSignature.mockReturnValue(false);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: JSON.stringify({ ref: 'refs/heads/main' }),
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=bad-sig',
        'x-github-event': 'push',
      },
    });
    const response = await POST(request, createRouteContext('github'));

    expect(response.status).toBe(401);
  });

  it('returns 200 for a GitLab pipeline webhook', async () => {
    // GitLab uses token header; when GITLAB_WEBHOOK_SECRET is not set, token is not checked
    delete process.env.GITLAB_WEBHOOK_SECRET;

    const gitlabPayload = {
      object_kind: 'pipeline',
      ref: 'refs/heads/develop',
      status: 'success',
      stages: ['build', 'test'],
    };

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/gitlab', {
      method: 'POST',
      body: JSON.stringify(gitlabPayload),
      headers: {
        'Content-Type': 'application/json',
        'x-gitlab-event': 'Pipeline Hook',
        'x-gitlab-token': 'any-token',
      },
    });
    const response = await POST(request, createRouteContext('gitlab'));

    expect(response.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'gitlab.pipeline.success',
          resourceType: 'pipeline',
        }),
      })
    );
  });

  it('returns 200 for a Linear issue create webhook', async () => {
    const linearPayload = {
      type: 'Issue',
      action: 'create',
      data: {
        id: 'issue-abc',
        title: 'Fix login bug',
        state: { name: 'In Progress' },
        assignee: { name: 'Bob' },
      },
    };

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/linear', {
      method: 'POST',
      body: JSON.stringify(linearPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, createRouteContext('linear'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'linear.issue.create',
          resourceType: 'issue',
          resourceId: 'issue-abc',
        }),
      })
    );
  });

  it('returns 200 for a custom webhook', async () => {
    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/custom', {
      method: 'POST',
      body: JSON.stringify({ event: 'custom-event', data: {} }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request, createRouteContext('custom'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
  });

  it('handles GitHub pull_request event and writes audit log', async () => {
    mockVerifyGitHubSignature.mockReturnValue(true);

    const prPayload = {
      action: 'opened',
      number: 42,
      repository: { id: 1, name: 'my-repo', full_name: 'org/my-repo' },
      pull_request: {
        number: 42,
        title: 'Add feature X',
        merged: false,
        user: { login: 'carol' },
        head: { ref: 'feature/x' },
        base: { ref: 'main' },
      },
      sender: { login: 'carol', id: 2 },
    };

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: JSON.stringify(prPayload),
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=valid',
        'x-github-event': 'pull_request',
      },
    });
    const response = await POST(request, createRouteContext('github'));

    expect(response.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'github.pull_request.opened',
          resourceType: 'pull_request',
        }),
      })
    );
  });
});

describe('GET /api/webhooks/:provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for providers that do not support GET verification', async () => {
    const { GET } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/webhooks/github');
    const response = await GET(request, createRouteContext('github'));

    expect(response.status).toBe(405);
  });

  it('echoes challenge for custom provider GET verification', async () => {
    const { GET } = await import('../route');
    const request = buildRequest(
      'http://localhost:3000/api/webhooks/custom?challenge=my-challenge-token'
    );
    const response = await GET(request, createRouteContext('custom'));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('my-challenge-token');
  });
});
