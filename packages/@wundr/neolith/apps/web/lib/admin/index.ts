/**
 * Admin utilities barrel export
 * @module lib/admin
 */

// Client-side utilities
export * from './permissions';
export * from './audit';

// Server-side utilities (for API routes)
export * from './audit-logger';
// Export authorization functions
// Note: hasPermission is already exported from permissions.ts
export {
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
  canModifyMember,
  validateSelfModification,
  AuthorizationError,
} from './authorization';
