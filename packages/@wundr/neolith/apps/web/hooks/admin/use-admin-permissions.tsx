'use client';

/**
 * Hook for checking and managing admin permissions
 * @module hooks/admin/use-admin-permissions
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import type {
  Permission,
  PermissionAction,
  PermissionCheckResult,
  PermissionResource,
  BulkPermissionCheckResult,
} from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * User permission data
 */
export interface UserPermissions {
  /** User's role ID */
  roleId: string;
  /** Role name */
  roleName: string;
  /** List of granted permissions */
  permissions: Permission[];
  /** Whether user is workspace owner */
  isOwner: boolean;
  /** Whether user is admin */
  isAdmin: boolean;
}

/**
 * Return type for useAdminPermissions hook
 */
export interface UseAdminPermissionsReturn {
  /** User's permissions */
  permissions: UserPermissions | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Check if user has a specific permission */
  can: (resource: PermissionResource, action: PermissionAction) => boolean;
  /** Check multiple permissions at once */
  canMultiple: (checks: Array<{ resource: PermissionResource; action: PermissionAction }>) => BulkPermissionCheckResult;
  /** Check if user has any of the specified permissions */
  canAny: (checks: Array<{ resource: PermissionResource; action: PermissionAction }>) => boolean;
  /** Check if user has all of the specified permissions */
  canAll: (checks: Array<{ resource: PermissionResource; action: PermissionAction }>) => boolean;
  /** Manually refresh permissions */
  refresh: () => Promise<void>;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Fetcher function with error handling
 */
const permissionsFetcher = async (url: string): Promise<UserPermissions> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to fetch permissions');
  }

  const result = await res.json();
  return (result.data || result) as UserPermissions;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a specific permission is granted
 */
function hasPermission(
  permissions: Permission[] | undefined,
  resource: PermissionResource,
  action: PermissionAction,
  isOwner: boolean,
): boolean {
  // Owners have all permissions
  if (isOwner) return true;

  if (!permissions || permissions.length === 0) return false;

  // Check for wildcard permission
  const wildcardPerm = permissions.find(p => p.resource === '*');
  if (wildcardPerm && wildcardPerm.actions.includes('*')) return true;

  // Check for specific resource with wildcard action
  const resourcePerm = permissions.find(p => p.resource === resource);
  if (resourcePerm && resourcePerm.actions.includes('*')) return true;

  // Check for specific permission
  if (resourcePerm && resourcePerm.actions.includes(action)) return true;

  return false;
}

// =============================================================================
// Hook: useAdminPermissions
// =============================================================================

/**
 * Hook for checking and managing admin permissions
 *
 * Provides granular permission checking with support for wildcard permissions,
 * role-based access control, and optimized bulk permission checks.
 *
 * @param workspaceId - The workspace ID
 * @param userId - The user ID to check permissions for (defaults to current user)
 * @returns User permissions and checking functions
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { can, canMultiple, isLoading } = useAdminPermissions('workspace-123');
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <div>
 *       {can('user', 'create') && (
 *         <Button>Create User</Button>
 *       )}
 *       {can('settings', 'update') && (
 *         <SettingsPanel />
 *       )}
 *       {can('billing', 'manage') && (
 *         <BillingSection />
 *       )}
 *     </div>
 *   );
 * }
 *
 * @example
 * ```tsx
 * // Bulk permission checking
 * const checks = canMultiple([
 *   { resource: 'user', action: 'create' },
 *   { resource: 'user', action: 'delete' },
 *   { resource: 'settings', action: 'update' },
 * ]);
 *
 * if (checks['user:create'].granted) {
 *   // User can create
 * }
 * ```
 */
export function useAdminPermissions(
  workspaceId: string,
  userId?: string,
): UseAdminPermissionsReturn {
  const url = userId
    ? `/api/workspaces/${workspaceId}/admin/permissions?userId=${userId}`
    : `/api/workspaces/${workspaceId}/admin/permissions`;

  const { data, error, isLoading, mutate } = useSWR<UserPermissions>(
    url,
    permissionsFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Single permission check
  const can = useCallback(
    (resource: PermissionResource, action: PermissionAction): boolean => {
      if (!data) return false;
      return hasPermission(data.permissions, resource, action, data.isOwner);
    },
    [data]
  );

  // Multiple permission checks
  const canMultiple = useCallback(
    (checks: Array<{ resource: PermissionResource; action: PermissionAction }>): BulkPermissionCheckResult => {
      const results: BulkPermissionCheckResult = {};

      checks.forEach(({ resource, action }) => {
        const key = `${resource}:${action}`;
        const granted = can(resource, action);
        results[key] = {
          granted,
          reason: granted ? undefined : 'Permission denied',
        };
      });

      return results;
    },
    [can]
  );

  // Check if user has ANY of the specified permissions
  const canAny = useCallback(
    (checks: Array<{ resource: PermissionResource; action: PermissionAction }>): boolean => {
      return checks.some(({ resource, action }) => can(resource, action));
    },
    [can]
  );

  // Check if user has ALL of the specified permissions
  const canAll = useCallback(
    (checks: Array<{ resource: PermissionResource; action: PermissionAction }>): boolean => {
      return checks.every(({ resource, action }) => can(resource, action));
    },
    [can]
  );

  return {
    permissions: data ?? null,
    isLoading,
    error: error as Error | null,
    can,
    canMultiple,
    canAny,
    canAll,
    refresh,
  };
}

/**
 * Permission guard component helper
 *
 * @example
 * ```tsx
 * function ProtectedButton() {
 *   const { can } = useAdminPermissions('workspace-123');
 *
 *   return (
 *     <PermissionGuard
 *       can={can}
 *       resource="user"
 *       action="delete"
 *       fallback={<div>No permission</div>}
 *     >
 *       <Button danger>Delete User</Button>
 *     </PermissionGuard>
 *   );
 * }
 * ```
 */
export interface PermissionGuardProps {
  can: (resource: PermissionResource, action: PermissionAction) => boolean;
  resource: PermissionResource;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  can,
  resource,
  action,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const hasPermission = useMemo(
    () => can(resource, action),
    [can, resource, action]
  );

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
