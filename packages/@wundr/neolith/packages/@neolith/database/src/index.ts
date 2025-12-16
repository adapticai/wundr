/**
 * @genesis/database
 *
 * Prisma database client and types for Genesis App
 * Provides a singleton client optimized for serverless environments
 */

import type { Prisma, PrismaClient as PrismaClientType } from '@prisma/client';

// =============================================================================
// Client Exports
// =============================================================================

// Re-export Prisma types and namespace
export { Prisma, PrismaClient } from '@prisma/client';
// Export the singleton client and utilities
export {
  connect,
  createPrismaClient,
  disconnect,
  healthCheck,
  type PrismaClientOptions,
  prisma,
} from './client';

// =============================================================================
// Model Type Exports
// =============================================================================

// Export all Prisma generated model types
// Note: Prisma generates lowercase model types based on schema model names
export type {
  backlog as Backlog,
  backlogItem as BacklogItem,
  channel as Channel,
  channelMember as ChannelMember,
  file as File,
  message as Message,
  messageAttachment as MessageAttachment,
  organization as Organization,
  organizationMember as OrganizationMember,
  reaction as Reaction,
  session as Session,
  task as Task,
  user as User,
  orchestrator as Orchestrator,
  workspace as Workspace,
  workspaceMember as WorkspaceMember,
  workflow as Workflow,
  workflowExecution as WorkflowExecution,
  savedItem as SavedItem,
} from '@prisma/client';

// =============================================================================
// Enum Exports
// =============================================================================

// Export all enums
export {
  ChannelRole,
  ChannelType,
  FileStatus,
  MessageType,
  NotificationPriority,
  NotificationType,
  OrganizationRole,
  SavedItemStatus,
  SavedItemType,
  TaskPriority,
  TaskStatus,
  UserStatus,
  OrchestratorStatus,
  WorkflowStatus,
  WorkflowExecutionStatus,
  WorkspaceRole,
  WorkspaceVisibility,
} from '@prisma/client';

// =============================================================================
// Input Types for Creating Entities
// =============================================================================

// Currently active create input types:
export type CreateUserInput = Prisma.userCreateInput;
export type CreateUserManyInput = Prisma.userCreateManyInput;
export type CreateTaskInput = Prisma.taskCreateInput;
export type CreateTaskManyInput = Prisma.taskCreateManyInput;
export type CreateBacklogInput = Prisma.backlogCreateInput;
export type CreateBacklogManyInput = Prisma.backlogCreateManyInput;
export type CreateBacklogItemInput = Prisma.backlogItemCreateInput;
export type CreateBacklogItemManyInput = Prisma.backlogItemCreateManyInput;

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
export type UpdateUserInput = Prisma.userUpdateInput;
export type UpdateUserManyInput = Prisma.userUpdateManyMutationInput;
export type UpdateTaskInput = Prisma.taskUpdateInput;
export type UpdateTaskManyInput = Prisma.taskUpdateManyMutationInput;
export type UpdateBacklogInput = Prisma.backlogUpdateInput;
export type UpdateBacklogManyInput = Prisma.backlogUpdateManyMutationInput;
export type UpdateBacklogItemInput = Prisma.backlogItemUpdateInput;
export type UpdateBacklogItemManyInput =
  Prisma.backlogItemUpdateManyMutationInput;

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
export type UserWhereInput = Prisma.userWhereInput;
export type UserWhereUniqueInput = Prisma.userWhereUniqueInput;
export type TaskWhereInput = Prisma.taskWhereInput;
export type TaskWhereUniqueInput = Prisma.taskWhereUniqueInput;
export type BacklogWhereInput = Prisma.backlogWhereInput;
export type BacklogWhereUniqueInput = Prisma.backlogWhereUniqueInput;
export type BacklogItemWhereInput = Prisma.backlogItemWhereInput;
export type BacklogItemWhereUniqueInput = Prisma.backlogItemWhereUniqueInput;
export type FileWhereInput = Prisma.fileWhereInput;
export type FileWhereUniqueInput = Prisma.fileWhereUniqueInput;
export type MessageWhereInput = Prisma.messageWhereInput;
export type MessageWhereUniqueInput = Prisma.messageWhereUniqueInput;

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
//   include: { orchestrators: { include: { agents: true } } };
// }>;

// =============================================================================
// Select Types (for partial selections)
// =============================================================================

export type UserSelect = Prisma.userSelect;

// Future select types (uncomment after adding models):
// export type OrganizationSelect = Prisma.OrganizationSelect;
// export type WorkspaceSelect = Prisma.WorkspaceSelect;
// export type VPSelect = Prisma.VPSelect;
// export type ChannelSelect = Prisma.ChannelSelect;
// export type MessageSelect = Prisma.MessageSelect;

// =============================================================================
// OrderBy Types
// =============================================================================

export type UserOrderByInput = Prisma.userOrderByWithRelationInput;
export type TaskOrderByInput = Prisma.taskOrderByWithRelationInput;
export type BacklogOrderByInput = Prisma.backlogOrderByWithRelationInput;
export type BacklogItemOrderByInput =
  Prisma.backlogItemOrderByWithRelationInput;

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
  createMigration,
  formatSchema,
  generateClient,
  getMigrationStatus,
  hasPendingSchemaChanges,
  MigrationError,
  type MigrationStatus,
  pushSchema,
  resetDatabase,
  runMigrations,
  seedDatabase,
  validateSchema,
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
