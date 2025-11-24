/**
 * @genesis/api-types
 *
 * Shared GraphQL types and TypeScript definitions for the Genesis application.
 *
 * This package provides:
 * - Generated TypeScript types from GraphQL schema
 * - Generated React Apollo hooks for GraphQL operations
 * - Manual utility types and type guards
 *
 * @example
 * ```typescript
 * import {
 *   User,
 *   Workspace,
 *   UserRole,
 *   useGetUserQuery,
 *   ApiResponse,
 *   isDefined
 * } from '@genesis/api-types';
 * ```
 */

// =============================================================================
// GENERATED TYPES (from GraphQL schema)
// =============================================================================

// Export generated types, excluding ones that are redefined elsewhere
// to avoid duplicate export errors (WorkspaceVisibility, DateTime, JSON, UUID, InputMaybe)
export {
  // Utility types
  type Maybe,
  type Exact,
  type MakeOptional,
  type MakeMaybe,
  type MakeEmpty,
  type Incremental,
  // Scalar types (BigInt only - others defined below)
  type BigInt,
  // Core entity types
  type User,
  type Workspace,
  type WorkspaceSettings,
  type WorkspaceMember,
  type PageInfo,
  type Error,
  type HealthStatus,
  type ServiceHealth,
  // Enum types (excluding WorkspaceVisibility which is defined below)
  UserRole,
  type UserRole,
  UserStatus,
  type UserStatus,
  WorkspaceMemberRole,
  type WorkspaceMemberRole,
  ServiceStatus,
  type ServiceStatus,
  WorkspaceMembershipEventType,
  type WorkspaceMembershipEventType,
  // Input types
  type UserFilterInput,
  type CreateUserInput,
  type UpdateUserInput,
  type WorkspaceFilterInput,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type WorkspaceSettingsInput,
  type AddWorkspaceMemberInput,
  // Connection types
  type UserConnection,
  type UserEdge,
  type WorkspaceConnection,
  type WorkspaceEdge,
  type WorkspaceMemberConnection,
  type WorkspaceMemberEdge,
  // Payload types
  type CreateUserPayload,
  type UpdateUserPayload,
  type DeleteUserPayload,
  type CreateWorkspacePayload,
  type UpdateWorkspacePayload,
  type DeleteWorkspacePayload,
  type AddWorkspaceMemberPayload,
  type RemoveWorkspaceMemberPayload,
  type WorkspaceMembershipEvent,
  // Query/Mutation/Subscription types
  type Query,
  type QueryUserArgs,
  type QueryUsersArgs,
  type QueryWorkspaceArgs,
  type QueryWorkspacesArgs,
  type Mutation,
  type MutationCreateUserArgs,
  type MutationUpdateUserArgs,
  type MutationDeleteUserArgs,
  type MutationCreateWorkspaceArgs,
  type MutationUpdateWorkspaceArgs,
  type MutationDeleteWorkspaceArgs,
  type MutationAddWorkspaceMemberArgs,
  type MutationRemoveWorkspaceMemberArgs,
  type Subscription,
  type SubscriptionUserUpdatedArgs,
  type SubscriptionWorkspaceUpdatedArgs,
  type SubscriptionWorkspaceMembershipChangedArgs,
} from './generated/types.js';

// Export operation types (queries, mutations, subscriptions)
export * from './generated/operations.js';

// Export React Apollo hooks
export * from './generated/hooks.js';

// =============================================================================
// MANUAL TYPES
// =============================================================================

// Export all manual TypeScript types and utilities
export * from './manual-types.js';

// =============================================================================
// SCALAR TYPES (canonical definitions)
// =============================================================================

// Define canonical scalar types to avoid conflicts
export type DateTime = string;
export type JSON = Record<string, unknown>;
export type UUID = string;
export type InputMaybe<T> = T | null | undefined;

// =============================================================================
// VP TYPES
// =============================================================================

// Export VP-specific type definitions (canonical source for VPStatus, VPPresenceStatus)
export * from './types/vp.js';

// Export VP GraphQL input types
export * from './types/vp-inputs.js';

// =============================================================================
// MESSAGE TYPES
// =============================================================================

// Export message-specific type definitions
export * from './types/message.js';

// =============================================================================
// CALL TYPES
// =============================================================================

// Export call-specific type definitions (voice/video calls, huddles)
export * from './types/call.js';

// =============================================================================
// RESOLVERS
// =============================================================================

// Export GraphQL resolvers for server-side use
export * from './resolvers/index.js';

// =============================================================================
// WORKSPACE VISIBILITY (canonical definition)
// =============================================================================

// Export canonical WorkspaceVisibility to avoid conflicts with generated types
export const WorkspaceVisibility = {
  Public: 'PUBLIC',
  Private: 'PRIVATE',
  Restricted: 'RESTRICTED',
} as const;

export type WorkspaceVisibility = (typeof WorkspaceVisibility)[keyof typeof WorkspaceVisibility];
