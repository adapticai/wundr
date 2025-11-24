/**
 * @genesis/core - Permission Errors
 *
 * Custom error classes for permission-related failures.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';
import type { Permission } from './permissions';
import type { PermissionContext } from './permission-checker';

// =============================================================================
// Permission Error Codes
// =============================================================================

/**
 * Error codes for permission-related errors.
 */
export const PermissionErrorCodes = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_ORGANIZATION_MEMBER: 'NOT_ORGANIZATION_MEMBER',
  NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  NOT_CHANNEL_MEMBER: 'NOT_CHANNEL_MEMBER',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INVALID_CONTEXT: 'INVALID_CONTEXT',
} as const;

export type PermissionErrorCode =
  (typeof PermissionErrorCodes)[keyof typeof PermissionErrorCodes];

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
 */
export class InsufficientRoleError extends GenesisError {
  public readonly userId: string;
  public readonly currentRole: string;
  public readonly requiredRole: string;
  public readonly scope: 'organization' | 'workspace' | 'channel';

  constructor(
    userId: string,
    currentRole: string,
    requiredRole: string,
    scope: 'organization' | 'workspace' | 'channel'
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
      message ?? `Invalid permission context: missing ${missingFields.join(', ')}`,
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
 */
export function isPermissionDeniedError(
  error: unknown
): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}

/**
 * Type guard to check if an error is a NotAuthenticatedError.
 */
export function isNotAuthenticatedError(
  error: unknown
): error is NotAuthenticatedError {
  return error instanceof NotAuthenticatedError;
}

/**
 * Type guard to check if an error is any permission-related error.
 */
export function isPermissionError(error: unknown): error is GenesisError {
  if (!(error instanceof GenesisError)) {
    return false;
  }
  return Object.values(PermissionErrorCodes).includes(
    error.code as PermissionErrorCode
  );
}
