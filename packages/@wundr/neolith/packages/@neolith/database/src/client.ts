import { PrismaClient } from '@prisma/client';

/**
 * Prisma client configuration options
 */
interface PrismaClientOptions {
  /** Enable query logging */
  enableLogging?: boolean;
  /** Connection pool size for serverless environments */
  connectionLimit?: number;
}

/**
 * Default configuration for the Prisma client
 */
const DEFAULT_OPTIONS: PrismaClientOptions = {
  enableLogging: process.env.NODE_ENV === 'development',
  connectionLimit: 10,
};

/**
 * Creates a configured Prisma client instance
 * Optimized for serverless environments with connection pooling
 * Returns a lazy client that throws on first actual query if DATABASE_URL is missing
 */
function createPrismaClient(options: PrismaClientOptions = {}): PrismaClient {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const url = buildConnectionUrl(config.connectionLimit);

  // If no DATABASE_URL, create a client without explicit datasource
  // It will use the default from schema.prisma or fail at runtime (not build time)
  const client = new PrismaClient({
    log: config.enableLogging
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
    ...(url && {
      datasources: {
        db: {
          url,
        },
      },
    }),
  });

  return client;
}

/**
 * Builds the database connection URL with connection pooling parameters
 * for serverless environments (Vercel, AWS Lambda, etc.)
 */
function buildConnectionUrl(connectionLimit?: number): string | undefined {
  const baseUrl = process.env.DATABASE_URL;

  // Return undefined during build time when DATABASE_URL is not set
  if (!baseUrl) {
    return undefined;
  }

  // If using Prisma Accelerate or already has pool params, return as-is
  if (
    baseUrl.includes('prisma://') ||
    baseUrl.includes('connection_limit') ||
    baseUrl.includes('pgbouncer')
  ) {
    return baseUrl;
  }

  // Add connection pooling parameters for serverless
  const separator = baseUrl.includes('?') ? '&' : '?';
  const poolParams = [
    `connection_limit=${connectionLimit ?? 10}`,
    'pool_timeout=20',
    'connect_timeout=10',
  ].join('&');

  return `${baseUrl}${separator}${poolParams}`;
}

/**
 * Global Prisma client singleton
 * Uses globalThis to maintain a single instance across hot reloads in development
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance
 * - In production: Creates a new instance
 * - In development: Reuses existing instance to prevent connection pool exhaustion
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect from the database
 * Call this when shutting down the application
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to the database explicitly
 * Useful for pre-warming connections in serverless environments
 */
export async function connect(): Promise<void> {
  await prisma.$connect();
}

/**
 * Health check function to verify database connectivity
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { createPrismaClient, PrismaClientOptions };
