/**
 * Test Setup for @genesis/core package
 *
 * Configures:
 * - Environment variables for testing
 * - Global mocks
 * - Test utilities
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock the database module
vi.mock('@neolith/database', () => {
  const mockPrismaClient = {
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
    $transaction: vi.fn().mockImplementation(async callback => {
      return callback({
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
      });
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  return {
    prisma: mockPrismaClient,
    PrismaClient: vi.fn(() => mockPrismaClient),
  };
});

// Global test lifecycle hooks
beforeAll(() => {
  // Global setup before all tests
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});

afterAll(() => {
  // Global cleanup after all tests
  vi.restoreAllMocks();
});
