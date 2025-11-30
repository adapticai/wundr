/**
 * @genesis/core - Role Definitions
 *
 * Defines role structures and permission mappings for the Genesis App RBAC system.
 * Supports role inheritance for hierarchical permission management.
 *
 * @packageDocumentation
 */


import type {
  ChannelRole,
  OrganizationRole,
  WorkspaceRole,
} from '@neolith/database';
import { Permission } from './permissions';


// =============================================================================
// Role Definition Types
// =============================================================================

/**
 * Defines the structure of a role in the system.
 */
export interface RoleDefinition {
  /** Human-readable name of the role */
  name: string;

  /** Description of what this role can do */
  description: string;

  /** Direct permissions granted to this role */
  permissions: Permission[];

  /** Roles this role inherits permissions from */
  inherits?: string[];
}

/**
 * A role definition with resolved/computed permissions (including inherited).
 */
export interface ResolvedRole extends RoleDefinition {
  /** All permissions including inherited ones */
  resolvedPermissions: Permission[];
}

// =============================================================================
// Organization Roles
// =============================================================================

/**
 * Role definitions for organization-level membership.
 * Organization roles provide the highest level of access control.
 */
export const ORGANIZATION_ROLES: Record<OrganizationRole, RoleDefinition> = {
  /**
   * Organization Owner - Full control over the organization.
   * Has all permissions and cannot be removed (only transferred).
   */
  OWNER: {
    name: 'Owner',
    description: 'Full control over the organization',
    permissions: [Permission.ADMIN_FULL],
  },

  /**
   * Organization Admin - Can manage most aspects of the organization.
   * Inherits all MEMBER permissions plus administrative capabilities.
   */
  ADMIN: {
    name: 'Admin',
    description: 'Manage organization settings and members',
    permissions: [
      // Organization management
      Permission.ORG_VIEW,
      Permission.ORG_EDIT,
      Permission.ORG_MANAGE_MEMBERS,

      // Workspace management
      Permission.WORKSPACE_CREATE,
      Permission.WORKSPACE_VIEW,
      Permission.WORKSPACE_EDIT,
      Permission.WORKSPACE_DELETE,
      Permission.WORKSPACE_MANAGE_MEMBERS,

      // Orchestrator management
      Permission.VP_CREATE,
      Permission.VP_VIEW,
      Permission.VP_EDIT,
      Permission.VP_DELETE,
      Permission.VP_MANAGE_API_KEYS,

      // Channel management
      Permission.CHANNEL_CREATE,
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_EDIT,
      Permission.CHANNEL_DELETE,
      Permission.CHANNEL_MANAGE_MEMBERS,
      Permission.CHANNEL_PIN_MESSAGES,

      // Message moderation
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.MESSAGE_DELETE_ANY,

      // File management
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
      Permission.FILE_DELETE_ANY,
    ],
    inherits: ['MEMBER'],
  },

  /**
   * Organization Member - Standard member with basic access.
   * Can view organization, join workspaces, and participate.
   */
  MEMBER: {
    name: 'Member',
    description: 'Standard organization member',
    permissions: [
      // Organization
      Permission.ORG_VIEW,

      // Workspace
      Permission.WORKSPACE_VIEW,

      // Channel
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_CREATE,

      // Messages
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,

      // VP
      Permission.VP_VIEW,

      // Files
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
    ],
  },
};

// =============================================================================
// Workspace Roles
// =============================================================================

/**
 * Role definitions for workspace-level membership.
 * Workspace roles provide scoped access within a specific workspace.
 */
export const WORKSPACE_ROLES: Record<WorkspaceRole, RoleDefinition> = {
  /**
   * Workspace Owner - Full control over the workspace.
   * Typically the creator of the workspace.
   */
  OWNER: {
    name: 'Workspace Owner',
    description: 'Full control over the workspace',
    permissions: [
      // Workspace
      Permission.WORKSPACE_VIEW,
      Permission.WORKSPACE_EDIT,
      Permission.WORKSPACE_DELETE,
      Permission.WORKSPACE_MANAGE_MEMBERS,

      // Channel
      Permission.CHANNEL_CREATE,
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_EDIT,
      Permission.CHANNEL_DELETE,
      Permission.CHANNEL_MANAGE_MEMBERS,
      Permission.CHANNEL_PIN_MESSAGES,

      // Messages
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.MESSAGE_DELETE_ANY,

      // Files
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
      Permission.FILE_DELETE_ANY,
    ],
  },

  /**
   * Workspace Admin - Can manage workspace settings and members.
   */
  ADMIN: {
    name: 'Workspace Admin',
    description: 'Manage workspace settings and members',
    permissions: [
      // Workspace
      Permission.WORKSPACE_VIEW,
      Permission.WORKSPACE_EDIT,
      Permission.WORKSPACE_MANAGE_MEMBERS,

      // Channel
      Permission.CHANNEL_CREATE,
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_EDIT,
      Permission.CHANNEL_DELETE,
      Permission.CHANNEL_MANAGE_MEMBERS,
      Permission.CHANNEL_PIN_MESSAGES,

      // Messages
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.MESSAGE_DELETE_ANY,

      // Files
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
      Permission.FILE_DELETE_ANY,
    ],
    inherits: ['MEMBER'],
  },

  /**
   * Workspace Member - Standard workspace member.
   * Can participate in channels and send messages.
   */
  MEMBER: {
    name: 'Workspace Member',
    description: 'Standard workspace member',
    permissions: [
      // Workspace
      Permission.WORKSPACE_VIEW,

      // Channel
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_CREATE,

      // Messages
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,

      // Files
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
    ],
  },

  /**
   * Workspace Guest - Limited access member.
   * Can only view and participate in channels they are explicitly invited to.
   */
  GUEST: {
    name: 'Guest',
    description: 'Limited access - specific channels only',
    permissions: [
      // Workspace
      Permission.WORKSPACE_VIEW,

      // Messages
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,

      // Files
      Permission.FILE_VIEW,
    ],
  },
};

// =============================================================================
// Channel Roles
// =============================================================================

/**
 * Role definitions for channel-level membership.
 * Channel roles provide the most granular access control.
 */
export const CHANNEL_ROLES: Record<ChannelRole, RoleDefinition> = {
  /**
   * Channel Owner - Full control over the channel.
   * Typically the creator of the channel.
   */
  OWNER: {
    name: 'Channel Owner',
    description: 'Full control over the channel',
    permissions: [
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_EDIT,
      Permission.CHANNEL_DELETE,
      Permission.CHANNEL_MANAGE_MEMBERS,
      Permission.CHANNEL_PIN_MESSAGES,
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.MESSAGE_DELETE_ANY,
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_ANY,
    ],
  },

  /**
   * Channel Admin - Can manage channel settings and moderate.
   */
  ADMIN: {
    name: 'Channel Admin',
    description: 'Manage channel and moderate messages',
    permissions: [
      Permission.CHANNEL_VIEW,
      Permission.CHANNEL_EDIT,
      Permission.CHANNEL_MANAGE_MEMBERS,
      Permission.CHANNEL_PIN_MESSAGES,
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.MESSAGE_DELETE_ANY,
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_ANY,
    ],
    inherits: ['MEMBER'],
  },

  /**
   * Channel Member - Standard channel member.
   * Can read and send messages.
   */
  MEMBER: {
    name: 'Channel Member',
    description: 'Participate in channel discussions',
    permissions: [
      Permission.CHANNEL_VIEW,
      Permission.MESSAGE_SEND,
      Permission.MESSAGE_EDIT_OWN,
      Permission.MESSAGE_DELETE_OWN,
      Permission.FILE_UPLOAD,
      Permission.FILE_VIEW,
      Permission.FILE_DELETE_OWN,
    ],
  },
};

// =============================================================================
// Role Resolution Utilities
// =============================================================================

/**
 * Resolves all permissions for a role including inherited permissions.
 *
 * @param role - The role definition to resolve
 * @param roleMap - Map of all roles to look up inherited roles
 * @param visited - Set of visited roles to prevent circular inheritance
 * @returns Array of all resolved permissions (deduplicated)
 */
export function resolveRolePermissions(
  role: RoleDefinition,
  roleMap: Record<string, RoleDefinition>,
  visited: Set<string> = new Set(),
): Permission[] {
  const permissions = new Set<Permission>(role.permissions);

  // Resolve inherited permissions
  if (role.inherits) {
    for (const inheritedRoleName of role.inherits) {
      // Prevent circular inheritance
      if (visited.has(inheritedRoleName)) {
        continue;
      }
      visited.add(inheritedRoleName);

      const inheritedRole = roleMap[inheritedRoleName];
      if (inheritedRole) {
        const inheritedPermissions = resolveRolePermissions(
          inheritedRole,
          roleMap,
          visited,
        );
        for (const perm of inheritedPermissions) {
          permissions.add(perm);
        }
      }
    }
  }

  return Array.from(permissions);
}

/**
 * Gets resolved permissions for an organization role.
 *
 * @param role - The organization role
 * @returns Array of all permissions for the role
 */
export function getOrganizationRolePermissions(
  role: OrganizationRole,
): Permission[] {
  const roleDefinition = ORGANIZATION_ROLES[role];
  if (!roleDefinition) {
    throw new Error(`Invalid organization role: ${role}`);
  }
  return resolveRolePermissions(
    roleDefinition,
    ORGANIZATION_ROLES as Record<string, RoleDefinition>,
  );
}

/**
 * Gets resolved permissions for a workspace role.
 *
 * @param role - The workspace role
 * @returns Array of all permissions for the role
 */
export function getWorkspaceRolePermissions(role: WorkspaceRole): Permission[] {
  const roleDefinition = WORKSPACE_ROLES[role];
  if (!roleDefinition) {
    throw new Error(`Invalid workspace role: ${role}`);
  }
  return resolveRolePermissions(
    roleDefinition,
    WORKSPACE_ROLES as Record<string, RoleDefinition>,
  );
}

/**
 * Gets resolved permissions for a channel role.
 *
 * @param role - The channel role
 * @returns Array of all permissions for the role
 */
export function getChannelRolePermissions(role: ChannelRole): Permission[] {
  const roleDefinition = CHANNEL_ROLES[role];
  if (!roleDefinition) {
    throw new Error(`Invalid channel role: ${role}`);
  }
  return resolveRolePermissions(
    roleDefinition,
    CHANNEL_ROLES as Record<string, RoleDefinition>,
  );
}

/**
 * Checks if a role has a specific permission.
 *
 * @param permissions - The resolved permissions for the role
 * @param permission - The permission to check
 * @returns True if the role has the permission
 */
export function roleHasPermission(
  permissions: Permission[],
  permission: Permission,
): boolean {
  // ADMIN_FULL grants all permissions
  if (permissions.includes(Permission.ADMIN_FULL)) {
    return true;
  }
  return permissions.includes(permission);
}

// =============================================================================
// Role Hierarchy
// =============================================================================

/**
 * Organization role hierarchy (higher index = higher privilege).
 */
export const ORGANIZATION_ROLE_HIERARCHY: readonly OrganizationRole[] = [
  'MEMBER',
  'ADMIN',
  'OWNER',
] as const;

/**
 * Workspace role hierarchy (higher index = higher privilege).
 */
export const WORKSPACE_ROLE_HIERARCHY: readonly WorkspaceRole[] = [
  'GUEST',
  'MEMBER',
  'ADMIN',
  'OWNER',
] as const;

/**
 * Channel role hierarchy (higher index = higher privilege).
 */
export const CHANNEL_ROLE_HIERARCHY: readonly ChannelRole[] = [
  'MEMBER',
  'ADMIN',
  'OWNER',
] as const;

/**
 * Compares two roles to determine which has higher privileges.
 *
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @param hierarchy - The role hierarchy array
 * @returns Negative if role1 < role2, positive if role1 > role2, 0 if equal
 */
export function compareRoles<T>(
  role1: T,
  role2: T,
  hierarchy: readonly T[],
): number {
  const index1 = hierarchy.indexOf(role1);
  const index2 = hierarchy.indexOf(role2);
  return index1 - index2;
}

/**
 * Checks if one role is at least as privileged as another.
 *
 * @param role - The role to check
 * @param requiredRole - The minimum required role
 * @param hierarchy - The role hierarchy array
 * @returns True if role is at least as privileged as requiredRole
 */
export function isAtLeastRole<T>(
  role: T,
  requiredRole: T,
  hierarchy: readonly T[],
): boolean {
  return compareRoles(role, requiredRole, hierarchy) >= 0;
}
