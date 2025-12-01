/**
 * @genesis/core - Permission Definitions
 *
 * Defines all permissions available in the Genesis App RBAC system.
 * Permissions follow a resource:action naming convention for clarity.
 *
 * @packageDocumentation
 */

// =============================================================================
// Permission Enum
// =============================================================================

/**
 * Enumeration of all available permissions in the system.
 * Permissions are organized by resource type and follow the pattern:
 * `resource:action` (e.g., `org:view`, `channel:create`)
 */
export enum Permission {
  // ---------------------------------------------------------------------------
  // Organization Permissions
  // ---------------------------------------------------------------------------

  /** View organization details and members */
  ORG_VIEW = 'org:view',

  /** Edit organization settings, name, description */
  ORG_EDIT = 'org:edit',

  /** Delete the organization (irreversible) */
  ORG_DELETE = 'org:delete',

  /** Add, remove, or modify organization members and their roles */
  ORG_MANAGE_MEMBERS = 'org:manage_members',

  // ---------------------------------------------------------------------------
  // Workspace Permissions
  // ---------------------------------------------------------------------------

  /** Create new workspaces within an organization */
  WORKSPACE_CREATE = 'workspace:create',

  /** View workspace details, channels, and settings */
  WORKSPACE_VIEW = 'workspace:view',

  /** Edit workspace settings, name, description, visibility */
  WORKSPACE_EDIT = 'workspace:edit',

  /** Delete a workspace (irreversible) */
  WORKSPACE_DELETE = 'workspace:delete',

  /** Add, remove, or modify workspace members and their roles */
  WORKSPACE_MANAGE_MEMBERS = 'workspace:manage_members',

  // ---------------------------------------------------------------------------
  // Channel Permissions
  // ---------------------------------------------------------------------------

  /** Create new channels within a workspace */
  CHANNEL_CREATE = 'channel:create',

  /** View channel messages and members */
  CHANNEL_VIEW = 'channel:view',

  /** Edit channel settings, name, description */
  CHANNEL_EDIT = 'channel:edit',

  /** Delete or archive a channel */
  CHANNEL_DELETE = 'channel:delete',

  /** Add, remove, or modify channel members and their roles */
  CHANNEL_MANAGE_MEMBERS = 'channel:manage_members',

  /** Pin and unpin messages in a channel */
  CHANNEL_PIN_MESSAGES = 'channel:pin_messages',

  // ---------------------------------------------------------------------------
  // Message Permissions
  // ---------------------------------------------------------------------------

  /** Send messages to channels */
  MESSAGE_SEND = 'message:send',

  /** Edit own messages */
  MESSAGE_EDIT_OWN = 'message:edit_own',

  /** Delete own messages */
  MESSAGE_DELETE_OWN = 'message:delete_own',

  /** Delete any message (moderation) */
  MESSAGE_DELETE_ANY = 'message:delete_any',

  // ---------------------------------------------------------------------------
  // Orchestrator (Virtual Person) Permissions
  // ---------------------------------------------------------------------------

  /** Create new VPs in the organization */
  VP_CREATE = 'vp:create',

  /** View Orchestrator details and configuration */
  VP_VIEW = 'vp:view',

  /** Edit Orchestrator settings and configuration */
  VP_EDIT = 'vp:edit',

  /** Delete a Orchestrator */
  VP_DELETE = 'vp:delete',

  /** Manage OrchestratorAPI keys (create, rotate, revoke) */
  VP_MANAGE_API_KEYS = 'vp:manage_api_keys',

  // ---------------------------------------------------------------------------
  // File Permissions
  // ---------------------------------------------------------------------------

  /** Upload files to workspaces */
  FILE_UPLOAD = 'file:upload',

  /** View and download files */
  FILE_VIEW = 'file:view',

  /** Delete own uploaded files */
  FILE_DELETE_OWN = 'file:delete_own',

  /** Delete any file (moderation) */
  FILE_DELETE_ANY = 'file:delete_any',

  // ---------------------------------------------------------------------------
  // Admin Permissions
  // ---------------------------------------------------------------------------

  /** Full administrative access - bypasses all permission checks */
  ADMIN_FULL = 'admin:full',
}

// =============================================================================
// Permission Categories
// =============================================================================

/**
 * Groups permissions by resource type for easier management.
 */
export const PERMISSION_CATEGORIES = {
  organization: [
    Permission.ORG_VIEW,
    Permission.ORG_EDIT,
    Permission.ORG_DELETE,
    Permission.ORG_MANAGE_MEMBERS,
  ],
  workspace: [
    Permission.WORKSPACE_CREATE,
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_EDIT,
    Permission.WORKSPACE_DELETE,
    Permission.WORKSPACE_MANAGE_MEMBERS,
  ],
  channel: [
    Permission.CHANNEL_CREATE,
    Permission.CHANNEL_VIEW,
    Permission.CHANNEL_EDIT,
    Permission.CHANNEL_DELETE,
    Permission.CHANNEL_MANAGE_MEMBERS,
    Permission.CHANNEL_PIN_MESSAGES,
  ],
  message: [
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_OWN,
    Permission.MESSAGE_DELETE_OWN,
    Permission.MESSAGE_DELETE_ANY,
  ],
  vp: [
    Permission.VP_CREATE,
    Permission.VP_VIEW,
    Permission.VP_EDIT,
    Permission.VP_DELETE,
    Permission.VP_MANAGE_API_KEYS,
  ],
  file: [
    Permission.FILE_UPLOAD,
    Permission.FILE_VIEW,
    Permission.FILE_DELETE_OWN,
    Permission.FILE_DELETE_ANY,
  ],
  admin: [Permission.ADMIN_FULL],
} as const;

/**
 * Type representing all permission category names.
 */
export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;

// =============================================================================
// Permission Utilities
// =============================================================================

/**
 * Checks if a value is a valid Permission enum value.
 *
 * @param value - The value to check
 * @returns True if the value is a valid Permission
 */
export function isValidPermission(value: unknown): value is Permission {
  return (
    typeof value === 'string' &&
    Object.values(Permission).includes(value as Permission)
  );
}

/**
 * Gets the resource type from a permission string.
 *
 * @param permission - The permission to extract the resource from
 * @returns The resource type (e.g., 'org', 'workspace', 'channel')
 *
 * @example
 * ```typescript
 * getPermissionResource(Permission.ORG_VIEW); // 'org'
 * getPermissionResource(Permission.CHANNEL_CREATE); // 'channel'
 * ```
 */
export function getPermissionResource(permission: Permission): string {
  return permission.split(':')[0] ?? '';
}

/**
 * Gets the action from a permission string.
 *
 * @param permission - The permission to extract the action from
 * @returns The action (e.g., 'view', 'edit', 'delete')
 *
 * @example
 * ```typescript
 * getPermissionAction(Permission.ORG_VIEW); // 'view'
 * getPermissionAction(Permission.CHANNEL_CREATE); // 'create'
 * ```
 */
export function getPermissionAction(permission: Permission): string {
  return permission.split(':')[1] ?? '';
}

/**
 * Gets all permissions for a specific resource type.
 *
 * @param resource - The resource type to get permissions for
 * @returns Array of permissions for the resource
 */
export function getPermissionsForResource(resource: string): Permission[] {
  return Object.values(Permission).filter(
    p => getPermissionResource(p) === resource
  );
}

/**
 * All permissions as an array (useful for admin roles).
 */
export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze(
  Object.values(Permission)
);
