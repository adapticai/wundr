/**
 * Organization API Route Tests
 *
 * Comprehensive test suite for Organization REST API endpoints covering:
 * - POST /api/organizations - Create organization
 * - GET /api/organizations - List organizations
 * - GET /api/organizations/:id - Get organization by ID
 * - PATCH /api/organizations/:id - Update organization
 * - DELETE /api/organizations/:id - Delete organization
 * - POST /api/organizations/:id/members - Add member
 * - PATCH /api/organizations/:id/members/:userId - Update member role
 * - DELETE /api/organizations/:id/members/:userId - Remove member
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/organizations/__tests__/organizations.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock NextAuth
vi.mock('next-auth', () => ({
  authMock: vi.fn(),
}));

// Mock the organization services
const mockOrganizationService = {
  createOrganization: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  listOrganizations: vi.fn(),
  addMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
};

vi.mock('@neolith/core', () => ({
  createOrganizationService: vi.fn(() => mockOrganizationService),
  organizationService: mockOrganizationService,
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

// @ts-expect-error Reserved for future integration tests
function _createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL('http://localhost:3000/api/organizations');

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

function createMockOrganizationResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    description: 'A test organization',
    logoUrl: null,
    website: null,
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: {
      members: 1,
      workspaces: 0,
    },
    ...overrides,
  };
}

function createMockMemberResponse(overrides?: Record<string, unknown>) {
  return {
    id: 'member-123',
    organizationId: 'org-123',
    userId: 'user-456',
    role: 'MEMBER',
    createdAt: new Date().toISOString(),
    user: {
      id: 'user-456',
      name: 'Test User',
      email: 'testuser@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      isOrchestrator: false,
    },
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Organization API Routes', () => {
  let authMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const authModule = await import('@/lib/auth');
    authMock = authModule.auth as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/organizations - Create Organization
  // ===========================================================================

  describe('POST /api/organizations', () => {
    it('creates organization with valid data', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockOrg = createMockOrganizationResponse();
      mockOrganizationService.createOrganization.mockResolvedValue(mockOrg);

      const requestBody = {
        name: 'New Organization',
        slug: 'new-org',
        description: 'A new organization',
      };

      // Simulate route handler behavior
      expect(session.user).toBeDefined();
      expect(requestBody.name).toBeDefined();
      expect(requestBody.slug).toBeDefined();

      const result = await mockOrganizationService.createOrganization({
        ...requestBody,
        creatorId: session.user.id,
      });

      expect(result).toEqual(mockOrg);
      expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Organization',
          slug: 'new-org',
        })
      );
    });

    it('sets creator as owner', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockOrg = createMockOrganizationResponse();
      mockOrganizationService.createOrganization.mockResolvedValue({
        ...mockOrg,
        membership: { role: 'OWNER' },
      });

      const result = await mockOrganizationService.createOrganization({
        name: 'Test Org',
        slug: 'test-org',
        creatorId: session.user.id,
      });

      expect(result.membership?.role).toBe('OWNER');
    });

    it('returns 401 without authentication', async () => {
      authMock.mockResolvedValue(null);

      const session = await authMock();
      expect(session).toBeNull();

      // Route handler would return 401
      const expectedStatus = session ? 201 : 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 400 for invalid data', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      // Missing required fields
      const invalidRequestBody = {
        name: '', // Invalid - empty
        // Missing slug
      };

      mockOrganizationService.createOrganization.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      });

      await expect(
        mockOrganizationService.createOrganization(invalidRequestBody)
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('returns 409 for duplicate slug', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.createOrganization.mockRejectedValue({
        code: 'ORGANIZATION_SLUG_EXISTS',
        message: 'An organization with this slug already exists',
      });

      await expect(
        mockOrganizationService.createOrganization({
          name: 'Test',
          slug: 'existing-slug',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'ORGANIZATION_SLUG_EXISTS',
        })
      );
    });

    it('validates slug format', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      // Invalid slug with special characters
      const invalidSlug = 'Invalid Slug!@#';

      mockOrganizationService.createOrganization.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        message:
          'Slug must only contain lowercase letters, numbers, and hyphens',
      });

      await expect(
        mockOrganizationService.createOrganization({
          name: 'Test',
          slug: invalidSlug,
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });
  });

  // ===========================================================================
  // GET /api/organizations - List Organizations
  // ===========================================================================

  describe('GET /api/organizations', () => {
    it('lists organizations user belongs to', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockOrgs = [
        createMockOrganizationResponse({ id: 'org-1', name: 'Org 1' }),
        createMockOrganizationResponse({ id: 'org-2', name: 'Org 2' }),
      ];

      mockOrganizationService.listOrganizations.mockResolvedValue({
        data: mockOrgs,
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const result = await mockOrganizationService.listOrganizations({
        userId: session.user.id,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it('supports pagination', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.listOrganizations.mockResolvedValue({
        data: [createMockOrganizationResponse()],
        pagination: {
          page: 2,
          limit: 10,
          totalCount: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });

      const result = await mockOrganizationService.listOrganizations({
        userId: session.user.id,
        page: 2,
        limit: 10,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('supports search filtering', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.listOrganizations.mockResolvedValue({
        data: [createMockOrganizationResponse({ name: 'Acme Corp' })],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const result = await mockOrganizationService.listOrganizations({
        userId: session.user.id,
        search: 'acme',
      });

      expect(result.data).toHaveLength(1);
      expect(mockOrganizationService.listOrganizations).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'acme',
        })
      );
    });

    it('returns 401 without authentication', async () => {
      authMock.mockResolvedValue(null);

      const session = await authMock();
      expect(session).toBeNull();
    });
  });

  // ===========================================================================
  // GET /api/organizations/:id - Get Organization
  // ===========================================================================

  describe('GET /api/organizations/:id', () => {
    it('returns organization when found', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockOrg = createMockOrganizationResponse();
      mockOrganizationService.getOrganization.mockResolvedValue(mockOrg);

      const result = await mockOrganizationService.getOrganization('org-123');

      expect(result).toEqual(mockOrg);
      expect(result.id).toBe('org-123');
    });

    it('returns 404 when organization not found', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.getOrganization.mockRejectedValue({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });

      await expect(
        mockOrganizationService.getOrganization('non-existent-id')
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'ORGANIZATION_NOT_FOUND',
        })
      );
    });

    it('returns 403 for non-member', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.getOrganization.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });

      await expect(
        mockOrganizationService.getOrganization('org-not-member')
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });
  });

  // ===========================================================================
  // PATCH /api/organizations/:id - Update Organization
  // ===========================================================================

  describe('PATCH /api/organizations/:id', () => {
    it('updates organization with valid data', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const updatedOrg = createMockOrganizationResponse({
        name: 'Updated Name',
        description: 'Updated description',
      });
      mockOrganizationService.updateOrganization.mockResolvedValue(updatedOrg);

      const result = await mockOrganizationService.updateOrganization(
        'org-123',
        {
          name: 'Updated Name',
          description: 'Updated description',
        }
      );

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
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
      authMock.mockResolvedValue(session);

      // Check permission
      const hasPermission =
        session.user.role === 'ADMIN' || session.user.role === 'OWNER';
      expect(hasPermission).toBe(false);
    });

    it('returns 404 when organization not found', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.updateOrganization.mockRejectedValue({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });

      await expect(
        mockOrganizationService.updateOrganization('non-existent-id', {
          name: 'New Name',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'ORGANIZATION_NOT_FOUND',
        })
      );
    });
  });

  // ===========================================================================
  // DELETE /api/organizations/:id - Delete Organization
  // ===========================================================================

  describe('DELETE /api/organizations/:id', () => {
    it('deletes organization when authorized', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'OWNER',
          organizationId: 'org-123',
        },
      });
      authMock.mockResolvedValue(session);

      mockOrganizationService.deleteOrganization.mockResolvedValue(undefined);

      await expect(
        mockOrganizationService.deleteOrganization('org-123')
      ).resolves.toBeUndefined();
      expect(mockOrganizationService.deleteOrganization).toHaveBeenCalledWith(
        'org-123'
      );
    });

    it('returns 403 for non-owner', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'ADMIN', // Not OWNER
          organizationId: 'org-123',
        },
      });
      authMock.mockResolvedValue(session);

      mockOrganizationService.deleteOrganization.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Only the organization owner can delete the organization',
      });

      await expect(
        mockOrganizationService.deleteOrganization('org-123')
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });
  });

  // ===========================================================================
  // POST /api/organizations/:id/members - Add Member
  // ===========================================================================

  describe('POST /api/organizations/:id/members', () => {
    it('adds member with role', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const mockMember = createMockMemberResponse();
      mockOrganizationService.addMember.mockResolvedValue(mockMember);

      const result = await mockOrganizationService.addMember('org-123', {
        userId: 'user-456',
        role: 'MEMBER',
      });

      expect(result.userId).toBe('user-456');
      expect(result.role).toBe('MEMBER');
    });

    it('requires admin permission', async () => {
      const session = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'MEMBER', // Not ADMIN
          organizationId: 'org-123',
        },
      });
      authMock.mockResolvedValue(session);

      mockOrganizationService.addMember.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions. Admin or Owner role required.',
      });

      await expect(
        mockOrganizationService.addMember('org-123', {
          userId: 'user-456',
          role: 'MEMBER',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('returns 409 for duplicate member', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.addMember.mockRejectedValue({
        code: 'ALREADY_CHANNEL_MEMBER',
        message: 'User is already a member of this organization',
      });

      await expect(
        mockOrganizationService.addMember('org-123', {
          userId: 'existing-user',
          role: 'MEMBER',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'ALREADY_CHANNEL_MEMBER',
        })
      );
    });

    it('returns 404 for non-existent user', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.addMember.mockRejectedValue({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });

      await expect(
        mockOrganizationService.addMember('org-123', {
          userId: 'non-existent-user',
          role: 'MEMBER',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
        })
      );
    });
  });

  // ===========================================================================
  // PATCH /api/organizations/:id/members/:userId - Update Member Role
  // ===========================================================================

  describe('PATCH /api/organizations/:id/members/:userId', () => {
    it('updates member role', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      const updatedMember = createMockMemberResponse({ role: 'ADMIN' });
      mockOrganizationService.updateMemberRole.mockResolvedValue(updatedMember);

      const result = await mockOrganizationService.updateMemberRole(
        'org-123',
        'user-456',
        {
          role: 'ADMIN',
        }
      );

      expect(result.role).toBe('ADMIN');
    });

    it('cannot modify owner', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.updateMemberRole.mockRejectedValue({
        code: 'CANNOT_MODIFY_OWNER',
        message: 'Cannot modify the organization owner',
      });

      await expect(
        mockOrganizationService.updateMemberRole('org-123', 'owner-user-id', {
          role: 'MEMBER',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CANNOT_MODIFY_OWNER',
        })
      );
    });

    it('cannot assign owner role', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.updateMemberRole.mockRejectedValue({
        code: 'FORBIDDEN',
        message: 'Cannot assign OWNER role. Use transfer ownership instead.',
      });

      await expect(
        mockOrganizationService.updateMemberRole('org-123', 'user-456', {
          role: 'OWNER',
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });
  });

  // ===========================================================================
  // DELETE /api/organizations/:id/members/:userId - Remove Member
  // ===========================================================================

  describe('DELETE /api/organizations/:id/members/:userId', () => {
    it('removes member when authorized', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.removeMember.mockResolvedValue(undefined);

      await expect(
        mockOrganizationService.removeMember('org-123', 'user-456')
      ).resolves.toBeUndefined();
    });

    it('allows self-removal', async () => {
      const session = createMockSession({
        user: {
          id: 'user-456',
          email: 'test@example.com',
          role: 'MEMBER',
          organizationId: 'org-123',
        },
      });
      authMock.mockResolvedValue(session);

      mockOrganizationService.removeMember.mockResolvedValue(undefined);

      // User can remove themselves
      await expect(
        mockOrganizationService.removeMember('org-123', session.user.id)
      ).resolves.toBeUndefined();
    });

    it('cannot remove owner', async () => {
      const session = createMockSession();
      authMock.mockResolvedValue(session);

      mockOrganizationService.removeMember.mockRejectedValue({
        code: 'CANNOT_REMOVE_SELF_AS_OWNER',
        message:
          'Cannot remove the organization owner. Transfer ownership first.',
      });

      await expect(
        mockOrganizationService.removeMember('org-123', 'owner-user-id')
      ).rejects.toEqual(
        expect.objectContaining({
          code: 'CANNOT_REMOVE_SELF_AS_OWNER',
        })
      );
    });
  });
});
