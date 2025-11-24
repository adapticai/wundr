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
// RE-EXPORT DEFAULT
// =============================================================================

export { default as vpResolversDefault } from './vp-resolvers.js';
