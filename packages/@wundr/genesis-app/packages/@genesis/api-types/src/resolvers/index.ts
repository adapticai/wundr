/**
 * GraphQL Resolvers Index
 *
 * Exports all resolver modules for the Genesis API.
 * These resolvers can be used with @graphql-tools/schema or Apollo Server.
 *
 * @module @genesis/api-types/resolvers
 */

// =============================================================================
// VP RESOLVERS
// =============================================================================

export {
  vpResolvers,
  vpQueries,
  vpMutations,
  vpSubscriptions,
  VPFieldResolvers,
  VP_STATUS_CHANGED,
  VPStatus,
  type VPStatusType,
  type GraphQLContext,
  type VPService,
} from './vp-resolvers.js';

// =============================================================================
// MESSAGE RESOLVERS
// =============================================================================

export {
  messageResolvers,
  messageQueries,
  messageMutations,
  messageSubscriptions,
  MessageFieldResolvers,
  MESSAGE_CREATED,
  MESSAGE_UPDATED,
  MESSAGE_DELETED,
  REACTION_CHANGED,
  THREAD_UPDATED,
  MessageType,
  type MessageTypeValue,
  type MessageService,
} from './message-resolvers.js';

// =============================================================================
// ORGANIZATION RESOLVERS
// =============================================================================

export {
  organizationResolvers,
  organizationQueries,
  organizationMutations,
  OrganizationFieldResolvers,
  OrganizationRole,
  type OrganizationRoleType,
} from './organization-resolvers.js';

// =============================================================================
// WORKSPACE RESOLVERS
// =============================================================================

export {
  workspaceResolvers,
  workspaceQueries,
  workspaceMutations,
  WorkspaceFieldResolvers,
  WorkspaceRole,
  WorkspaceVisibility,
  type WorkspaceRoleType,
  type WorkspaceVisibilityType,
} from './workspace-resolvers.js';

// =============================================================================
// CHANNEL RESOLVERS
// =============================================================================

export {
  channelResolvers,
  channelQueries,
  channelMutations,
  channelSubscriptions,
  ChannelFieldResolvers,
  ChannelType,
  ChannelRole,
  CHANNEL_CREATED,
  CHANNEL_UPDATED,
  CHANNEL_DELETED,
  MEMBER_JOINED,
  MEMBER_LEFT,
  type ChannelTypeValue,
  type ChannelRoleType,
} from './channel-resolvers.js';

// =============================================================================
// DISCIPLINE RESOLVERS
// =============================================================================

export {
  disciplineResolvers,
  disciplineQueries,
  disciplineMutations,
  DisciplineFieldResolvers,
} from './discipline-resolvers.js';

// =============================================================================
// RE-EXPORT DEFAULTS
// =============================================================================

export { default as vpResolversDefault } from './vp-resolvers.js';
export { default as messageResolversDefault } from './message-resolvers.js';
export { default as organizationResolversDefault } from './organization-resolvers.js';
export { default as workspaceResolversDefault } from './workspace-resolvers.js';
export { default as channelResolversDefault } from './channel-resolvers.js';
export { default as disciplineResolversDefault } from './discipline-resolvers.js';
