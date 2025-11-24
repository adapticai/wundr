/**
 * @genesis/database
 *
 * Prisma database client and types for Genesis App
 * Provides a singleton client optimized for serverless environments
 */

import type { PrismaClient as PrismaClientType } from '@prisma/client';

// Export the singleton client and utilities
export {
  prisma,
  connect,
  disconnect,
  healthCheck,
  createPrismaClient,
  type PrismaClientOptions,
} from './client';

// Re-export Prisma types and enums
// These will be available after running `prisma generate`
export { PrismaClient, Prisma } from '@prisma/client';

// Re-export all generated model types
// Uncomment these exports after defining models in schema.prisma and running prisma generate:
// export type { User, Organisation, Agent, Discipline, VP } from "@prisma/client";

/**
 * Database transaction helper type
 * Use this for typing transaction callbacks
 */
export type TransactionClient = Parameters<
  Parameters<PrismaClientType['$transaction']>[0]
>[0];

/**
 * Utility type to extract model types from Prisma
 */
export type ModelName = Exclude<keyof PrismaClientType, `$${string}` | symbol>;
