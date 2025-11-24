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

// Export all generated types from the schema
export * from './generated/types.js';

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
// VP TYPES
// =============================================================================

// Export VP-specific type definitions
export * from './types/vp.js';

// Export VP GraphQL input types
export * from './types/vp-inputs.js';

// =============================================================================
// RESOLVERS
// =============================================================================

// Export GraphQL resolvers for server-side use
export * from './resolvers/index.js';
