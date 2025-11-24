/**
 * @genesis/database
 *
 * Prisma database client and types for Genesis App
 * Provides a singleton client optimized for serverless environments
 */

import type { PrismaClient as PrismaClientType, Prisma } from '@prisma/client';

// =============================================================================
// Client Exports
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
// Currently active models:
export type { User } from '@prisma/client';

// Future models (uncomment after adding to schema.prisma and running prisma generate):
// export type {
//   Organization,
//   Workspace,
//   VP,
//   Channel,
//   Message,
//   File,
//   WorkspaceMember,
//   OrganizationMember,
//   ChannelMember,
//   Reaction,
//   Session,
//   Discipline,
//   Agent,
// } from '@prisma/client';

// =============================================================================
// Enum Exports
// =============================================================================

// Export all enums
// Currently active enums:
export { UserRole } from '@prisma/client';

// Future enums (uncomment after adding to schema.prisma and running prisma generate):
// export {
//   UserStatus,
//   WorkspaceVisibility,
//   ChannelType,
//   MessageType,
//   FileStatus,
//   WorkspaceMemberRole,
//   OrganizationMemberRole,
//   ChannelMemberRole,
//   VPStatus,
//   OrganisationRole,
// } from '@prisma/client';

// =============================================================================
// Input Types for Creating Entities
// =============================================================================

// Currently active create input types:
export type CreateUserInput = Prisma.UserCreateInput;
export type CreateUserManyInput = Prisma.UserCreateManyInput;

// Future create input types (uncomment after adding models):
// export type CreateOrganizationInput = Prisma.OrganizationCreateInput;
// export type CreateWorkspaceInput = Prisma.WorkspaceCreateInput;
// export type CreateVPInput = Prisma.VPCreateInput;
// export type CreateChannelInput = Prisma.ChannelCreateInput;
// export type CreateMessageInput = Prisma.MessageCreateInput;
// export type CreateFileInput = Prisma.FileCreateInput;
// export type CreateWorkspaceMemberInput = Prisma.WorkspaceMemberCreateInput;
// export type CreateOrganizationMemberInput = Prisma.OrganizationMemberCreateInput;
// export type CreateChannelMemberInput = Prisma.ChannelMemberCreateInput;
// export type CreateReactionInput = Prisma.ReactionCreateInput;
// export type CreateSessionInput = Prisma.SessionCreateInput;
// export type CreateDisciplineInput = Prisma.DisciplineCreateInput;
// export type CreateAgentInput = Prisma.AgentCreateInput;

// =============================================================================
// Update Types
// =============================================================================

// Currently active update types:
export type UpdateUserInput = Prisma.UserUpdateInput;
export type UpdateUserManyInput = Prisma.UserUpdateManyMutationInput;

// Future update types (uncomment after adding models):
// export type UpdateOrganizationInput = Prisma.OrganizationUpdateInput;
// export type UpdateWorkspaceInput = Prisma.WorkspaceUpdateInput;
// export type UpdateVPInput = Prisma.VPUpdateInput;
// export type UpdateChannelInput = Prisma.ChannelUpdateInput;
// export type UpdateMessageInput = Prisma.MessageUpdateInput;
// export type UpdateFileInput = Prisma.FileUpdateInput;
// export type UpdateWorkspaceMemberInput = Prisma.WorkspaceMemberUpdateInput;
// export type UpdateOrganizationMemberInput = Prisma.OrganizationMemberUpdateInput;
// export type UpdateChannelMemberInput = Prisma.ChannelMemberUpdateInput;
// export type UpdateReactionInput = Prisma.ReactionUpdateInput;
// export type UpdateSessionInput = Prisma.SessionUpdateInput;
// export type UpdateDisciplineInput = Prisma.DisciplineUpdateInput;
// export type UpdateAgentInput = Prisma.AgentUpdateInput;

// =============================================================================
// Where Types (for filtering)
// =============================================================================

// Currently active where types:
export type UserWhereInput = Prisma.UserWhereInput;
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput;

// Future where types (uncomment after adding models):
// export type OrganizationWhereInput = Prisma.OrganizationWhereInput;
// export type WorkspaceWhereInput = Prisma.WorkspaceWhereInput;
// export type VPWhereInput = Prisma.VPWhereInput;
// export type ChannelWhereInput = Prisma.ChannelWhereInput;
// export type MessageWhereInput = Prisma.MessageWhereInput;
// export type FileWhereInput = Prisma.FileWhereInput;

// =============================================================================
// Include Types for Relations
// =============================================================================

// User with relations - currently no relations defined
// export type UserWithOrganizations = Prisma.UserGetPayload<{
//   include: { organizationMemberships: { include: { organization: true } } };
// }>;

// Future relation types (uncomment after adding models):
// export type UserWithWorkspaces = Prisma.UserGetPayload<{
//   include: { workspaceMemberships: { include: { workspace: true } } };
// }>;

// export type OrganizationWithMembers = Prisma.OrganizationGetPayload<{
//   include: { members: { include: { user: true } } };
// }>;

// export type WorkspaceWithChannels = Prisma.WorkspaceGetPayload<{
//   include: { channels: true };
// }>;

// export type ChannelWithMessages = Prisma.ChannelGetPayload<{
//   include: { messages: { include: { author: true; reactions: true } } };
// }>;

// export type MessageWithAuthor = Prisma.MessageGetPayload<{
//   include: { author: true; reactions: true };
// }>;

// export type VPWithAgents = Prisma.VPGetPayload<{
//   include: { agents: true };
// }>;

// export type DisciplineWithVPs = Prisma.DisciplineGetPayload<{
//   include: { vps: { include: { agents: true } } };
// }>;

// =============================================================================
// Select Types (for partial selections)
// =============================================================================

export type UserSelect = Prisma.UserSelect;

// Future select types (uncomment after adding models):
// export type OrganizationSelect = Prisma.OrganizationSelect;
// export type WorkspaceSelect = Prisma.WorkspaceSelect;
// export type VPSelect = Prisma.VPSelect;
// export type ChannelSelect = Prisma.ChannelSelect;
// export type MessageSelect = Prisma.MessageSelect;

// =============================================================================
// OrderBy Types
// =============================================================================

export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;

// Future orderBy types (uncomment after adding models):
// export type OrganizationOrderByInput = Prisma.OrganizationOrderByWithRelationInput;
// export type WorkspaceOrderByInput = Prisma.WorkspaceOrderByWithRelationInput;
// export type MessageOrderByInput = Prisma.MessageOrderByWithRelationInput;

// =============================================================================
// Utility Types
// =============================================================================

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
// Migration Service Exports
// =============================================================================

// Export migration service utilities
export {
  runMigrations,
  resetDatabase,
  seedDatabase,
  getMigrationStatus,
  pushSchema,
  generateClient,
  validateSchema,
  formatSchema,
  createMigration,
  hasPendingSchemaChanges,
  MigrationError,
  type MigrationStatus,
} from './migration';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum pagination limit
 */
export const MAX_PAGE_SIZE = 100;
