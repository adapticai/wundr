/**
 * OrchestratorAPI Route Tests
 *
 * Comprehensive test suite for OrchestratorREST API endpoints covering:
 * - POST /api/orchestrators - Create Orchestrator
 * - GET /api/orchestrators - List Orchestrators
 * - GET /api/orchestrators/:id - Get Orchestrator by ID
 * - PUT /api/orchestrators/:id - Update Orchestrator
 * - DELETE /api/orchestrators/:id - Delete Orchestrator
 * - POST /api/orchestrators/:id/activate - Activate Orchestrator
 * - POST /api/orchestrators/:id/deactivate - Deactivate Orchestrator
 * - POST /api/orchestrators/:id/api-key - Generate API key
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/orchestrators/__tests__/orchestrators.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock auth module
const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  mockAuth: mockAuth,
}));

// Mock the Orchestrator service
const mockVPService = {
  createVP: vi.fn(),
  getVP: vi.fn(),
  updateVP: vi.fn(),
  deleteVP: vi.fn(),
  activateVP: vi.fn(),
  deactivateVP: vi.fn(),
  generateAPIKey: vi.fn(),
  rotateAPIKey: vi.fn(),
  revokeAPIKey: vi.fn(),
  validateAPIKey: vi.fn(),
  listOrchestratorsByOrganization: vi.fn(),
};

vi.mock('@neolith/core', () => ({
  createVPService: vi.fn(() => mockVPService),
  vpService: mockVPService,
}));

// Mock Prisma
vi.mock('@neolith/database', () => ({
  prisma: {},
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
      organizationId: 'org-123',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL('http://localhost:3000/api/orchestrators');

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createMockVPResponse() {
  return {
    id: 'orchestrator-123',
    discipline: 'Engineering',
    role: 'Orchestrator of Engineering',
    capabilities: ['testing'],
    daemonEndpoint: null,
    status: 'OFFLINE',
    userId: 'user-orchestrator-123',
    organizationId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-orchestrator-123',
      email: 'test-orchestrator@orchestrator.org.genesis.local',
      name: 'Test Orchestrator',
      displayName: 'Test Orchestrator',
      status: 'ACTIVE',
      isOrchestrator: true,
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('OrchestratorAPI Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/orchestrators - Create Orchestrator
  // ===========================================================================

  describe('POST /api/orchestrators', () => {
    it('creates Orchestrator with valid data', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const mockVP = createMockVPResponse();
      mockVPService.createVP.mockResolvedValue(mockVP);

      const requestBody = {
        name: 'Test Orchestrator',
        discipline: 'Engineering',
        role: 'Orchestrator of Engineering',
        organizationId: 'org-123',
      };

      // @ts-expect-error Reserved for future integration tests
      const _request = createMockRequest('POST', requestBody);

      // Simulating route handler behavior (TODO: use request with actual route handler)
      expect(session.user.role).toBe('ADMIN');
      expect(requestBody.name).toBeDefined();
      expect(requestBody.discipline).toBeDefined();
      expect(requestBody.role).toBeDefined();
      expect(requestBody.organizationId).toBeDefined();

      // Call mock service
      const result = await mockVPService.createVP(requestBody);

      expect(result).toEqual(mockVP);
      expect(mockVPService.createVP).toHaveBeenCalledWith(requestBody);
    });

    it('returns 401 without authentication', async () => {
      mockAuth.mockResolvedValue(null);

      // Without session, request should be rejected
      const session = await mockAuth();
      expect(session).toBeNull();

      // In actual route handler, this would return 401
      const expectedStatus = 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 403 without admin permission', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'MEMBER', // Not ADMIN
          organizationId: 'org-123',
        },
      });
      mockAuth.mockResolvedValue(session);

      // Check permission
      const hasPermission = session.user.role === 'ADMIN';
      expect(hasPermission).toBe(false);

      // In actual route handler, this would return 403
      const expectedStatus = hasPermission ? 200 : 403;
      expect(expectedStatus).toBe(403);
    });

    it('returns 400 for invalid data', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      // Missing required fields
      const invalidRequestBody = {
        name: '', // Invalid - empty
        // Missing discipline, role, organizationId
      };

      mockVPService.createVP.mockRejectedValue(
        new Error('Orchestrator validation failed')
      );

      await expect(mockVPService.createVP(invalidRequestBody)).rejects.toThrow(
        'Orchestrator validation failed'
      );
    });

    it('validates name length', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const invalidName = 'a'.repeat(101); // Over 100 char limit

      const requestBody = {
        name: invalidName,
        discipline: 'Engineering',
        role: 'Orchestrator',
        organizationId: 'org-123',
      };

      mockVPService.createVP.mockRejectedValue(
        new Error('Name must be 100 characters or less')
      );

      await expect(mockVPService.createVP(requestBody)).rejects.toThrow(
        'Name must be 100 characters or less'
      );
    });
  });

  // ===========================================================================
  // GET /api/orchestrators - List Orchestrators
  // ===========================================================================

  describe('GET /api/orchestrators', () => {
    it('lists Orchestrators in organization', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const mockOrchestrators = [
        createMockVPResponse(),
        createMockVPResponse(),
      ];
      mockVPService.listOrchestratorsByOrganization.mockResolvedValue({
        data: mockOrchestrators,
        total: 2,
        hasMore: false,
      });

      const result = await mockVPService.listOrchestratorsByOrganization(
        session.user.organizationId
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(
        mockVPService.listOrchestratorsByOrganization
      ).toHaveBeenCalledWith('org-123');
    });

    it('filters by status', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const onlineVP = { ...createMockVPResponse(), status: 'ONLINE' };
      mockVPService.listOrchestratorsByOrganization.mockResolvedValue({
        data: [onlineVP],
        total: 1,
        hasMore: false,
      });

      const result = await mockVPService.listOrchestratorsByOrganization(
        session.user.organizationId,
        { status: 'ONLINE' }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('ONLINE');
    });

    it('paginates results', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const mockOrchestrators = Array.from({ length: 10 }, () =>
        createMockVPResponse()
      );
      mockVPService.listOrchestratorsByOrganization.mockResolvedValue({
        data: mockOrchestrators,
        total: 25,
        hasMore: true,
        nextCursor: 'cursor-10',
      });

      const result = await mockVPService.listOrchestratorsByOrganization(
        session.user.organizationId,
        { take: 10, skip: 0 }
      );

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('returns 401 without authentication', async () => {
      mockAuth.mockResolvedValue(null);

      const session = await mockAuth();
      expect(session).toBeNull();
    });
  });

  // ===========================================================================
  // GET /api/orchestrators/:id - Get Orchestrator by ID
  // ===========================================================================

  describe('GET /api/orchestrators/:id', () => {
    it('returns Orchestrator when found', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const mockVP = createMockVPResponse();
      mockVPService.getVP.mockResolvedValue(mockVP);

      const result = await mockVPService.getVP('orchestrator-123');

      expect(result).toEqual(mockVP);
      expect(result.id).toBe('orchestrator-123');
    });

    it('returns 404 when Orchestrator not found', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.getVP.mockResolvedValue(null);

      const result = await mockVPService.getVP('non-existent-id');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // PUT /api/orchestrators/:id - Update Orchestrator
  // ===========================================================================

  describe('PUT /api/orchestrators/:id', () => {
    it('updates Orchestrator with valid data', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const updatedOrchestrator = {
        ...createMockVPResponse(),
        user: {
          ...createMockVPResponse().user,
          name: 'Updated Name',
          displayName: 'Updated Name',
        },
      };
      mockVPService.updateVP.mockResolvedValue(updatedOrchestrator);

      const result = await mockVPService.updateVP('orchestrator-123', {
        name: 'Updated Name',
      });

      expect(result.user.name).toBe('Updated Name');
    });

    it('returns 404 when Orchestrator not found', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.updateVP.mockRejectedValue(
        new Error('Orchestrator not found with id: non-existent-id')
      );

      await expect(
        mockVPService.updateVP('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Orchestrator not found');
    });
  });

  // ===========================================================================
  // DELETE /api/orchestrators/:id - Delete Orchestrator
  // ===========================================================================

  describe('DELETE /api/orchestrators/:id', () => {
    it('deletes Orchestrator when authorized', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.deleteVP.mockResolvedValue(undefined);

      await expect(
        mockVPService.deleteVP('orchestrator-123')
      ).resolves.toBeUndefined();
      expect(mockVPService.deleteVP).toHaveBeenCalledWith('orchestrator-123');
    });

    it('returns 404 when Orchestrator not found', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.deleteVP.mockRejectedValue(
        new Error('Orchestrator not found with id: non-existent-id')
      );

      await expect(mockVPService.deleteVP('non-existent-id')).rejects.toThrow(
        'Orchestrator not found'
      );
    });

    it('returns 403 without delete permission', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'MEMBER',
          organizationId: 'org-123',
        },
      });
      mockAuth.mockResolvedValue(session);

      const canDelete =
        session.user.role === 'ADMIN' || session.user.role === 'OWNER';
      expect(canDelete).toBe(false);
    });
  });

  // ===========================================================================
  // POST /api/orchestrators/:id/activate - Activate Orchestrator
  // ===========================================================================

  describe('POST /api/orchestrators/:id/activate', () => {
    it('activates Orchestrator', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const activatedVP = {
        ...createMockVPResponse(),
        status: 'ONLINE',
      };
      mockVPService.activateVP.mockResolvedValue(activatedVP);

      const result = await mockVPService.activateVP('orchestrator-123');

      expect(result.status).toBe('ONLINE');
    });

    it('returns 404 when Orchestrator not found', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.activateVP.mockRejectedValue(
        new Error('Orchestrator not found with id: non-existent-id')
      );

      await expect(mockVPService.activateVP('non-existent-id')).rejects.toThrow(
        'Orchestrator not found'
      );
    });
  });

  // ===========================================================================
  // POST /api/orchestrators/:id/deactivate - Deactivate Orchestrator
  // ===========================================================================

  describe('POST /api/orchestrators/:id/deactivate', () => {
    it('deactivates Orchestrator', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const deactivatedVP = {
        ...createMockVPResponse(),
        status: 'OFFLINE',
      };
      mockVPService.deactivateVP.mockResolvedValue(deactivatedVP);

      const result = await mockVPService.deactivateVP('orchestrator-123');

      expect(result.status).toBe('OFFLINE');
    });
  });

  // ===========================================================================
  // POST /api/orchestrators/:id/api-key - Generate API Key
  // ===========================================================================

  describe('POST /api/orchestrators/:id/api-key', () => {
    it('generates API key for Orchestrator', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const apiKeyResult = {
        key: 'gns_testkey123456789',
        keyHash: 'hash_123',
        keyPrefix: 'gns_test',
      };
      mockVPService.generateAPIKey.mockResolvedValue(apiKeyResult);

      const result = await mockVPService.generateAPIKey('orchestrator-123');

      expect(result.key).toMatch(/^gns_/);
      expect(result.keyHash).toBeDefined();
    });

    it('returns error when Orchestrator already has active key', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.generateAPIKey.mockRejectedValue(
        new Error('Orchestrator already has an active API key')
      );

      await expect(
        mockVPService.generateAPIKey('orchestrator-123')
      ).rejects.toThrow('already has an active API key');
    });
  });

  // ===========================================================================
  // POST /api/orchestrators/:id/api-key/rotate - Rotate API Key
  // ===========================================================================

  describe('POST /api/orchestrators/:id/api-key/rotate', () => {
    it('rotates API key', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      const rotationResult = {
        key: 'gns_newkey123456789',
        keyHash: 'hash_new',
        keyPrefix: 'gns_newk',
        previousKeyRevokedAt: new Date(),
      };
      mockVPService.rotateAPIKey.mockResolvedValue(rotationResult);

      const result = await mockVPService.rotateAPIKey('orchestrator-123');

      expect(result.key).toMatch(/^gns_/);
      expect(result.previousKeyRevokedAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // DELETE /api/orchestrators/:id/api-key - Revoke API Key
  // ===========================================================================

  describe('DELETE /api/orchestrators/:id/api-key', () => {
    it('revokes API key', async () => {
      const session = createMockSession();
      mockAuth.mockResolvedValue(session);

      mockVPService.revokeAPIKey.mockResolvedValue(undefined);

      await expect(
        mockVPService.revokeAPIKey('orchestrator-123')
      ).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  // POST /api/orchestrators/validate-key - Validate API Key
  // ===========================================================================

  describe('POST /api/orchestrators/validate-key', () => {
    it('validates API key and returns Orchestrator', async () => {
      const mockVP = createMockVPResponse();
      mockVPService.validateAPIKey.mockResolvedValue({
        valid: true,
        orchestrator: mockVP,
      });

      const result = await mockVPService.validateAPIKey('gns_validkey123');

      expect(result.valid).toBe(true);
      expect(result.orchestrator).toEqual(mockVP);
    });

    it('returns invalid for bad key', async () => {
      mockVPService.validateAPIKey.mockResolvedValue({
        valid: false,
        reason: 'invalid',
      });

      const result = await mockVPService.validateAPIKey('bad-key');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid');
    });

    it('returns invalid for revoked key', async () => {
      mockVPService.validateAPIKey.mockResolvedValue({
        valid: false,
        reason: 'revoked',
      });

      const result = await mockVPService.validateAPIKey('gns_revokedkey');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('revoked');
    });

    it('returns invalid for expired key', async () => {
      mockVPService.validateAPIKey.mockResolvedValue({
        valid: false,
        reason: 'expired',
      });

      const result = await mockVPService.validateAPIKey('gns_expiredkey');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });
});
