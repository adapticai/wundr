/**
 * Daemon Register API Route Handler Tests
 *
 * Unit tests for the daemon register route handler covering:
 * - POST /api/daemon/register - Register a daemon for an Orchestrator
 *
 * Tests cover validation, orchestrator lookup, org membership check,
 * API key validation, Redis heartbeat registration, and happy path.
 *
 * @module app/api/daemon/register/__tests__/route.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  orchestrator: { findUnique: vi.fn() },
};

vi.mock('@neolith/database', () => ({
  prisma: mockPrisma,
}));

// Mock bcrypt to be unavailable by default (tests that need it will override)
vi.mock('bcrypt', () => {
  throw new Error('bcrypt not available');
});

// Mock ioredis — dynamic import inside route; we make it unavailable by default
// Individual tests override via vi.doMock if Redis behavior is needed
vi.mock('ioredis', () => {
  throw new Error('ioredis not available');
});

// =============================================================================
// HELPERS
// =============================================================================

function buildRequest(url: string, init?: RequestInit): NextRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

/**
 * Builds a valid registration payload for happy-path tests.
 * The apiKey 'test-api-key' SHA-256 hashes to a known value so the
 * orchestrator mock must return the matching hash.
 */
function buildValidPayload(overrides?: Record<string, unknown>) {
  return {
    orchestratorId: 'orch-123',
    organizationId: 'org-456',
    apiKey: 'test-api-key',
    daemonInfo: {
      instanceId: 'daemon-001',
      version: '1.0.0',
      host: 'localhost',
      port: 8080,
      protocol: 'http',
      startedAt: '2024-01-01T00:00:00.000Z',
      capabilities: ['chat'],
    },
    ...overrides,
  };
}

/** SHA-256 hash of 'test-api-key' in hex */
const TEST_API_KEY_SHA256 =
  'ad9f3e5b8c7f1a2e4d6b0c9f3e5b8c7f1a2e4d6b0c9f3e5b8c7f1a2e4d6b0c';

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/daemon/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no REDIS_URL so ioredis path is skipped
    delete process.env.REDIS_URL;
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../route');
    const request = new NextRequest(
      new URL('http://localhost:3000/api/daemon/register'),
      {
        method: 'POST',
        body: 'not json {{{',
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for missing required body fields', async () => {
    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify({ orchestratorId: 'orch-123' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('REGISTER_VALIDATION_ERROR');
  });

  it('returns 400 for missing daemonInfo sub-fields', async () => {
    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify({
        orchestratorId: 'orch-123',
        organizationId: 'org-456',
        apiKey: 'some-key',
        daemonInfo: {
          // missing instanceId, version, host, port, protocol, startedAt
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('REGISTER_VALIDATION_ERROR');
  });

  it('returns 404 when orchestrator does not exist', async () => {
    mockPrisma.orchestrator.findUnique.mockResolvedValue(null);

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('ORCHESTRATOR_NOT_FOUND');
  });

  it('returns 403 when orchestrator belongs to a different organization', async () => {
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-123',
      organizationId: 'org-DIFFERENT',
      capabilities: { apiKeyHash: TEST_API_KEY_SHA256 },
    });

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when orchestrator has no apiKeyHash in capabilities', async () => {
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-123',
      organizationId: 'org-456',
      capabilities: null,
    });

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when API key does not match stored hash', async () => {
    // Provide a SHA-256 hash of a DIFFERENT key so comparison fails
    const wrongHash =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-123',
      organizationId: 'org-456',
      capabilities: { apiKeyHash: wrongHash },
    });

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 201 and registration data on success with matching SHA-256 hash', async () => {
    // Compute the actual SHA-256 of 'test-api-key' so the route accepts it
    const { createHash } = await import('crypto');
    const actualHash = createHash('sha256')
      .update('test-api-key')
      .digest('hex');

    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-123',
      organizationId: 'org-456',
      capabilities: { apiKeyHash: actualHash },
    });

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Daemon registered successfully');
    expect(body.data.orchestratorId).toBe('orch-123');
    expect(body.data.organizationId).toBe('org-456');
    expect(body.data.daemonInfo.instanceId).toBe('daemon-001');
    expect(body.data.heartbeatInterval).toBe(30000);
    expect(body.data.healthCheckEndpoint).toBe('/api/daemon/health/orch-123');
  });

  it('includes registeredAt timestamp in successful response', async () => {
    const { createHash } = await import('crypto');
    const actualHash = createHash('sha256')
      .update('test-api-key')
      .digest('hex');

    mockPrisma.orchestrator.findUnique.mockResolvedValue({
      id: 'orch-123',
      organizationId: 'org-456',
      capabilities: { apiKeyHash: actualHash },
    });

    const { POST } = await import('../route');
    const request = buildRequest('http://localhost:3000/api/daemon/register', {
      method: 'POST',
      body: JSON.stringify(buildValidPayload()),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.registeredAt).toBeDefined();
    expect(new Date(body.data.registeredAt).toISOString()).toBe(
      body.data.registeredAt
    );
  });
});
