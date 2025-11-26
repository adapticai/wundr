/**
 * @genesis/core - Permission Guards
 *
 * Decorators and functional guards for protecting API routes and resolvers.
 * Provides both decorator-style and functional approaches to permission checking.
 *
 * @packageDocumentation
 */

import {
  NotAuthenticatedError,
  PermissionDeniedError,
} from './errors';
import {
  permissionChecker,
  createPermissionChecker,
  validatePermissionContext,
} from './permission-checker';

import type { PermissionContext, MembershipInfo } from './permission-checker';
import type { Permission } from './permissions';
import type { Session } from '@neolith/database';


// =============================================================================
// Types
// =============================================================================

/**
 * Extended session type with user ID.
 * Represents a session that has been verified to have an authenticated user.
 */
export interface AuthenticatedSession extends Session {
  /** The unique identifier of the authenticated user */
  userId: string;
}

/**
 * Metadata key for storing permission requirements on decorated methods.
 * Used by decorators to attach permission metadata for runtime checking.
 */
export const PERMISSION_METADATA_KEY = Symbol('permissions');

/**
 * Guard result indicating whether access is granted.
 * Contains the authorization decision and optional reason for denial.
 */
export interface GuardResult {
  /** Whether access is granted */
  granted: boolean;
  /** Optional reason for denial (only present when granted is false) */
  reason?: string;
}

/**
 * Generic method decorator type for permission decorators.
 * Used to define decorators that wrap methods with permission checks.
 *
 * @typeParam T - The type of the method being decorated
 */
type MethodDecorator = <T>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

/**
 * Type for decorator method arguments.
 * Represents the arguments passed to a decorated method.
 */
type DecoratorMethodArgs = unknown[];

// =============================================================================
// Decorator Guards
// =============================================================================

/**
 * Decorator that requires authentication.
 * Throws NotAuthenticatedError if no valid session exists.
 *
 * @returns Method decorator that enforces authentication
 *
 * @example
 * ```typescript
 * class UserResolver {
 *   @requireAuth()
 *   async getProfile(ctx: Context) {
 *     // Only accessible to authenticated users
 *   }
 * }
 * ```
 */
export function requireAuth(): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return;
    }

    descriptor.value = async function (this: unknown, ...args: DecoratorMethodArgs) {
      const context = extractContext(args);
      const session = context?.session;

      if (!session?.userId) {
        throw new NotAuthenticatedError();
      }

      return (originalMethod as (...args: DecoratorMethodArgs) => unknown).apply(this, args);
    } as T;

    return descriptor;
  };
}

/**
 * Decorator that requires a specific permission.
 * Must be used with requireAuth() and a valid permission context.
 *
 * @param permission - The permission to require for method access
 * @returns Method decorator that enforces the specified permission
 *
 * @example
 * ```typescript
 * class WorkspaceResolver {
 *   @requireAuth()
 *   @requirePermission(Permission.WORKSPACE_EDIT)
 *   async updateWorkspace(ctx: Context, input: UpdateInput) {
 *     // Only accessible to users with WORKSPACE_EDIT permission
 *   }
 * }
 * ```
 */
export function requirePermission(permission: Permission): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return;
    }

    descriptor.value = async function (this: unknown, ...args: DecoratorMethodArgs) {
      const context = extractContext(args);
      const session = context?.session;
      const permContext = context?.permissionContext;

      if (!session?.userId) {
        throw new NotAuthenticatedError();
      }

      if (permContext) {
        validatePermissionContext(permission, permContext);
        await permissionChecker.requirePermission(
          session.userId,
          permission,
          permContext,
        );
      }

      return (originalMethod as (...args: DecoratorMethodArgs) => unknown).apply(this, args);
    } as T;

    return descriptor;
  };
}

/**
 * Decorator that requires channel membership.
 * Validates that the authenticated user is a member of the specified channel.
 *
 * @returns Method decorator that enforces channel membership
 *
 * @example
 * ```typescript
 * class ChannelResolver {
 *   @requireAuth()
 *   @requireChannelMember()
 *   async getMessages(ctx: Context) {
 *     // Only accessible to channel members
 *   }
 * }
 * ```
 */
export function requireChannelMember(): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return;
    }

    descriptor.value = async function (this: unknown, ...args: DecoratorMethodArgs) {
      const context = extractContext(args);
      const session = context?.session;
      const channelId = context?.permissionContext?.channelId;

      if (!session?.userId) {
        throw new NotAuthenticatedError();
      }

      if (channelId) {
        await permissionChecker.requireChannelMember(session.userId, channelId);
      }

      return (originalMethod as (...args: DecoratorMethodArgs) => unknown).apply(this, args);
    } as T;

    return descriptor;
  };
}

/**
 * Decorator that requires workspace membership.
 * Validates that the authenticated user is a member of the specified workspace.
 *
 * @returns Method decorator that enforces workspace membership
 */
export function requireWorkspaceMember(): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return;
    }

    descriptor.value = async function (this: unknown, ...args: DecoratorMethodArgs) {
      const context = extractContext(args);
      const session = context?.session;
      const workspaceId = context?.permissionContext?.workspaceId;

      if (!session?.userId) {
        throw new NotAuthenticatedError();
      }

      if (workspaceId) {
        await permissionChecker.requireWorkspaceMember(
          session.userId,
          workspaceId,
        );
      }

      return (originalMethod as (...args: DecoratorMethodArgs) => unknown).apply(this, args);
    } as T;

    return descriptor;
  };
}

/**
 * Decorator that requires organization membership.
 * Validates that the authenticated user is a member of the specified organization.
 *
 * @returns Method decorator that enforces organization membership
 */
export function requireOrganizationMember(): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return;
    }

    descriptor.value = async function (this: unknown, ...args: DecoratorMethodArgs) {
      const context = extractContext(args);
      const session = context?.session;
      const organizationId = context?.permissionContext?.organizationId;

      if (!session?.userId) {
        throw new NotAuthenticatedError();
      }

      if (organizationId) {
        await permissionChecker.requireOrganizationMember(
          session.userId,
          organizationId,
        );
      }

      return (originalMethod as (...args: DecoratorMethodArgs) => unknown).apply(this, args);
    } as T;

    return descriptor;
  };
}

// =============================================================================
// Functional Guards
// =============================================================================

/**
 * Asserts that a session is authenticated.
 *
 * @param session - The session to check
 * @throws NotAuthenticatedError if session is invalid
 */
export function assertAuthenticated(
  session: Session | null | undefined,
): asserts session is AuthenticatedSession {
  if (!session?.userId) {
    throw new NotAuthenticatedError();
  }
}

/**
 * Asserts that a user has a specific permission.
 *
 * @param session - The authenticated session
 * @param permission - The permission to require
 * @param context - The permission context
 * @throws NotAuthenticatedError if session is invalid
 * @throws PermissionDeniedError if permission is not granted
 *
 * @example
 * ```typescript
 * async function handleDeleteMessage(session: Session, messageId: string) {
 *   await assertPermission(session, Permission.MESSAGE_DELETE_ANY, {
 *     channelId: message.channelId,
 *   });
 *   // User has permission, proceed with deletion
 * }
 * ```
 */
export async function assertPermission(
  session: Session | null | undefined,
  permission: Permission,
  context: PermissionContext,
): Promise<void> {
  assertAuthenticated(session);
  validatePermissionContext(permission, context);
  await permissionChecker.requirePermission(session.userId, permission, context);
}

/**
 * Asserts that a user is a member of an organization.
 *
 * @param session - The authenticated session
 * @param organizationId - The organization ID to check
 * @throws NotAuthenticatedError if session is invalid
 * @throws NotOrganizationMemberError if user is not a member
 */
export async function assertOrganizationMember(
  session: Session | null | undefined,
  organizationId: string,
): Promise<MembershipInfo> {
  assertAuthenticated(session);
  return permissionChecker.requireOrganizationMember(
    session.userId,
    organizationId,
  );
}

/**
 * Asserts that a user is a member of a workspace.
 *
 * @param session - The authenticated session
 * @param workspaceId - The workspace ID to check
 * @throws NotAuthenticatedError if session is invalid
 * @throws NotWorkspaceMemberError if user is not a member
 */
export async function assertWorkspaceMember(
  session: Session | null | undefined,
  workspaceId: string,
): Promise<MembershipInfo> {
  assertAuthenticated(session);
  return permissionChecker.requireWorkspaceMember(session.userId, workspaceId);
}

/**
 * Asserts that a user is a member of a channel.
 *
 * @param session - The authenticated session
 * @param channelId - The channel ID to check
 * @throws NotAuthenticatedError if session is invalid
 * @throws NotChannelMemberError if user is not a member
 */
export async function assertChannelMember(
  session: Session | null | undefined,
  channelId: string,
): Promise<MembershipInfo> {
  assertAuthenticated(session);
  return permissionChecker.requireChannelMember(session.userId, channelId);
}

/**
 * Checks if a user has a permission without throwing.
 *
 * @param session - The session to check
 * @param permission - The permission to check
 * @param context - The permission context
 * @returns GuardResult indicating if access is granted
 */
export async function checkPermission(
  session: Session | null | undefined,
  permission: Permission,
  context: PermissionContext,
): Promise<GuardResult> {
  if (!session?.userId) {
    return { granted: false, reason: 'Not authenticated' };
  }

  try {
    validatePermissionContext(permission, context);
    const hasPermission = await permissionChecker.hasPermission(
      session.userId,
      permission,
      context,
    );
    return {
      granted: hasPermission,
      reason: hasPermission ? undefined : `Missing permission: ${permission}`,
    };
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return { granted: false, reason: error.message };
    }
    throw error;
  }
}

/**
 * Checks if a user can access a resource (owns it or has the "any" permission).
 *
 * @param session - The session to check
 * @param ownPermission - The permission for own resources (e.g., MESSAGE_DELETE_OWN)
 * @param anyPermission - The permission for any resources (e.g., MESSAGE_DELETE_ANY)
 * @param context - The permission context including resourceOwnerId
 * @returns GuardResult indicating if access is granted
 */
export async function checkOwnershipOrPermission(
  session: Session | null | undefined,
  ownPermission: Permission,
  anyPermission: Permission,
  context: PermissionContext & { resourceOwnerId: string },
): Promise<GuardResult> {
  if (!session?.userId) {
    return { granted: false, reason: 'Not authenticated' };
  }

  // Check if user owns the resource
  if (session.userId === context.resourceOwnerId) {
    return checkPermission(session, ownPermission, context);
  }

  // Check if user has the "any" permission
  return checkPermission(session, anyPermission, context);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Context structure expected in decorated methods.
 */
interface MethodContext {
  session?: Session;
  permissionContext?: PermissionContext;
}

/**
 * Extracts context from method arguments.
 * Looks for an argument with session and/or permissionContext properties.
 */
function extractContext(args: unknown[]): MethodContext | undefined {
  for (const arg of args) {
    if (
      arg &&
      typeof arg === 'object' &&
      ('session' in arg || 'permissionContext' in arg)
    ) {
      return arg as MethodContext;
    }
  }
  return undefined;
}

// =============================================================================
// Guard Composition
// =============================================================================

/**
 * Composes multiple guards into a single check.
 * All guards must pass for access to be granted.
 *
 * @param guards - Array of guard functions to compose
 * @returns Combined guard function
 *
 * @example
 * ```typescript
 * const canDeleteMessage = composeGuards([
 *   () => checkPermission(session, Permission.CHANNEL_VIEW, context),
 *   () => checkOwnershipOrPermission(
 *     session,
 *     Permission.MESSAGE_DELETE_OWN,
 *     Permission.MESSAGE_DELETE_ANY,
 *     { ...context, resourceOwnerId: message.userId }
 *   ),
 * ]);
 *
 * const result = await canDeleteMessage();
 * if (!result.granted) {
 *   throw new PermissionDeniedError(userId, Permission.MESSAGE_DELETE_ANY, context);
 * }
 * ```
 */
export function composeGuards(
  guards: Array<() => Promise<GuardResult>>,
): () => Promise<GuardResult> {
  return async () => {
    for (const guard of guards) {
      const result = await guard();
      if (!result.granted) {
        return result;
      }
    }
    return { granted: true };
  };
}

// =============================================================================
// Exported Utilities
// =============================================================================

export { createPermissionChecker };
