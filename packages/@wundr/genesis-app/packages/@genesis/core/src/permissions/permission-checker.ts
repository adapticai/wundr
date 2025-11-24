/**
 * @genesis/core - Permission Checker
 *
 * Core permission checking service that validates user access
 * to resources based on their roles and memberships.
 *
 * @packageDocumentation
 */

import type {
  PrismaClient,
  OrganizationRole,
  WorkspaceRole,
  ChannelRole,
} from '@genesis/database';
import { prisma as defaultPrisma } from '@genesis/database';

import { Permission } from './permissions';
import {
  getOrganizationRolePermissions,
  getWorkspaceRolePermissions,
  getChannelRolePermissions,
} from './roles';
import {
  PermissionDeniedError,
  NotOrganizationMemberError,
  NotWorkspaceMemberError,
  NotChannelMemberError,
  InvalidPermissionContextError,
} from './errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Context for permission checks. Specifies the scope of the permission.
 */
export interface PermissionContext {
  /** Organization ID for org-scoped permissions */
  organizationId?: string;

  /** Workspace ID for workspace-scoped permissions */
  workspaceId?: string;

  /** Channel ID for channel-scoped permissions */
  channelId?: string;

  /** Specific resource ID (e.g., message ID, file ID) */
  resourceId?: string;

  /** Type of the specific resource */
  resourceType?: 'message' | 'vp' | 'file' | 'user';

  /** Owner ID of the resource (for ownership checks) */
  resourceOwnerId?: string;
}

/**
 * Result of a membership check.
 */
export interface MembershipInfo {
  isMember: boolean;
  role?: OrganizationRole | WorkspaceRole | ChannelRole;
  joinedAt?: Date;
}

/**
 * Cache entry for permission lookups.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Configuration options for PermissionChecker.
 */
export interface PermissionCheckerConfig {
  /** Cache TTL in milliseconds (default: 60000 = 1 minute) */
  cacheTtl?: number;

  /** Whether to enable caching (default: true) */
  cacheEnabled?: boolean;
}

// =============================================================================
// Permission Checker Class
// =============================================================================

/**
 * Service class for checking user permissions.
 * Provides methods to verify access at organization, workspace, and channel levels.
 *
 * @example
 * ```typescript
 * const checker = new PermissionChecker(prisma);
 *
 * // Check if user can view a channel
 * const canView = await checker.hasPermission(
 *   userId,
 *   Permission.CHANNEL_VIEW,
 *   { channelId: 'channel_123' }
 * );
 *
 * // Require permission (throws if denied)
 * await checker.requirePermission(
 *   userId,
 *   Permission.MESSAGE_SEND,
 *   { channelId: 'channel_123' }
 * );
 * ```
 */
export class PermissionChecker {
  private readonly db: PrismaClient;
  private readonly cacheTtl: number;
  private readonly cacheEnabled: boolean;

  // Caches for membership and permission lookups
  private readonly orgMembershipCache: Map<
    string,
    CacheEntry<MembershipInfo>
  > = new Map();
  private readonly workspaceMembershipCache: Map<
    string,
    CacheEntry<MembershipInfo>
  > = new Map();
  private readonly channelMembershipCache: Map<
    string,
    CacheEntry<MembershipInfo>
  > = new Map();

  constructor(prisma?: PrismaClient, config?: PermissionCheckerConfig) {
    this.db = prisma ?? defaultPrisma;
    this.cacheTtl = config?.cacheTtl ?? 60000; // 1 minute default
    this.cacheEnabled = config?.cacheEnabled ?? true;
  }

  // ===========================================================================
  // Access Check Methods
  // ===========================================================================

  /**
   * Checks if a user can access an organization.
   *
   * @param userId - The user ID to check
   * @param orgId - The organization ID to check access for
   * @returns True if the user is a member of the organization
   */
  async canAccessOrganization(userId: string, orgId: string): Promise<boolean> {
    const membership = await this.getOrganizationMembership(userId, orgId);
    return membership.isMember;
  }

  /**
   * Checks if a user can access a workspace.
   * Also verifies organization membership.
   *
   * @param userId - The user ID to check
   * @param workspaceId - The workspace ID to check access for
   * @returns True if the user is a member of the workspace
   */
  async canAccessWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const membership = await this.getWorkspaceMembership(userId, workspaceId);
    return membership.isMember;
  }

  /**
   * Checks if a user can access a channel.
   * For public channels, workspace membership is sufficient.
   * For private channels, explicit channel membership is required.
   *
   * @param userId - The user ID to check
   * @param channelId - The channel ID to check access for
   * @returns True if the user can access the channel
   */
  async canAccessChannel(userId: string, channelId: string): Promise<boolean> {
    // First check if user is a channel member
    const membership = await this.getChannelMembership(userId, channelId);
    if (membership.isMember) {
      return true;
    }

    // For public channels, check if user has workspace access
    const channel = await this.db.channel.findUnique({
      where: { id: channelId },
      select: { type: true, workspaceId: true },
    });

    if (!channel) {
      return false;
    }

    // Public channels are accessible to all workspace members
    if (channel.type === 'PUBLIC') {
      return this.canAccessWorkspace(userId, channel.workspaceId);
    }

    return false;
  }

  // ===========================================================================
  // Permission Check Methods
  // ===========================================================================

  /**
   * Checks if a user has a specific permission in the given context.
   *
   * @param userId - The user ID to check
   * @param permission - The permission to check for
   * @param context - The context (org, workspace, channel) to check in
   * @returns True if the user has the permission
   */
  async hasPermission(
    userId: string,
    permission: Permission,
    context: PermissionContext
  ): Promise<boolean> {
    // Get all applicable permissions for the user in this context
    const userPermissions = await this.getPermissions(userId, context);

    // Check for admin permission (grants all)
    if (userPermissions.includes(Permission.ADMIN_FULL)) {
      return true;
    }

    // Handle ownership-based permissions
    if (this.isOwnershipPermission(permission) && context.resourceOwnerId) {
      if (context.resourceOwnerId === userId) {
        return userPermissions.includes(permission);
      }
      // For "delete any" or "edit any", user needs the _ANY permission
      return this.hasAnyVariant(userPermissions, permission);
    }

    return userPermissions.includes(permission);
  }

  /**
   * Gets all permissions a user has in the given context.
   * Aggregates permissions from org, workspace, and channel roles.
   *
   * @param userId - The user ID to get permissions for
   * @param context - The context to get permissions in
   * @returns Array of all permissions the user has
   */
  async getPermissions(
    userId: string,
    context: PermissionContext
  ): Promise<Permission[]> {
    const permissions = new Set<Permission>();

    // Get organization-level permissions
    if (context.organizationId) {
      const orgMembership = await this.getOrganizationMembership(
        userId,
        context.organizationId
      );
      if (orgMembership.isMember && orgMembership.role) {
        const orgPerms = getOrganizationRolePermissions(
          orgMembership.role as OrganizationRole
        );
        orgPerms.forEach((p) => permissions.add(p));
      }
    }

    // Get workspace-level permissions
    if (context.workspaceId) {
      const workspaceMembership = await this.getWorkspaceMembership(
        userId,
        context.workspaceId
      );
      if (workspaceMembership.isMember && workspaceMembership.role) {
        const wsPerms = getWorkspaceRolePermissions(
          workspaceMembership.role as WorkspaceRole
        );
        wsPerms.forEach((p) => permissions.add(p));
      }
    }

    // Get channel-level permissions
    if (context.channelId) {
      const channelMembership = await this.getChannelMembership(
        userId,
        context.channelId
      );
      if (channelMembership.isMember && channelMembership.role) {
        const chPerms = getChannelRolePermissions(
          channelMembership.role as ChannelRole
        );
        chPerms.forEach((p) => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  /**
   * Requires that a user has a specific permission.
   * Throws PermissionDeniedError if the permission is not granted.
   *
   * @param userId - The user ID to check
   * @param permission - The permission to require
   * @param context - The context to check in
   * @throws PermissionDeniedError if the user lacks the permission
   */
  async requirePermission(
    userId: string,
    permission: Permission,
    context: PermissionContext
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, permission, context);
    if (!hasPermission) {
      throw new PermissionDeniedError(userId, permission, context);
    }
  }

  /**
   * Requires that a user is a member of an organization.
   *
   * @param userId - The user ID to check
   * @param organizationId - The organization ID to check membership for
   * @throws NotOrganizationMemberError if the user is not a member
   */
  async requireOrganizationMember(
    userId: string,
    organizationId: string
  ): Promise<MembershipInfo> {
    const membership = await this.getOrganizationMembership(
      userId,
      organizationId
    );
    if (!membership.isMember) {
      throw new NotOrganizationMemberError(userId, organizationId);
    }
    return membership;
  }

  /**
   * Requires that a user is a member of a workspace.
   *
   * @param userId - The user ID to check
   * @param workspaceId - The workspace ID to check membership for
   * @throws NotWorkspaceMemberError if the user is not a member
   */
  async requireWorkspaceMember(
    userId: string,
    workspaceId: string
  ): Promise<MembershipInfo> {
    const membership = await this.getWorkspaceMembership(userId, workspaceId);
    if (!membership.isMember) {
      throw new NotWorkspaceMemberError(userId, workspaceId);
    }
    return membership;
  }

  /**
   * Requires that a user is a member of a channel.
   *
   * @param userId - The user ID to check
   * @param channelId - The channel ID to check membership for
   * @throws NotChannelMemberError if the user is not a member
   */
  async requireChannelMember(
    userId: string,
    channelId: string
  ): Promise<MembershipInfo> {
    // First check explicit channel membership
    const membership = await this.getChannelMembership(userId, channelId);
    if (membership.isMember) {
      return membership;
    }

    // For public channels, workspace membership grants access
    const channel = await this.db.channel.findUnique({
      where: { id: channelId },
      select: { type: true, workspaceId: true },
    });

    if (channel?.type === 'PUBLIC') {
      const workspaceMembership = await this.getWorkspaceMembership(
        userId,
        channel.workspaceId
      );
      if (workspaceMembership.isMember) {
        // Return workspace role as effective channel role for public channels
        return {
          isMember: true,
          role: 'MEMBER' as ChannelRole,
        };
      }
    }

    throw new NotChannelMemberError(userId, channelId);
  }

  // ===========================================================================
  // Membership Lookup Methods
  // ===========================================================================

  /**
   * Gets organization membership information for a user.
   *
   * @param userId - The user ID to look up
   * @param organizationId - The organization ID to check
   * @returns Membership information including role
   */
  async getOrganizationMembership(
    userId: string,
    organizationId: string
  ): Promise<MembershipInfo> {
    const cacheKey = `${userId}:${organizationId}`;

    // Check cache
    if (this.cacheEnabled) {
      const cached = this.getFromCache(this.orgMembershipCache, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Query database
    const membership = await this.db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: {
        role: true,
        joinedAt: true,
      },
    });

    const result: MembershipInfo = membership
      ? {
          isMember: true,
          role: membership.role,
          joinedAt: membership.joinedAt,
        }
      : { isMember: false };

    // Cache result
    if (this.cacheEnabled) {
      this.setInCache(this.orgMembershipCache, cacheKey, result);
    }

    return result;
  }

  /**
   * Gets workspace membership information for a user.
   *
   * @param userId - The user ID to look up
   * @param workspaceId - The workspace ID to check
   * @returns Membership information including role
   */
  async getWorkspaceMembership(
    userId: string,
    workspaceId: string
  ): Promise<MembershipInfo> {
    const cacheKey = `${userId}:${workspaceId}`;

    // Check cache
    if (this.cacheEnabled) {
      const cached = this.getFromCache(this.workspaceMembershipCache, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Query database
    const membership = await this.db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        role: true,
        joinedAt: true,
      },
    });

    const result: MembershipInfo = membership
      ? {
          isMember: true,
          role: membership.role,
          joinedAt: membership.joinedAt,
        }
      : { isMember: false };

    // Cache result
    if (this.cacheEnabled) {
      this.setInCache(this.workspaceMembershipCache, cacheKey, result);
    }

    return result;
  }

  /**
   * Gets channel membership information for a user.
   *
   * @param userId - The user ID to look up
   * @param channelId - The channel ID to check
   * @returns Membership information including role
   */
  async getChannelMembership(
    userId: string,
    channelId: string
  ): Promise<MembershipInfo> {
    const cacheKey = `${userId}:${channelId}`;

    // Check cache
    if (this.cacheEnabled) {
      const cached = this.getFromCache(this.channelMembershipCache, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Query database
    const membership = await this.db.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      select: {
        role: true,
        joinedAt: true,
      },
    });

    const result: MembershipInfo = membership
      ? {
          isMember: true,
          role: membership.role,
          joinedAt: membership.joinedAt,
        }
      : { isMember: false };

    // Cache result
    if (this.cacheEnabled) {
      this.setInCache(this.channelMembershipCache, cacheKey, result);
    }

    return result;
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Clears all permission caches.
   * Useful after role changes or membership updates.
   */
  clearCache(): void {
    this.orgMembershipCache.clear();
    this.workspaceMembershipCache.clear();
    this.channelMembershipCache.clear();
  }

  /**
   * Invalidates cache entries for a specific user.
   *
   * @param userId - The user ID to invalidate cache for
   */
  invalidateUserCache(userId: string): void {
    this.invalidateCacheByPrefix(this.orgMembershipCache, userId);
    this.invalidateCacheByPrefix(this.workspaceMembershipCache, userId);
    this.invalidateCacheByPrefix(this.channelMembershipCache, userId);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Gets a value from cache if not expired.
   */
  private getFromCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string
  ): T | undefined {
    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Sets a value in cache with expiration.
   */
  private setInCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T
  ): void {
    cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtl,
    });
  }

  /**
   * Invalidates cache entries by key prefix.
   */
  private invalidateCacheByPrefix<T>(
    cache: Map<string, CacheEntry<T>>,
    prefix: string
  ): void {
    const keysToDelete: string[] = [];
    cache.forEach((_value, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => cache.delete(key));
  }

  /**
   * Checks if a permission is ownership-based (_OWN suffix).
   */
  private isOwnershipPermission(permission: Permission): boolean {
    return permission.includes('_own');
  }

  /**
   * Checks if user has the "any" variant of an ownership permission.
   */
  private hasAnyVariant(
    permissions: Permission[],
    ownershipPermission: Permission
  ): boolean {
    const anyVariant = ownershipPermission.replace('_own', '_any') as Permission;
    return permissions.includes(anyVariant);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new PermissionChecker instance.
 *
 * @param prisma - Optional Prisma client instance
 * @param config - Optional configuration
 * @returns A new PermissionChecker instance
 */
export function createPermissionChecker(
  prisma?: PrismaClient,
  config?: PermissionCheckerConfig
): PermissionChecker {
  return new PermissionChecker(prisma, config);
}

/**
 * Default permission checker instance.
 * Uses the default Prisma client and default configuration.
 */
export const permissionChecker = new PermissionChecker();

// =============================================================================
// Context Validation
// =============================================================================

/**
 * Validates that a permission context has the required fields for a permission.
 *
 * @param permission - The permission being checked
 * @param context - The context to validate
 * @throws InvalidPermissionContextError if context is invalid
 */
export function validatePermissionContext(
  permission: Permission,
  context: PermissionContext
): void {
  const resource = permission.split(':')[0];
  const missingFields: string[] = [];

  switch (resource) {
    case 'org':
      if (!context.organizationId) {
        missingFields.push('organizationId');
      }
      break;
    case 'workspace':
      if (!context.workspaceId && !context.organizationId) {
        missingFields.push('workspaceId or organizationId');
      }
      break;
    case 'channel':
    case 'message':
      if (!context.channelId) {
        missingFields.push('channelId');
      }
      break;
    case 'vp':
      if (!context.organizationId) {
        missingFields.push('organizationId');
      }
      break;
    case 'file':
      if (!context.workspaceId) {
        missingFields.push('workspaceId');
      }
      break;
  }

  if (missingFields.length > 0) {
    throw new InvalidPermissionContextError(
      missingFields,
      `Permission '${permission}' requires context: ${missingFields.join(', ')}`
    );
  }
}
