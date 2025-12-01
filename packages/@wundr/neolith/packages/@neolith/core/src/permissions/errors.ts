/**
 * @genesis/core - Permission Errors
 *
 * Custom error classes for permission-related failures.
 * Provides structured error types for authentication, authorization,
 * and membership validation failures.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';

import type { PermissionContext } from './permission-checker';
import type { Permission } from './permissions';

// =============================================================================
// Permission Error Codes
// =============================================================================

/**
 * Error codes for permission-related errors.
 * Used to identify specific types of permission failures programmatically.
 */
export const PermissionErrorCodes = {
  /** User lacks the required permission for the operation */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** User is not authenticated (no valid session) */
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  /** User is not a member of the specified organization */
  NOT_ORGANIZATION_MEMBER: 'NOT_ORGANIZATION_MEMBER',
  /** User is not a member of the specified workspace */
  NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  /** User is not a member of the specified channel */
  NOT_CHANNEL_MEMBER: 'NOT_CHANNEL_MEMBER',
  /** User's role is insufficient for the operation */
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  /** The requested resource does not exist */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /** The permission context is missing required fields */
  INVALID_CONTEXT: 'INVALID_CONTEXT',
} as const;

/**
 * Union type of all permission error codes.
 */
export type PermissionErrorCode =
  (typeof PermissionErrorCodes)[keyof typeof PermissionErrorCodes];

/**
 * Scope types for role-based errors.
 * Indicates the level at which the role check failed.
 */
export type RoleScope = 'organization' | 'workspace' | 'channel';

// =============================================================================
// Permission Denied Error
// =============================================================================

/**
 * Error thrown when a user does not have the required permission.
 * Provides detailed context about what permission was missing and where.
 */
export class PermissionDeniedError extends GenesisError {
  /** The permission that was required */
  public readonly permission: Permission;

  /** The context in which the permission was checked */
  public readonly context: PermissionContext;

  /** The user ID that was denied */
  public readonly userId: string;

  constructor(
    userId: string,
    permission: Permission,
    context: PermissionContext,
    message?: string
  ) {
    const defaultMessage = `User '${userId}' does not have permission '${permission}'`;
    const contextMessage = buildContextMessage(context);

    super(
      message ?? `${defaultMessage}${contextMessage}`,
      PermissionErrorCodes.PERMISSION_DENIED,
      403,
      {
        userId,
        permission,
        context,
      }
    );

    this.name = 'PermissionDeniedError';
    this.permission = permission;
    this.context = context;
    this.userId = userId;
  }
}

/**
 * Builds a human-readable context message for permission errors.
 */
function buildContextMessage(context: PermissionContext): string {
  const parts: string[] = [];

  if (context.organizationId) {
    parts.push(`organization: ${context.organizationId}`);
  }
  if (context.workspaceId) {
    parts.push(`workspace: ${context.workspaceId}`);
  }
  if (context.channelId) {
    parts.push(`channel: ${context.channelId}`);
  }
  if (context.resourceId && context.resourceType) {
    parts.push(`${context.resourceType}: ${context.resourceId}`);
  }

  return parts.length > 0 ? ` in ${parts.join(', ')}` : '';
}

// =============================================================================
// Authentication Error
// =============================================================================

/**
 * Error thrown when a user is not authenticated.
 */
export class NotAuthenticatedError extends GenesisError {
  constructor(message?: string) {
    super(
      message ?? 'Authentication required',
      PermissionErrorCodes.NOT_AUTHENTICATED,
      401
    );
    this.name = 'NotAuthenticatedError';
  }
}

// =============================================================================
// Membership Errors
// =============================================================================

/**
 * Error thrown when a user is not a member of an organization.
 */
export class NotOrganizationMemberError extends GenesisError {
  public readonly userId: string;
  public readonly organizationId: string;

  constructor(userId: string, organizationId: string) {
    super(
      `User '${userId}' is not a member of organization '${organizationId}'`,
      PermissionErrorCodes.NOT_ORGANIZATION_MEMBER,
      403,
      { userId, organizationId }
    );
    this.name = 'NotOrganizationMemberError';
    this.userId = userId;
    this.organizationId = organizationId;
  }
}

/**
 * Error thrown when a user is not a member of a workspace.
 */
export class NotWorkspaceMemberError extends GenesisError {
  public readonly userId: string;
  public readonly workspaceId: string;

  constructor(userId: string, workspaceId: string) {
    super(
      `User '${userId}' is not a member of workspace '${workspaceId}'`,
      PermissionErrorCodes.NOT_WORKSPACE_MEMBER,
      403,
      { userId, workspaceId }
    );
    this.name = 'NotWorkspaceMemberError';
    this.userId = userId;
    this.workspaceId = workspaceId;
  }
}

/**
 * Error thrown when a user is not a member of a channel.
 */
export class NotChannelMemberError extends GenesisError {
  public readonly userId: string;
  public readonly channelId: string;

  constructor(userId: string, channelId: string) {
    super(
      `User '${userId}' is not a member of channel '${channelId}'`,
      PermissionErrorCodes.NOT_CHANNEL_MEMBER,
      403,
      { userId, channelId }
    );
    this.name = 'NotChannelMemberError';
    this.userId = userId;
    this.channelId = channelId;
  }
}

// =============================================================================
// Role Errors
// =============================================================================

/**
 * Error thrown when a user does not have a sufficient role level.
 * Indicates that while the user may be a member, their role is too low
 * for the requested operation.
 */
export class InsufficientRoleError extends GenesisError {
  /** The user ID that has insufficient role */
  public readonly userId: string;
  /** The user's current role in the scope */
  public readonly currentRole: string;
  /** The minimum role required for the operation */
  public readonly requiredRole: string;
  /** The scope at which the role was checked */
  public readonly scope: RoleScope;

  /**
   * Creates a new InsufficientRoleError.
   *
   * @param userId - The ID of the user with insufficient role
   * @param currentRole - The user's current role
   * @param requiredRole - The minimum required role
   * @param scope - The scope of the role check (organization, workspace, or channel)
   */
  constructor(
    userId: string,
    currentRole: string,
    requiredRole: string,
    scope: RoleScope
  ) {
    super(
      `User '${userId}' has ${scope} role '${currentRole}', but '${requiredRole}' or higher is required`,
      PermissionErrorCodes.INSUFFICIENT_ROLE,
      403,
      { userId, currentRole, requiredRole, scope }
    );
    this.name = 'InsufficientRoleError';
    this.userId = userId;
    this.currentRole = currentRole;
    this.requiredRole = requiredRole;
    this.scope = scope;
  }
}

// =============================================================================
// Context Errors
// =============================================================================

/**
 * Error thrown when permission context is invalid or incomplete.
 */
export class InvalidPermissionContextError extends GenesisError {
  public readonly missingFields: string[];

  constructor(missingFields: string[], message?: string) {
    super(
      message ??
        `Invalid permission context: missing ${missingFields.join(', ')}`,
      PermissionErrorCodes.INVALID_CONTEXT,
      400,
      { missingFields }
    );
    this.name = 'InvalidPermissionContextError';
    this.missingFields = missingFields;
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a PermissionDeniedError.
 * Use this to safely narrow an unknown error type for specific handling.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error is a PermissionDeniedError instance
 *
 * @example
 * ```typescript
 * try {
 *   await checkPermission(userId, permission, context);
 * } catch (error) {
 *   if (isPermissionDeniedError(error)) {
 *     console.log(`Missing permission: ${error.permission}`);
 *   }
 * }
 * ```
 */
export function isPermissionDeniedError(
  error: unknown
): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}

/**
 * Type guard to check if an error is a NotAuthenticatedError.
 * Use this to safely narrow an unknown error type for specific handling.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error is a NotAuthenticatedError instance
 *
 * @example
 * ```typescript
 * try {
 *   await requireAuth(session);
 * } catch (error) {
 *   if (isNotAuthenticatedError(error)) {
 *     redirect('/login');
 *   }
 * }
 * ```
 */
export function isNotAuthenticatedError(
  error: unknown
): error is NotAuthenticatedError {
  return error instanceof NotAuthenticatedError;
}

/**
 * Type guard to check if an error is any permission-related error.
 * Checks if the error code matches any of the known permission error codes.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error is a GenesisError with a permission-related code
 *
 * @example
 * ```typescript
 * try {
 *   await performSecureOperation();
 * } catch (error) {
 *   if (isPermissionError(error)) {
 *     return new Response('Access denied', { status: error.statusCode });
 *   }
 *   throw error; // Re-throw non-permission errors
 * }
 * ```
 */
export function isPermissionError(error: unknown): error is GenesisError {
  if (!(error instanceof GenesisError)) {
    return false;
  }
  return Object.values(PermissionErrorCodes).includes(
    error.code as PermissionErrorCode
  );
}
