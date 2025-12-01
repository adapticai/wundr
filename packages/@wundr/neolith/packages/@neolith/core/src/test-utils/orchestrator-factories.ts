/**
 * OrchestratorTest Data Factories
 *
 * Factory functions for creating consistent mock Orchestrator data in tests.
 * These factories provide sensible defaults while allowing overrides
 * for specific test scenarios.
 *
 * @module @genesis/core/test-utils/orchestrator-factories
 */

import { vi } from 'vitest';

import type {
  APIKeyGenerationResult,
  CreateVPInput,
  OrchestratorCharter,
  OrchestratorCommunicationPreferences,
  OrchestratorOperationalConfig,
  OrchestratorPersonality,
  OrchestratorServiceAccountConfig,
  UpdateVPInput,
} from '../types/orchestrator';

// =============================================================================
// ID GENERATORS
// =============================================================================

let idCounter = 0;

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/**
 * Generate a CUID-like test ID
 */
export function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

/**
 * Reset the ID counter (useful between test suites)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// PRIMITIVE FACTORIES
// =============================================================================

/**
 * Create mock personality traits
 */
export function createMockPersonality(
  overrides?: Partial<OrchestratorPersonality>
): OrchestratorPersonality {
  return {
    tone: 'professional',
    decisionStyle: 'analytical',
    background: 'AI-powered organizational agent',
    traits: ['helpful', 'knowledgeable', 'responsive'],
    interactionStyle: 'collaborative',
    ...overrides,
  };
}

/**
 * Create mock communication preferences
 */
export function createMockCommunicationPreferences(
  overrides?: Partial<OrchestratorCommunicationPreferences>
): OrchestratorCommunicationPreferences {
  return {
    responseLength: 'moderate',
    technicalLevel: 'intermediate',
    formality: 'professional',
    languages: ['en'],
    preferredChannels: ['chat'],
    ...overrides,
  };
}

/**
 * Create mock operational config
 */
export function createMockOperationalConfig(
  overrides?: Partial<OrchestratorOperationalConfig>
): OrchestratorOperationalConfig {
  return {
    workHours: {
      timezone: 'UTC',
      schedule: {},
      always24x7: true,
    },
    targetResponseTimeSeconds: 30,
    maxConcurrentConversations: 10,
    escalation: {
      enabled: false,
      escalateTo: [],
      triggers: [],
    },
    ...overrides,
  };
}

/**
 * Create mock Orchestrator charter
 */
export function createMockVPCharter(
  overrides?: Partial<OrchestratorCharter>
): OrchestratorCharter {
  return {
    systemPrompt: 'You are a helpful assistant for the organization.',
    personality: createMockPersonality(overrides?.personality),
    expertise: ['general', 'support'],
    communication: createMockCommunicationPreferences(overrides?.communication),
    operational: createMockOperationalConfig(overrides?.operational),
    ...overrides,
  };
}

// =============================================================================
// OrchestratorFACTORIES
// =============================================================================

/**
 * Mock Orchestrator data matching Prisma Orchestrator model
 */
export interface MockOrchestrator {
  id: string;
  discipline: string;
  role: string;
  capabilities: string[];
  daemonEndpoint: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  userId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mock User data matching Prisma User model
 */
export interface MockUser {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  isVP: boolean;
  vpConfig: OrchestratorServiceAccountConfig | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date | null;
}

/**
 * Mock OrchestratorWithUser combining Orchestrator and User data
 */
export interface MockOrchestratorWithUser extends MockOrchestrator {
  user: MockUser;
}

/**
 * Create a mock Orchestrator entity (Prisma model format)
 */
export function createMockVP(overrides?: Partial<MockVP>): MockOrchestrator {
  const id = overrides?.id ?? generateCuid();
  const userId = overrides?.userId ?? generateCuid();
  const organizationId = overrides?.organizationId ?? generateCuid();
  const now = new Date();

  return {
    id,
    discipline: 'Engineering',
    role: 'Orchestrator of Engineering',
    capabilities: ['code-review', 'documentation', 'testing'],
    daemonEndpoint: `https://daemon.example.com/vp/${id}`,
    status: 'OFFLINE',
    userId,
    organizationId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock User entity (Prisma model format)
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  const id = overrides?.id ?? generateCuid();
  const now = new Date();
  const slug = `test-orchestrator-${id.slice(-6)}`;

  return {
    id,
    email: `${slug}@vp.test-org.genesis.local`,
    name: 'Test Orchestrator',
    displayName: 'Test Orchestrator',
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
    bio: 'A test Orchestrator for automated testing',
    status: 'ACTIVE',
    isVP: true,
    vpConfig: {
      charter: createMockVPCharter(),
    },
    preferences: {},
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    ...overrides,
  };
}

/**
 * Create a mock Orchestrator with user data
 */
export function createMockOrchestratorWithUser(
  vpOverrides?: Partial<MockVP>,
  userOverrides?: Partial<MockUser>
): MockOrchestratorWithUser {
  const vp = createMockVP(vpOverrides);
  const user = createMockUser({
    id: vp.userId,
    ...userOverrides,
  });

  return {
    ...orchestrator,
    user,
  };
}

/**
 * Create multiple mock Orchestrators with users
 */
export function createMockVPList(
  count: number,
  overrides?: Partial<MockVP>
): MockOrchestratorWithUser[] {
  return Array.from({ length: count }, (_, index) =>
    createMockOrchestratorWithUser(
      {
        ...overrides,
      },
      {
        name: `Test Orchestrator ${index + 1}`,
        displayName: `Test Orchestrator ${index + 1}`,
      }
    )
  );
}

// =============================================================================
// API KEY FACTORIES
// =============================================================================

/**
 * Create a mock API key generation result
 */
export function createMockAPIKeyResult(
  overrides?: Partial<APIKeyGenerationResult>
): APIKeyGenerationResult {
  const key = `gns_${generateTestId('key')}`;
  return {
    key,
    keyHash: `hash_${key}`,
    keyPrefix: key.slice(0, 8),
    ...overrides,
  };
}

/**
 * Create a mock Orchestrator service account config
 */
export function createMockServiceAccountConfig(
  overrides?: Partial<OrchestratorServiceAccountConfig>
): OrchestratorServiceAccountConfig {
  return {
    apiKeyHash: undefined,
    apiKeyPrefix: undefined,
    apiKeyCreatedAt: undefined,
    apiKeyExpiresAt: undefined,
    apiKeyRevoked: undefined,
    charter: createMockVPCharter(),
    metadata: {},
    ...overrides,
  };
}

// =============================================================================
// DISCIPLINE FACTORIES
// =============================================================================

export interface MockDiscipline {
  id: string;
  name: string;
  slug: string;
  description: string;
}

/**
 * Create a mock discipline
 */
export function createMockDiscipline(
  overrides?: Partial<MockDiscipline>
): MockDiscipline {
  const id = overrides?.id ?? generateCuid();

  return {
    id,
    name: 'Engineering',
    slug: 'engineering',
    description: 'Software engineering and development',
    ...overrides,
  };
}

/**
 * Create a list of common disciplines
 */
export function createMockDisciplineList(): MockDiscipline[] {
  return [
    createMockDiscipline({
      name: 'Engineering',
      slug: 'engineering',
      description: 'Software engineering and development',
    }),
    createMockDiscipline({
      name: 'Product',
      slug: 'product',
      description: 'Product management and strategy',
    }),
    createMockDiscipline({
      name: 'Design',
      slug: 'design',
      description: 'UX/UI design and user research',
    }),
    createMockDiscipline({
      name: 'Marketing',
      slug: 'marketing',
      description: 'Marketing and growth',
    }),
    createMockDiscipline({
      name: 'Operations',
      slug: 'operations',
      description: 'Operations and administration',
    }),
  ];
}

// =============================================================================
// INPUT FACTORIES
// =============================================================================

/**
 * Create a mock CreateVPInput
 */
export function createMockCreateVPInput(
  overrides?: Partial<CreateVPInput>
): CreateVPInput {
  return {
    name: 'New Test Orchestrator',
    discipline: 'Engineering',
    role: 'Orchestrator of Engineering',
    organizationId: generateCuid(),
    email: undefined,
    capabilities: ['testing', 'documentation'],
    daemonEndpoint: undefined,
    status: undefined,
    charter: undefined,
    bio: 'A new Orchestrator for testing',
    avatarUrl: undefined,
    ...overrides,
  };
}

/**
 * Create a mock UpdateVPInput
 */
export function createMockUpdateVPInput(
  overrides?: Partial<UpdateVPInput>
): UpdateVPInput {
  return {
    name: 'Updated OrchestratorName',
    bio: 'Updated description',
    ...overrides,
  };
}

// =============================================================================
// ORGANIZATION FACTORIES
// =============================================================================

export interface MockOrganization {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a mock organization
 */
export function createMockOrganization(
  overrides?: Partial<MockOrganization>
): MockOrganization {
  const id = overrides?.id ?? generateCuid();
  const now = new Date();

  return {
    id,
    name: 'Test Organization',
    slug: 'test-org',
    avatarUrl: null,
    description: 'A test organization',
    settings: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// MOCK PRISMA CLIENT FACTORY
// =============================================================================

export interface MockPrismaClient {
  _mockData: {
    orchestrators: MockOrchestratorWithUser[];
    users: MockUser[];
    organizations: MockOrganization[];
  };
  vP: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Prisma client for testing
 */
export function createMockPrismaClient(): MockPrismaClient {
  const mockOrchestrators: MockOrchestratorWithUser[] = [];
  const mockUsers: MockUser[] = [];
  const mockOrgs: MockOrganization[] = [];

  return {
    // Mock data stores for assertions
    _mockData: {
      orchestrators: mockOrchestrators,
      users: mockUsers,
      organizations: mockOrgs,
    },

    vP: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi
      .fn()
      .mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          // Simple transaction mock that passes through
          const tx = {
            vP: {
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            user: {
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
          };
          return callback(tx);
        }
      ),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const OrchestratorFactories = {
  vp: createMockVP,
  user: createMockUser,
  vpWithUser: createMockOrchestratorWithUser,
  vpList: createMockVPList,
  apiKeyResult: createMockAPIKeyResult,
  serviceAccountConfig: createMockServiceAccountConfig,
  discipline: createMockDiscipline,
  disciplineList: createMockDisciplineList,
  charter: createMockVPCharter,
  personality: createMockPersonality,
  communicationPrefs: createMockCommunicationPreferences,
  operationalConfig: createMockOperationalConfig,
  createInput: createMockCreateVPInput,
  updateInput: createMockUpdateVPInput,
  organization: createMockOrganization,
  prismaClient: createMockPrismaClient,
};

export default OrchestratorFactories;
