/**
 * @genesis/database/edge
 *
 * Edge Runtime compatible exports for Genesis Database
 * This module excludes migration utilities that use Node.js child_process
 */

import type { PrismaClient as PrismaClientType, Prisma } from '@prisma/client';

// =============================================================================
// Client Exports (Edge Compatible)
// =============================================================================

// Export the singleton client and utilities
export {
  prisma,
  connect,
  disconnect,
  healthCheck,
  createPrismaClient,
  type PrismaClientOptions,
} from './client';

// Re-export Prisma types and namespace
export { PrismaClient, Prisma } from '@prisma/client';

// =============================================================================
// Model Type Exports
// =============================================================================

// Export all Prisma generated model types
export type {
  User,
  Organization,
  Workspace,
  VP,
  Channel,
  Message,
  File,
  WorkspaceMember,
  OrganizationMember,
  ChannelMember,
  Reaction,
  Session,
  MessageAttachment,
} from '@prisma/client';

// =============================================================================
// Enum Exports
// =============================================================================

// Export all enums
export {
  UserStatus,
  VPStatus,
  WorkspaceVisibility,
  ChannelType,
  MessageType,
  FileStatus,
  OrganizationRole,
  WorkspaceRole,
  ChannelRole,
} from '@prisma/client';

// =============================================================================
// Input Types for Creating Entities
// =============================================================================

export type CreateUserInput = Prisma.UserCreateInput;
export type CreateUserManyInput = Prisma.UserCreateManyInput;

// =============================================================================
// Update Types
// =============================================================================

export type UpdateUserInput = Prisma.UserUpdateInput;
export type UpdateUserManyInput = Prisma.UserUpdateManyMutationInput;

// =============================================================================
// Where Types (for filtering)
// =============================================================================

export type UserWhereInput = Prisma.UserWhereInput;
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput;

// =============================================================================
// Select Types (for partial selections)
// =============================================================================

export type UserSelect = Prisma.UserSelect;

// =============================================================================
// OrderBy Types
// =============================================================================

export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Database transaction helper type
 */
export type TransactionClient = Parameters<
  Parameters<PrismaClientType['$transaction']>[0]
>[0];

/**
 * Utility type to extract model types from Prisma
 */
export type ModelName = Exclude<keyof PrismaClientType, `$${string}` | symbol>;

/**
 * Type for Prisma batch operations result
 */
export type BatchPayload = Prisma.BatchPayload;

/**
 * Type for Prisma JSON fields
 */
export type JsonValue = Prisma.JsonValue;
export type JsonObject = Prisma.JsonObject;
export type JsonArray = Prisma.JsonArray;
export type InputJsonValue = Prisma.InputJsonValue;

/**
 * Type for pagination input
 */
export interface PaginationInput {
  skip?: number;
  take?: number;
  cursor?: { id: string };
}

/**
 * Type for paginated results
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
