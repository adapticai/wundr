/**
 * Permission checking utilities for admin operations
 * @module lib/admin/permissions
 */

import type {
  Permission,
  PermissionResource,
  PermissionAction,
  PermissionCheckResult,
  BulkPermissionCheckResult,
} from '@/types/admin';

// =============================================================================
// Permission Constants
// =============================================================================

/**
 * System role definitions with their default permissions
 */
export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
  GUEST: 'guest',
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

/**
 * Default permissions for each system role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SYSTEM_ROLES.OWNER]: [
    { resource: '*', actions: ['*'] },
  ],
  [SYSTEM_ROLES.ADMIN]: [
    { resource: 'workspace', actions: ['read', 'update'] },
    { resource: 'channel', actions: ['*'] },
    { resource: 'message', actions: ['*'] },
    { resource: 'user', actions: ['read', 'update'] },
    { resource: 'role', actions: ['read', 'create', 'update'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'billing', actions: ['read'] },
    { resource: 'integration', actions: ['*'] },
  ],
  [SYSTEM_ROLES.MODERATOR]: [
    { resource: 'workspace', actions: ['read'] },
    { resource: 'channel', actions: ['read', 'create', 'update'] },
    { resource: 'message', actions: ['*'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'role', actions: ['read'] },
  ],
  [SYSTEM_ROLES.MEMBER]: [
    { resource: 'workspace', actions: ['read'] },
    { resource: 'channel', actions: ['read', 'create'] },
    { resource: 'message', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'user', actions: ['read'] },
  ],
  [SYSTEM_ROLES.GUEST]: [
    { resource: 'workspace', actions: ['read'] },
    { resource: 'channel', actions: ['read'] },
    { resource: 'message', actions: ['read'] },
  ],
};

/**
 * Dangerous permissions that require extra confirmation
 */
export const DANGEROUS_PERMISSIONS = [
  { resource: 'workspace', action: 'delete' },
  { resource: 'user', action: 'delete' },
  { resource: 'billing', action: 'delete' },
  { resource: '*', action: '*' },
] as const;

// =============================================================================
// Permission Checking Functions
// =============================================================================

/**
 * Check if a specific permission is granted
 *
 * @param permissions - User's permissions
 * @param resource - Resource to check
 * @param action - Action to check
 * @returns Whether permission is granted
 *
 * @example
 * ```ts
 * const canDelete = hasPermission(userPerms, 'user', 'delete');
 * ```
 */
export function hasPermission(
  permissions: Permission[],
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  // Check for wildcard permissions
  const wildcardPerm = permissions.find(p => p.resource === '*');
  if (wildcardPerm?.actions.includes('*')) {
    return true;
  }

  // Check for resource-specific permissions
  const resourcePerm = permissions.find(p => p.resource === resource);
  if (!resourcePerm) {
    return false;
  }

  // Check for wildcard action
  if (resourcePerm.actions.includes('*')) {
    return true;
  }

  // Check for specific action
  return resourcePerm.actions.includes(action);
}

/**
 * Check multiple permissions at once
 *
 * @param permissions - User's permissions
 * @param checks - Array of resource/action pairs to check
 * @returns Object mapping checks to results
 *
 * @example
 * ```ts
 * const results = checkMultiplePermissions(userPerms, [
 *   { resource: 'user', action: 'create' },
 *   { resource: 'user', action: 'delete' },
 * ]);
 * console.log(results['user:create'].granted);
 * ```
 */
export function checkMultiplePermissions(
  permissions: Permission[],
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>,
): BulkPermissionCheckResult {
  const results: BulkPermissionCheckResult = {};

  for (const check of checks) {
    const key = `${check.resource}:${check.action}`;
    const granted = hasPermission(permissions, check.resource, check.action);
    results[key] = {
      granted,
      reason: granted ? undefined : `Missing permission: ${key}`,
    };
  }

  return results;
}

/**
 * Check if user has ANY of the specified permissions
 *
 * @param permissions - User's permissions
 * @param checks - Array of resource/action pairs to check
 * @returns True if user has at least one permission
 */
export function hasAnyPermission(
  permissions: Permission[],
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>,
): boolean {
  return checks.some(check =>
    hasPermission(permissions, check.resource, check.action),
  );
}

/**
 * Check if user has ALL of the specified permissions
 *
 * @param permissions - User's permissions
 * @param checks - Array of resource/action pairs to check
 * @returns True if user has all permissions
 */
export function hasAllPermissions(
  permissions: Permission[],
  checks: Array<{ resource: PermissionResource; action: PermissionAction }>,
): boolean {
  return checks.every(check =>
    hasPermission(permissions, check.resource, check.action),
  );
}

/**
 * Check if a permission is considered dangerous
 *
 * @param resource - Resource being checked
 * @param action - Action being checked
 * @returns Whether this is a dangerous permission
 */
export function isDangerousPermission(
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  return DANGEROUS_PERMISSIONS.some(
    danger => danger.resource === resource && danger.action === action,
  );
}

// =============================================================================
// Permission Comparison & Validation
// =============================================================================

/**
 * Compare two permission sets
 *
 * @param current - Current permissions
 * @param proposed - Proposed new permissions
 * @returns Added and removed permissions
 */
export function comparePermissions(
  current: Permission[],
  proposed: Permission[],
): {
  added: Permission[];
  removed: Permission[];
  unchanged: Permission[];
} {
  const added: Permission[] = [];
  const removed: Permission[] = [];
  const unchanged: Permission[] = [];

  // Find added and unchanged
  for (const perm of proposed) {
    const existing = current.find(p => p.resource === perm.resource);
    if (!existing) {
      added.push(perm);
    } else {
      const addedActions = perm.actions.filter(a => !existing.actions.includes(a));
      if (addedActions.length > 0) {
        added.push({ resource: perm.resource, actions: addedActions });
      }

      const commonActions = perm.actions.filter(a => existing.actions.includes(a));
      if (commonActions.length > 0) {
        unchanged.push({ resource: perm.resource, actions: commonActions });
      }
    }
  }

  // Find removed
  for (const perm of current) {
    const existing = proposed.find(p => p.resource === perm.resource);
    if (!existing) {
      removed.push(perm);
    } else {
      const removedActions = perm.actions.filter(a => !existing.actions.includes(a));
      if (removedActions.length > 0) {
        removed.push({ resource: perm.resource, actions: removedActions });
      }
    }
  }

  return { added, removed, unchanged };
}

/**
 * Validate permission structure
 *
 * @param permissions - Permissions to validate
 * @returns Validation result with errors if any
 */
export function validatePermissions(permissions: Permission[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(permissions)) {
    errors.push('Permissions must be an array');
    return { valid: false, errors };
  }

  for (let i = 0; i < permissions.length; i++) {
    const perm = permissions[i];

    if (!perm.resource || typeof perm.resource !== 'string') {
      errors.push(`Permission ${i}: resource is required and must be a string`);
    }

    if (!Array.isArray(perm.actions) || perm.actions.length === 0) {
      errors.push(`Permission ${i}: actions must be a non-empty array`);
    }

    if (perm.actions && !perm.actions.every(a => typeof a === 'string')) {
      errors.push(`Permission ${i}: all actions must be strings`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Merge multiple permission sets
 *
 * @param permissionSets - Array of permission arrays to merge
 * @returns Merged permissions with duplicates removed
 */
export function mergePermissions(...permissionSets: Permission[][]): Permission[] {
  const merged = new Map<string, Set<PermissionAction>>();

  for (const permissions of permissionSets) {
    for (const perm of permissions) {
      const existing = merged.get(perm.resource);
      if (existing) {
        perm.actions.forEach(action => existing.add(action));
      } else {
        merged.set(perm.resource, new Set(perm.actions));
      }
    }
  }

  return Array.from(merged.entries()).map(([resource, actions]) => ({
    resource: resource as PermissionResource,
    actions: Array.from(actions),
  }));
}

/**
 * Filter permissions to only include specific resources
 *
 * @param permissions - Permissions to filter
 * @param resources - Resources to include
 * @returns Filtered permissions
 */
export function filterPermissionsByResource(
  permissions: Permission[],
  resources: PermissionResource[],
): Permission[] {
  return permissions.filter(perm =>
    resources.includes(perm.resource) || perm.resource === '*',
  );
}

/**
 * Convert permissions to a readable format
 *
 * @param permissions - Permissions to format
 * @returns Human-readable permission strings
 */
export function formatPermissions(permissions: Permission[]): string[] {
  return permissions.flatMap(perm =>
    perm.actions.map(action => `${action} ${perm.resource}`),
  );
}
