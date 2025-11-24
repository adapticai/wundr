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
// RE-EXPORT DEFAULTS
// =============================================================================

export { default as vpResolversDefault } from './vp-resolvers.js';
export { default as messageResolversDefault } from './message-resolvers.js';
