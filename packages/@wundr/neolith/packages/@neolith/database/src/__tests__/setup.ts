/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test setup file for @genesis/database package.
 *
 * Configures:
 * - Environment variables for testing
 * - Prisma client mocks
 * - Database test utilities
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://test:test@localhost:5432/genesis_test?schema=test';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockPrismaClient = vi.fn().mockImplementation(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn().mockImplementation(async callback => {
      if (typeof callback === 'function') {
        return callback({});
      }
      return Promise.all(callback);
    }),

    // Mock models (add more as needed based on your schema)
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(args =>
          Promise.resolve({ id: 'test-id', ...args.data })
        ),
      update: vi
        .fn()
        .mockImplementation(args =>
          Promise.resolve({ id: args.where.id, ...args.data })
        ),
      delete: vi.fn().mockResolvedValue({ id: 'test-id' }),
      count: vi.fn().mockResolvedValue(0),
    },
    organization: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(args =>
          Promise.resolve({ id: 'test-id', ...args.data })
        ),
      update: vi
        .fn()
        .mockImplementation(args =>
          Promise.resolve({ id: args.where.id, ...args.data })
        ),
      delete: vi.fn().mockResolvedValue({ id: 'test-id' }),
      count: vi.fn().mockResolvedValue(0),
    },
  }));

  return {
    PrismaClient: mockPrismaClient,
  };
});

// Global test lifecycle hooks
beforeAll(() => {
  // Any global setup before all tests
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});

afterAll(() => {
  // Any global cleanup after all tests
  vi.restoreAllMocks();
});

// Export mock utilities for tests using dynamic import
export const createMockPrismaClient = async () => {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
};
