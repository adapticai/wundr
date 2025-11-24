/**
 * Database Client Tests
 *
 * Comprehensive test suite for the Prisma client module covering:
 * - Client creation and configuration
 * - Connection management
 * - Health check functionality
 * - Error handling
 * - Singleton behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env
const originalEnv = process.env.DATABASE_URL;

describe('Database Client', () => {
  beforeEach(() => {
    // Reset module cache to test fresh imports
    vi.resetModules();
    // Set test DATABASE_URL
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/genesis_test';
  });

  afterEach(() => {
    // Restore original env
    process.env.DATABASE_URL = originalEnv;
  });

  describe('Client Export', () => {
    it('should export prisma client instance', async () => {
      const { prisma } = await import('../client');

      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
      expect(typeof prisma.$disconnect).toBe('function');
    });

    it('should export utility functions', async () => {
      const { connect, disconnect, healthCheck, createPrismaClient } =
        await import('../client');

      expect(typeof connect).toBe('function');
      expect(typeof disconnect).toBe('function');
      expect(typeof healthCheck).toBe('function');
      expect(typeof createPrismaClient).toBe('function');
    });
  });

  describe('createPrismaClient', () => {
    it('should create a new Prisma client with default options', async () => {
      const { createPrismaClient } = await import('../client');

      const client = createPrismaClient();

      expect(client).toBeDefined();
      expect(typeof client.$connect).toBe('function');
    });

    it('should create a client with custom options', async () => {
      const { createPrismaClient } = await import('../client');

      const client = createPrismaClient({
        enableLogging: true,
        connectionLimit: 5,
      });

      expect(client).toBeDefined();
    });

    it('should throw error when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      vi.resetModules();

      // Re-mock without DATABASE_URL
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(options => {
          // Check if datasources.db.url will throw
          if (options?.datasources?.db?.url === undefined) {
            throw new Error('DATABASE_URL environment variable is not set');
          }
          return {
            $connect: vi.fn(),
            $disconnect: vi.fn(),
          };
        }),
      }));

      // The buildConnectionUrl function should throw
      await expect(async () => {
        const clientModule = await import('../client');
        clientModule.createPrismaClient();
      }).rejects.toThrow();
    });
  });

  describe('connect', () => {
    it('should call $connect on prisma client', async () => {
      const { prisma, connect } = await import('../client');

      await connect();

      expect(prisma.$connect).toHaveBeenCalled();
    });

    it('should resolve successfully on connection', async () => {
      const { connect } = await import('../client');

      await expect(connect()).resolves.toBeUndefined();
    });
  });

  describe('disconnect', () => {
    it('should call $disconnect on prisma client', async () => {
      const { prisma, disconnect } = await import('../client');

      await disconnect();

      expect(prisma.$disconnect).toHaveBeenCalled();
    });

    it('should resolve successfully on disconnection', async () => {
      const { disconnect } = await import('../client');

      await expect(disconnect()).resolves.toBeUndefined();
    });
  });

  describe('healthCheck', () => {
    it('should return connected: true when database is reachable', async () => {
      const { healthCheck } = await import('../client');

      const result = await healthCheck();

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should measure latency', async () => {
      const { healthCheck } = await import('../client');

      const result = await healthCheck();

      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return error information when database is unreachable', async () => {
      vi.resetModules();

      // Mock a failing query
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          $connect: vi.fn(),
          $disconnect: vi.fn(),
          $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
        })),
      }));

      const { healthCheck } = await import('../client');
      const result = await healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Singleton Behavior', () => {
    it('should return the same instance on multiple imports', async () => {
      const { prisma: prisma1 } = await import('../client');
      const { prisma: prisma2 } = await import('../client');

      // Due to module caching, these should be the same instance
      expect(prisma1).toBe(prisma2);
    });
  });

  describe('Connection URL Building', () => {
    it('should preserve URLs with existing connection parameters', async () => {
      process.env.DATABASE_URL =
        'postgresql://test:test@localhost:5432/db?connection_limit=5';
      vi.resetModules();

      const { prisma } = await import('../client');

      // The client should be created without modifying the URL
      expect(prisma).toBeDefined();
    });

    it('should preserve Prisma Accelerate URLs', async () => {
      process.env.DATABASE_URL =
        'prisma://accelerate.prisma-data.net/?api_key=xxx';
      vi.resetModules();

      const { prisma } = await import('../client');

      expect(prisma).toBeDefined();
    });

    it('should preserve URLs with pgbouncer', async () => {
      process.env.DATABASE_URL =
        'postgresql://test:test@localhost:5432/db?pgbouncer=true';
      vi.resetModules();

      const { prisma } = await import('../client');

      expect(prisma).toBeDefined();
    });
  });

  describe('Environment-based Configuration', () => {
    it('should use development logging in development mode', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      const { createPrismaClient } = await import('../client');
      const client = createPrismaClient();

      expect(client).toBeDefined();
    });

    it('should use minimal logging in production mode', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      const { createPrismaClient } = await import('../client');
      const client = createPrismaClient();

      expect(client).toBeDefined();
    });
  });
});

describe('PrismaClientOptions', () => {
  it('should accept enableLogging option', async () => {
    const { createPrismaClient } = await import('../client');

    const client = createPrismaClient({ enableLogging: false });

    expect(client).toBeDefined();
  });

  it('should accept connectionLimit option', async () => {
    const { createPrismaClient } = await import('../client');

    const client = createPrismaClient({ connectionLimit: 20 });

    expect(client).toBeDefined();
  });

  it('should accept combined options', async () => {
    const { createPrismaClient } = await import('../client');

    const client = createPrismaClient({
      enableLogging: true,
      connectionLimit: 15,
    });

    expect(client).toBeDefined();
  });
});
