/**
 * Test Factory Functions for Retention Service
 *
 * Provides factory functions to create mock retention-related objects for testing.
 *
 * @module @genesis/core/test-utils/retention-factories
 */

import { vi } from 'vitest';

import type {
  RetentionPolicy,
  RetentionRule,
  RetentionJob,
  RetentionJobStatus as _RetentionJobStatus,
  RetentionResourceType as _RetentionResourceType,
  RetentionAction as _RetentionAction,
  RetentionStats,
  RetentionError,
  LegalHold,
  LegalHoldScope,
  DataExport,
  DataExportScope,
} from '../types/retention';

// =============================================================================
// ID Generators
// =============================================================================

let policyIdCounter = 0;
let ruleIdCounter = 0;
let jobIdCounter = 0;
let holdIdCounter = 0;
let exportIdCounter = 0;

/**
 * Reset all ID counters (call in beforeEach).
 */
export function resetRetentionIdCounters(): void {
  policyIdCounter = 0;
  ruleIdCounter = 0;
  jobIdCounter = 0;
  holdIdCounter = 0;
  exportIdCounter = 0;
}

/**
 * Generate a unique policy ID.
 */
export function generatePolicyId(): string {
  return `policy-${++policyIdCounter}`;
}

/**
 * Generate a unique rule ID.
 */
export function generateRuleId(): string {
  return `rule-${++ruleIdCounter}`;
}

/**
 * Generate a unique job ID.
 */
export function generateJobId(): string {
  return `job-${++jobIdCounter}`;
}

/**
 * Generate a unique hold ID.
 */
export function generateHoldId(): string {
  return `hold-${++holdIdCounter}`;
}

/**
 * Generate a unique export ID.
 */
export function generateExportId(): string {
  return `export-${++exportIdCounter}`;
}

/**
 * Generate a unique workspace ID.
 */
export function generateWorkspaceId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Generate a unique user ID for retention tests.
 * Note: Named differently to avoid conflict with message-factories.
 */
export function generateRetentionUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// =============================================================================
// Retention Rule Factories
// =============================================================================

/**
 * Create a mock retention rule.
 */
export function createMockRetentionRule(
  overrides: Partial<RetentionRule> = {},
): RetentionRule {
  return {
    id: generateRuleId(),
    resourceType: 'message',
    action: 'delete',
    retentionDays: 90,
    priority: 1,
    ...overrides,
  };
}

/**
 * Create multiple mock retention rules.
 */
export function createMockRetentionRules(
  count: number,
  overrides: Partial<RetentionRule> = {},
): RetentionRule[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRetentionRule({
      priority: i + 1,
      ...overrides,
    }),
  );
}

// =============================================================================
// Retention Policy Factories
// =============================================================================

/**
 * Create a mock retention policy.
 */
export function createMockRetentionPolicy(
  overrides: Partial<RetentionPolicy> = {},
): RetentionPolicy {
  const workspaceId = overrides.workspaceId ?? generateWorkspaceId();
  return {
    id: generatePolicyId(),
    workspaceId,
    name: 'Test Retention Policy',
    description: 'Test policy description',
    isDefault: false,
    isEnabled: true,
    rules: [createMockRetentionRule()],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: generateRetentionUserId(),
    ...overrides,
  };
}

/**
 * Create a database-style policy record (with rules as JSON string).
 */
export function createMockPolicyRecord(
  overrides: Partial<RetentionPolicy> = {},
): Record<string, unknown> {
  const policy = createMockRetentionPolicy(overrides);
  return {
    ...policy,
    rules: JSON.stringify(policy.rules),
  };
}

// =============================================================================
// Retention Job Factories
// =============================================================================

/**
 * Create a mock retention job.
 */
export function createMockRetentionJob(
  overrides: Partial<RetentionJob> = {},
): RetentionJob {
  const workspaceId = overrides.workspaceId ?? generateWorkspaceId();
  return {
    id: generateJobId(),
    workspaceId,
    policyId: generatePolicyId(),
    status: 'completed',
    resourceType: 'message',
    action: 'delete',
    itemsProcessed: 100,
    itemsTotal: 100,
    itemsFailed: 0,
    errors: [],
    startedAt: new Date(Date.now() - 60000),
    completedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a database-style job record (with errors as JSON string).
 */
export function createMockJobRecord(
  overrides: Partial<RetentionJob> = {},
): Record<string, unknown> {
  const job = createMockRetentionJob(overrides);
  return {
    ...job,
    errors: JSON.stringify(job.errors),
  };
}

/**
 * Create a mock retention error.
 */
export function createMockRetentionError(
  overrides: Partial<RetentionError> = {},
): RetentionError {
  return {
    resourceId: `resource-${Date.now()}`,
    resourceType: 'message',
    error: 'Test error message',
    timestamp: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Legal Hold Factories
// =============================================================================

/**
 * Create a mock legal hold scope.
 */
export function createMockLegalHoldScope(
  overrides: Partial<LegalHoldScope> = {},
): LegalHoldScope {
  return {
    userIds: [],
    channelIds: [],
    ...overrides,
  };
}

/**
 * Create a mock legal hold.
 */
export function createMockLegalHold(
  overrides: Partial<LegalHold> = {},
): LegalHold {
  const workspaceId = overrides.workspaceId ?? generateWorkspaceId();
  return {
    id: generateHoldId(),
    workspaceId,
    name: 'Test Legal Hold',
    description: 'Test legal hold for investigation',
    isActive: true,
    scope: createMockLegalHoldScope(),
    createdBy: generateRetentionUserId(),
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a database-style legal hold record (with scope as JSON string).
 */
export function createMockLegalHoldRecord(
  overrides: Partial<LegalHold> = {},
): Record<string, unknown> {
  const hold = createMockLegalHold(overrides);
  return {
    ...hold,
    scope: JSON.stringify(hold.scope),
  };
}

// =============================================================================
// Data Export Factories
// =============================================================================

/**
 * Create a mock data export scope.
 */
export function createMockDataExportScope(
  overrides: Partial<DataExportScope> = {},
): DataExportScope {
  return {
    includeMessages: true,
    includeFiles: true,
    includeProfiles: false,
    ...overrides,
  };
}

/**
 * Create a mock data export.
 */
export function createMockDataExport(
  overrides: Partial<DataExport> = {},
): DataExport {
  const workspaceId = overrides.workspaceId ?? generateWorkspaceId();
  return {
    id: generateExportId(),
    workspaceId,
    requestedBy: generateRetentionUserId(),
    type: 'full',
    scope: createMockDataExportScope(),
    status: 'pending',
    format: 'zip',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Create a database-style data export record (with scope as JSON string).
 */
export function createMockDataExportRecord(
  overrides: Partial<DataExport> = {},
): Record<string, unknown> {
  const exportData = createMockDataExport(overrides);
  return {
    ...exportData,
    scope: JSON.stringify(exportData.scope),
  };
}

// =============================================================================
// Statistics Factories
// =============================================================================

/**
 * Create mock retention statistics.
 */
export function createMockRetentionStats(
  overrides: Partial<RetentionStats> = {},
): RetentionStats {
  const workspaceId = overrides.workspaceId ?? generateWorkspaceId();
  return {
    workspaceId,
    totalStorageBytes: 1000000,
    storageByType: {
      message: 500000,
      file: 500000,
      channel: 0,
      thread: 0,
      reaction: 0,
      call_recording: 0,
      audit_log: 0,
      vp_conversation: 0,
    },
    itemCounts: {
      message: 1000,
      file: 500,
      channel: 50,
      thread: 0,
      reaction: 0,
      call_recording: 0,
      audit_log: 0,
      vp_conversation: 0,
    },
    oldestItem: {
      message: null,
      file: null,
      channel: null,
      thread: null,
      reaction: null,
      call_recording: null,
      audit_log: null,
      vp_conversation: null,
    },
    pendingDeletions: 0,
    ...overrides,
  };
}

// =============================================================================
// Mock Prisma Models
// =============================================================================

/**
 * Create a mock Prisma retention policy model.
 */
export function createMockPrismaRetentionPolicyModel() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create a mock Prisma retention job model.
 */
export function createMockPrismaRetentionJobModel() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create a mock Prisma legal hold model.
 */
export function createMockPrismaLegalHoldModel() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create a mock Prisma data export model.
 */
export function createMockPrismaDataExportModel() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create a complete mock Prisma client for retention testing.
 */
export function createMockPrisma() {
  return {
    retentionPolicy: createMockPrismaRetentionPolicyModel(),
    retentionJob: createMockPrismaRetentionJobModel(),
    legalHold: createMockPrismaLegalHoldModel(),
    dataExport: createMockPrismaDataExportModel(),
    message: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    channel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        retentionPolicy: createMockPrismaRetentionPolicyModel(),
        retentionJob: createMockPrismaRetentionJobModel(),
        message: { update: vi.fn(), delete: vi.fn() },
      });
    }),
  };
}

/**
 * Create a mock Redis client for retention testing.
 * Note: Named differently to avoid conflict with mock-redis.ts
 */
export function createRetentionMockRedis() {
  return {
    lpush: vi.fn().mockResolvedValue(1),
    rpop: vi.fn().mockResolvedValue(null),
    llen: vi.fn().mockResolvedValue(0),
  };
}

// =============================================================================
// Export All Factories
// =============================================================================

export const RetentionFactories = {
  // ID generators
  resetRetentionIdCounters,
  generatePolicyId,
  generateRuleId,
  generateJobId,
  generateHoldId,
  generateExportId,
  generateWorkspaceId,
  generateRetentionUserId,

  // Rule factories
  createMockRetentionRule,
  createMockRetentionRules,

  // Policy factories
  createMockRetentionPolicy,
  createMockPolicyRecord,

  // Job factories
  createMockRetentionJob,
  createMockJobRecord,
  createMockRetentionError,

  // Legal hold factories
  createMockLegalHoldScope,
  createMockLegalHold,
  createMockLegalHoldRecord,

  // Export factories
  createMockDataExportScope,
  createMockDataExport,
  createMockDataExportRecord,

  // Stats factories
  createMockRetentionStats,

  // Prisma mocks
  createMockPrisma,
  createRetentionMockRedis,
};
