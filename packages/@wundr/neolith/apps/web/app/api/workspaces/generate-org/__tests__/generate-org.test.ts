/**
 * Tests for Workspace Genesis API Endpoint
 *
 * @module app/api/workspaces/generate-org/__tests__/generate-org.test
 */

import { prisma } from '@neolith/database';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/lib/auth';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@neolith/database', () => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@wundr.io/org-genesis', () => ({
  createGenesisEngine: vi.fn(() => ({
    generate: vi.fn(),
  })),
}));

vi.mock('@neolith/org-integration', () => ({
  migrateOrgGenesisResult: vi.fn(),
}));

describe('POST /api/workspaces/generate-org', () => {
  const mockSession: Session = {
    user: {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      isOrchestrator: false,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const mockOrganization = {
    id: 'org_123',
    name: 'Test Org',
    slug: 'test-org',
  };

  const mockInput = {
    organizationName: 'Test Organization',
    organizationId: 'org_123',
    workspaceName: 'Engineering',
    workspaceSlug: 'engineering',
    organizationType: 'technology' as const,
    description: 'AI-powered engineering workspace',
    strategy: 'Build scalable AI systems',
    targetAssets: ['AI Models', 'Cloud Infrastructure'],
    riskTolerance: 'moderate' as const,
    teamSize: 'medium' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('GENESIS_UNAUTHORIZED');
    });

    it('should return 404 if user is not a member of the organization', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null);

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('GENESIS_ORG_NOT_FOUND');
    });

    it('should return 403 if user does not have ADMIN or OWNER role', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        id: 'member_123',
        organizationId: 'org_123',
        userId: 'user_123',
        role: 'MEMBER',
        joinedAt: new Date(),
      });

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe('GENESIS_FORBIDDEN');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        id: 'member_123',
        organizationId: 'org_123',
        userId: 'user_123',
        role: 'ADMIN',
        joinedAt: new Date(),
      });
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('GENESIS_VALIDATION_ERROR');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidInput = {
        organizationName: 'Test',
        // Missing other required fields
      };

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('GENESIS_VALIDATION_ERROR');
      expect(data.error.details.errors).toBeDefined();
    });

    it('should return 400 for invalid workspace slug format', async () => {
      const invalidInput = {
        ...mockInput,
        workspaceSlug: 'Invalid Slug With Spaces',
      };

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('GENESIS_VALIDATION_ERROR');
    });

    it('should return 400 for description too short', async () => {
      const invalidInput = {
        ...mockInput,
        description: 'Short',
      };

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('GENESIS_VALIDATION_ERROR');
    });

    it('should return 400 for empty target assets array', async () => {
      const invalidInput = {
        ...mockInput,
        targetAssets: [],
      };

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('GENESIS_VALIDATION_ERROR');
    });
  });

  describe('Workspace Slug Uniqueness', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        id: 'member_123',
        organizationId: 'org_123',
        userId: 'user_123',
        role: 'ADMIN',
        joinedAt: new Date(),
      });
    });

    it('should return 409 if workspace slug already exists', async () => {
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue({
        id: 'workspace_existing',
        name: 'Existing Workspace',
        slug: 'engineering',
        organizationId: 'org_123',
        description: null,
        avatarUrl: null,
        visibility: 'PRIVATE',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe('GENESIS_WORKSPACE_SLUG_EXISTS');
    });
  });

  describe('Organization Generation', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        id: 'member_123',
        organizationId: 'org_123',
        userId: 'user_123',
        role: 'ADMIN',
        joinedAt: new Date(),
      });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
    });

    it('should handle genesis generation errors gracefully', async () => {
      const { createGenesisEngine } = await import('@wundr.io/org-genesis');
      const mockEngine = {
        generate: vi.fn().mockRejectedValue(new Error('Generation failed')),
      };
      vi.mocked(createGenesisEngine).mockReturnValue(mockEngine as any);

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('GENESIS_GENERATION_FAILED');
      expect(data.error.details.error).toBe('Generation failed');
    });

    it('should handle migration validation errors gracefully', async () => {
      const { createGenesisEngine } = await import('@wundr.io/org-genesis');
      const { migrateOrgGenesisResult } =
        await import('@neolith/org-integration');

      const mockGenesisResult = {
        manifest: {
          id: 'manifest_123',
          name: 'Test Org',
          description: 'Test description',
          mission: 'Test mission',
          vision: 'Test vision',
          values: ['value1'],
        },
        orchestrators: [],
        disciplines: [],
        agents: [],
        stats: {
          orchestratorCount: 0,
          disciplineCount: 0,
          agentCount: 0,
          generationTimeMs: 1000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      };

      const mockEngine = {
        generate: vi.fn().mockResolvedValue(mockGenesisResult),
      };

      vi.mocked(createGenesisEngine).mockReturnValue(mockEngine as any);
      vi.mocked(migrateOrgGenesisResult).mockRejectedValue(
        new Error('Migration failed')
      );

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('GENESIS_MIGRATION_FAILED');
    });
  });

  describe('Successful Workspace Creation', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue({
        id: 'member_123',
        organizationId: 'org_123',
        userId: 'user_123',
        role: 'ADMIN',
        joinedAt: new Date(),
      });
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
    });

    it('should create workspace with full org structure successfully', async () => {
      const { createGenesisEngine } = await import('@wundr.io/org-genesis');
      const { migrateOrgGenesisResult } =
        await import('@neolith/org-integration');

      const mockGenesisResult = {
        manifest: {
          id: 'manifest_123',
          name: 'Test Org',
          description: 'Test description',
          mission: 'Test mission',
          vision: 'Test vision',
          values: ['Innovation', 'Excellence'],
        },
        orchestrators: [
          {
            id: 'orchestrator_1',
            name: 'Head of Engineering',
            title: 'Chief Technology Officer',
            responsibilities: ['Technology Strategy', 'Team Leadership'],
            disciplines: ['disc_1'],
            persona: {
              communicationStyle: 'Direct',
              decisionMakingStyle: 'Data-driven',
              background: 'Engineering',
              traits: ['Analytical'],
            },
            kpis: ['System Uptime', 'Team Velocity'],
          },
        ],
        disciplines: [
          {
            id: 'disc_1',
            name: 'Engineering',
            description: 'Software engineering discipline',
            orchestratorId: 'orchestrator_1',
            slug: 'engineering',
            purpose: 'Build products',
            activities: ['Coding', 'Testing'],
            capabilities: ['Full-stack development'],
          },
        ],
        agents: [],
        stats: {
          orchestratorCount: 1,
          disciplineCount: 1,
          agentCount: 0,
          generationTimeMs: 5000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      };

      const mockMigrationResult = {
        orchestratorMappings: {
          mappings: [],
          total: 1,
          successful: 1,
          failed: 0,
          mappedAt: new Date().toISOString(),
        },
        disciplineMappings: {
          mappings: [],
          total: 1,
          successful: 1,
          failed: 0,
          mappedAt: new Date().toISOString(),
        },
        status: 'complete' as const,
        migratedAt: new Date().toISOString(),
        warnings: [],
      };

      const mockWorkspace = {
        id: 'workspace_123',
        name: 'Engineering',
        slug: 'engineering',
        organizationId: 'org_123',
        description: mockInput.description,
        avatarUrl: null,
        visibility: 'PRIVATE' as const,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: mockOrganization,
        channels: [],
        members: [],
        _count: {
          members: 2,
          channels: 2,
        },
      };

      const mockEngine = {
        generate: vi.fn().mockResolvedValue(mockGenesisResult),
      };

      vi.mocked(createGenesisEngine).mockReturnValue(mockEngine as any);
      vi.mocked(migrateOrgGenesisResult).mockResolvedValue(mockMigrationResult);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockWorkspace as any);

      const request = new Request(
        'http://localhost/api/workspaces/generate-org',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockInput),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(data.genesis).toBeDefined();
      expect(data.genesis.orchestratorCount).toBe(1);
      expect(data.genesis.disciplineCount).toBe(1);
      expect(data.migration).toBeDefined();
      expect(data.migration.status).toBe('complete');
      expect(data.message).toBe(
        'Workspace created successfully with organizational structure'
      );
    });
  });
});
