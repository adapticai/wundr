/**
 * @genesis/core - Permission Middleware
 *
 * Next.js API middleware helpers for permission checking.
 * Provides higher-order functions to wrap API handlers with permission checks.
 *
 * @packageDocumentation
 */

import {
  NotAuthenticatedError,
  PermissionDeniedError,
  NotChannelMemberError,
  NotWorkspaceMemberError,
  NotOrganizationMemberError,
} from './errors';
import { permissionChecker, validatePermissionContext } from './permission-checker';
import { Permission } from './permissions';

import type { PermissionContext, MembershipInfo } from './permission-checker';
import type { Session } from '@genesis/database';


// =============================================================================
// Types
// =============================================================================

/**
 * Request context containing session information.
 * Typically extended by Next.js API request types.
 */
export interface RequestContext {
  session?: Session | null;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: unknown;
}

/**
 * Extended request context with verified session.
 */
export interface AuthenticatedRequestContext extends RequestContext {
  session: Session & { userId: string };
  membership?: MembershipInfo;
}

/**
 * Context extractor function type.
 */
export type ContextExtractor<T extends RequestContext> = (
  req: T
) => PermissionContext;

/**
 * API handler function type.
 */
export type ApiHandler<T extends RequestContext, R> = (req: T) => Promise<R>;

/**
 * Middleware result wrapper.
 */
export interface MiddlewareResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Wraps an API handler to require authentication.
 * The session must exist and have a userId.
 *
 * @param handler - The API handler to wrap
 * @returns Wrapped handler that requires authentication
 *
 * @example
 * ```typescript
 * // pages/api/profile.ts
 * const handler = withAuth(async (req: AuthenticatedRequestContext) => {
 *   // req.session.userId is guaranteed to exist
 *   return getUserProfile(req.session.userId);
 * });
 *
 * export default handler;
 * ```
 */
export function withAuth<T extends RequestContext, R>(
  handler: ApiHandler<AuthenticatedRequestContext, R>,
): ApiHandler<T, R> {
  return async (req: T): Promise<R> => {
    if (!req.session?.userId) {
      throw new NotAuthenticatedError();
    }

    return handler(req as unknown as AuthenticatedRequestContext);
  };
}

// =============================================================================
// Permission Middleware
// =============================================================================

/**
 * Wraps an API handler to require a specific permission.
 *
 * @param permission - The permission to require
 * @param extractContext - Function to extract permission context from request
 * @returns Higher-order function that wraps the handler
 *
 * @example
 * ```typescript
 * // pages/api/workspace/[workspaceId]/update.ts
 * const handler = withPermission(
 *   Permission.WORKSPACE_EDIT,
 *   (req) => ({ workspaceId: req.params?.workspaceId })
 * )(async (req) => {
 *   // User has WORKSPACE_EDIT permission
 *   return updateWorkspace(req.params.workspaceId, req.body);
 * });
 *
 * export default handler;
 * ```
 */
export function withPermission<T extends RequestContext>(
  permission: Permission,
  extractContext: ContextExtractor<T>,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      // Require authentication
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      // Extract and validate permission context
      const context = extractContext(req);
      validatePermissionContext(permission, context);

      // Check permission
      const hasPermission = await permissionChecker.hasPermission(
        req.session.userId,
        permission,
        context,
      );

      if (!hasPermission) {
        throw new PermissionDeniedError(req.session.userId, permission, context);
      }

      return handler(req as unknown as AuthenticatedRequestContext);
    };
  };
}

/**
 * Wraps an API handler to require multiple permissions (all must be granted).
 *
 * @param permissions - Array of permissions to require
 * @param extractContext - Function to extract permission context from request
 * @returns Higher-order function that wraps the handler
 */
export function withPermissions<T extends RequestContext>(
  permissions: Permission[],
  extractContext: ContextExtractor<T>,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const context = extractContext(req);

      // Check all permissions
      for (const permission of permissions) {
        validatePermissionContext(permission, context);
        const hasPermission = await permissionChecker.hasPermission(
          req.session.userId,
          permission,
          context,
        );

        if (!hasPermission) {
          throw new PermissionDeniedError(
            req.session.userId,
            permission,
            context,
          );
        }
      }

      return handler(req as unknown as AuthenticatedRequestContext);
    };
  };
}

/**
 * Wraps an API handler to require any one of multiple permissions.
 *
 * @param permissions - Array of permissions (any one must be granted)
 * @param extractContext - Function to extract permission context from request
 * @returns Higher-order function that wraps the handler
 */
export function withAnyPermission<T extends RequestContext>(
  permissions: Permission[],
  extractContext: ContextExtractor<T>,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const context = extractContext(req);

      // Check if user has any of the permissions
      for (const permission of permissions) {
        try {
          validatePermissionContext(permission, context);
          const hasPermission = await permissionChecker.hasPermission(
            req.session.userId,
            permission,
            context,
          );
          if (hasPermission) {
            return handler(req as unknown as AuthenticatedRequestContext);
          }
        } catch {
          // Continue checking other permissions
        }
      }

      // None of the permissions were granted
      throw new PermissionDeniedError(
        req.session.userId,
        permissions[0] ?? Permission.ADMIN_FULL,
        context,
        `User lacks any of the required permissions: ${permissions.join(', ')}`,
      );
    };
  };
}

// =============================================================================
// Membership Middleware
// =============================================================================

/**
 * Wraps an API handler to require channel membership.
 *
 * @param extractChannelId - Function to extract channel ID from request
 * @returns Higher-order function that wraps the handler
 *
 * @example
 * ```typescript
 * // pages/api/channel/[channelId]/messages.ts
 * const handler = withChannelAccess(
 *   (req) => req.params?.channelId ?? ''
 * )(async (req) => {
 *   // User is a member of the channel
 *   return getChannelMessages(req.params.channelId);
 * });
 * ```
 */
export function withChannelAccess<T extends RequestContext>(
  extractChannelId: (req: T) => string,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const channelId = extractChannelId(req);
      const canAccess = await permissionChecker.canAccessChannel(
        req.session.userId,
        channelId,
      );

      if (!canAccess) {
        throw new NotChannelMemberError(req.session.userId, channelId);
      }

      return handler(req as unknown as AuthenticatedRequestContext);
    };
  };
}

/**
 * Wraps an API handler to require workspace membership.
 *
 * @param extractWorkspaceId - Function to extract workspace ID from request
 * @returns Higher-order function that wraps the handler
 */
export function withWorkspaceAccess<T extends RequestContext>(
  extractWorkspaceId: (req: T) => string,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const workspaceId = extractWorkspaceId(req);
      const membership = await permissionChecker.getWorkspaceMembership(
        req.session.userId,
        workspaceId,
      );

      if (!membership.isMember) {
        throw new NotWorkspaceMemberError(req.session.userId, workspaceId);
      }

      // Attach membership info to request
      const authenticatedReq = req as unknown as AuthenticatedRequestContext;
      authenticatedReq.membership = membership;

      return handler(authenticatedReq);
    };
  };
}

/**
 * Wraps an API handler to require organization membership.
 *
 * @param extractOrganizationId - Function to extract organization ID from request
 * @returns Higher-order function that wraps the handler
 */
export function withOrganizationAccess<T extends RequestContext>(
  extractOrganizationId: (req: T) => string,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const organizationId = extractOrganizationId(req);
      const membership = await permissionChecker.getOrganizationMembership(
        req.session.userId,
        organizationId,
      );

      if (!membership.isMember) {
        throw new NotOrganizationMemberError(req.session.userId, organizationId);
      }

      // Attach membership info to request
      const authenticatedReq = req as unknown as AuthenticatedRequestContext;
      authenticatedReq.membership = membership;

      return handler(authenticatedReq);
    };
  };
}

// =============================================================================
// Ownership Middleware
// =============================================================================

/**
 * Wraps an API handler to require ownership of a resource or a fallback permission.
 *
 * @param extractOwnerId - Function to extract the resource owner ID
 * @param fallbackPermission - Permission to check if not the owner
 * @param extractContext - Function to extract permission context
 * @returns Higher-order function that wraps the handler
 *
 * @example
 * ```typescript
 * // pages/api/message/[messageId]/delete.ts
 * const handler = withOwnershipOrPermission(
 *   async (req) => {
 *     const message = await getMessage(req.params.messageId);
 *     return message.userId;
 *   },
 *   Permission.MESSAGE_DELETE_ANY,
 *   (req) => ({ channelId: req.query.channelId as string })
 * )(async (req) => {
 *   return deleteMessage(req.params.messageId);
 * });
 * ```
 */
export function withOwnershipOrPermission<T extends RequestContext>(
  extractOwnerId: (req: T) => string | Promise<string>,
  fallbackPermission: Permission,
  extractContext: ContextExtractor<T>,
) {
  return function <R>(handler: ApiHandler<AuthenticatedRequestContext, R>): ApiHandler<T, R> {
    return async (req: T): Promise<R> => {
      if (!req.session?.userId) {
        throw new NotAuthenticatedError();
      }

      const ownerId = await Promise.resolve(extractOwnerId(req));

      // If user is the owner, allow access
      if (req.session.userId === ownerId) {
        return handler(req as unknown as AuthenticatedRequestContext);
      }

      // Otherwise, check fallback permission
      const context = extractContext(req);
      validatePermissionContext(fallbackPermission, context);

      const hasPermission = await permissionChecker.hasPermission(
        req.session.userId,
        fallbackPermission,
        context,
      );

      if (!hasPermission) {
        throw new PermissionDeniedError(
          req.session.userId,
          fallbackPermission,
          context,
        );
      }

      return handler(req as unknown as AuthenticatedRequestContext);
    };
  };
}

// =============================================================================
// Middleware Composition
// =============================================================================

/**
 * Composes multiple middleware functions into a single middleware.
 * Middleware are executed in order.
 *
 * @param middlewares - Array of middleware functions to compose
 * @returns Composed middleware function
 *
 * @example
 * ```typescript
 * const handler = compose(
 *   withAuth,
 *   withWorkspaceAccess((req) => req.params?.workspaceId ?? ''),
 *   withPermission(Permission.CHANNEL_CREATE, (req) => ({
 *     workspaceId: req.params?.workspaceId,
 *   }))
 * )(async (req) => {
 *   return createChannel(req.body);
 * });
 * ```
 */
export function compose<T extends RequestContext, R>(
  ...middlewares: Array<
    (handler: ApiHandler<T, R>) => ApiHandler<T, R>
  >
): (handler: ApiHandler<T, R>) => ApiHandler<T, R> {
  return (handler: ApiHandler<T, R>) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler,
    );
  };
}

// =============================================================================
// Error Handler
// =============================================================================

/**
 * Wraps an API handler to catch and format permission errors.
 * Converts GenesisErrors to appropriate HTTP responses.
 *
 * @param handler - The API handler to wrap
 * @param formatError - Optional function to format errors
 * @returns Wrapped handler with error handling
 */
export function withPermissionErrorHandler<T extends RequestContext, R>(
  handler: ApiHandler<T, R>,
  formatError?: (error: Error) => R,
): ApiHandler<T, R> {
  return async (req: T): Promise<R> => {
    try {
      return await handler(req);
    } catch (error) {
      if (
        error instanceof NotAuthenticatedError ||
        error instanceof PermissionDeniedError ||
        error instanceof NotChannelMemberError ||
        error instanceof NotWorkspaceMemberError ||
        error instanceof NotOrganizationMemberError
      ) {
        if (formatError) {
          return formatError(error);
        }
        throw error;
      }
      throw error;
    }
  };
}
