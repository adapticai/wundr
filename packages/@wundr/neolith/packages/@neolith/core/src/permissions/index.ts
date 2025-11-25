/**
 * @genesis/core - Permission System
 *
 * Role-Based Access Control (RBAC) system for Genesis App.
 * Provides fine-grained permission management at organization,
 * workspace, and channel levels.
 *
 * @packageDocumentation
 *
 * @example
 * Basic permission checking:
 * ```typescript
 * import {
 *   Permission,
 *   permissionChecker,
 *   assertPermission,
 * } from '@genesis/core/permissions';
 *
 * // Check if user can edit a workspace
 * const canEdit = await permissionChecker.hasPermission(
 *   userId,
 *   Permission.WORKSPACE_EDIT,
 *   { workspaceId: 'ws_123' }
 * );
 *
 * // Assert permission (throws if denied)
 * await assertPermission(session, Permission.CHANNEL_CREATE, {
 *   workspaceId: 'ws_123',
 * });
 * ```
 *
 * @example
 * Using middleware in API routes:
 * ```typescript
 * import { withAuth, withPermission, Permission } from '@genesis/core/permissions';
 *
 * // Protect an API route
 * export default withAuth(
 *   withPermission(Permission.WORKSPACE_DELETE, (req) => ({
 *     workspaceId: req.params?.workspaceId,
 *   }))(async (req) => {
 *     // Handler code here
 *   })
 * );
 * ```
 *
 * @example
 * Using decorators:
 * ```typescript
 * import { requireAuth, requirePermission, Permission } from '@genesis/core/permissions';
 *
 * class WorkspaceResolver {
 *   @requireAuth()
 *   @requirePermission(Permission.WORKSPACE_CREATE)
 *   async createWorkspace(ctx: Context, input: CreateInput) {
 *     // Only accessible with WORKSPACE_CREATE permission
 *   }
 * }
 * ```
 */

// =============================================================================
// Permission Definitions
// =============================================================================

export {
  Permission,
  PERMISSION_CATEGORIES,
  type PermissionCategory,
  isValidPermission,
  getPermissionResource,
  getPermissionAction,
  getPermissionsForResource,
  ALL_PERMISSIONS,
} from './permissions';

// =============================================================================
// Role Definitions
// =============================================================================

export {
  // Types
  type RoleDefinition,
  type ResolvedRole,

  // Role definitions by scope
  ORGANIZATION_ROLES,
  WORKSPACE_ROLES,
  CHANNEL_ROLES,

  // Permission resolution
  resolveRolePermissions,
  getOrganizationRolePermissions,
  getWorkspaceRolePermissions,
  getChannelRolePermissions,
  roleHasPermission,

  // Role hierarchy
  ORGANIZATION_ROLE_HIERARCHY,
  WORKSPACE_ROLE_HIERARCHY,
  CHANNEL_ROLE_HIERARCHY,
  compareRoles,
  isAtLeastRole,
} from './roles';

// =============================================================================
// Permission Checker
// =============================================================================

export {
  // Main checker class
  PermissionChecker,
  permissionChecker,
  createPermissionChecker,

  // Types
  type PermissionContext,
  type MembershipInfo,
  type PermissionCheckerConfig,

  // Context validation
  validatePermissionContext,
} from './permission-checker';

// =============================================================================
// Permission Errors
// =============================================================================

export {
  // Error codes
  PermissionErrorCodes,
  type PermissionErrorCode,
  type RoleScope,

  // Error classes
  PermissionDeniedError,
  NotAuthenticatedError,
  NotOrganizationMemberError,
  NotWorkspaceMemberError,
  NotChannelMemberError,
  InsufficientRoleError,
  InvalidPermissionContextError,

  // Type guards
  isPermissionDeniedError,
  isNotAuthenticatedError,
  isPermissionError,
} from './errors';

// =============================================================================
// Guards (Decorators and Functions)
// =============================================================================

export {
  // Types
  type AuthenticatedSession,
  type GuardResult,
  PERMISSION_METADATA_KEY,

  // Decorators
  requireAuth,
  requirePermission,
  requireChannelMember,
  requireWorkspaceMember,
  requireOrganizationMember,

  // Functional guards
  assertAuthenticated,
  assertPermission,
  assertOrganizationMember,
  assertWorkspaceMember,
  assertChannelMember,
  checkPermission,
  checkOwnershipOrPermission,

  // Guard composition
  composeGuards,
} from './guards';

// =============================================================================
// Middleware (for Next.js API routes)
// =============================================================================

export {
  // Types
  type RequestBody,
  type RequestContext,
  type AuthenticatedRequestContext,
  type ContextExtractor,
  type ApiHandler,
  type MiddlewareResult,

  // Authentication middleware
  withAuth,

  // Permission middleware
  withPermission,
  withPermissions,
  withAnyPermission,

  // Membership middleware
  withChannelAccess,
  withWorkspaceAccess,
  withOrganizationAccess,

  // Ownership middleware
  withOwnershipOrPermission,

  // Composition
  compose,

  // Error handling
  withPermissionErrorHandler,
} from './middleware';
