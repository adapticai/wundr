'use client';

/**
 * Hook for managing workspace users in admin panel
 * @module hooks/admin/use-admin-users
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';

import type { AdminUser, PaginatedUsers, UserFilters } from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for useAdminUsers hook
 */
export interface UseAdminUsersReturn {
  /** List of users */
  users: AdminUser[];
  /** Pagination info */
  pagination: PaginatedUsers['pagination'] | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Update filters */
  setFilters: (filters: UserFilters) => void;
  /** Current filters */
  filters: UserFilters;
  /** Manually refresh users */
  refresh: () => Promise<void>;
  /** Update a user's details */
  updateUser: (userId: string, updates: Partial<AdminUser>) => Promise<void>;
  /** Suspend a user */
  suspendUser: (userId: string, reason?: string) => Promise<void>;
  /** Unsuspend a user */
  unsuspendUser: (userId: string) => Promise<void>;
  /** Delete a user */
  deleteUser: (userId: string) => Promise<void>;
  /** Bulk update users */
  bulkUpdate: (userIds: string[], updates: Partial<AdminUser>) => Promise<void>;
  /** Whether any action is in progress */
  isUpdating: boolean;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Fetcher function with error handling
 */
const usersFetcher = async (url: string): Promise<PaginatedUsers> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to fetch users');
  }

  const result = await res.json();
  const data = result.data || result;

  // Transform date strings to Date objects
  if (data.users) {
    data.users = data.users.map((user: AdminUser) => ({
      ...user,
      createdAt: new Date(user.createdAt),
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : null,
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
    }));
  }

  return data as PaginatedUsers;
};

// =============================================================================
// Hook: useAdminUsers
// =============================================================================

/**
 * Hook for managing workspace users in admin panel
 *
 * Provides comprehensive user management including filtering, pagination,
 * and CRUD operations with optimistic updates.
 *
 * @param workspaceId - The workspace ID
 * @param initialFilters - Initial filter values
 * @returns Users data and management functions
 *
 * @example
 * ```tsx
 * function UsersManagementPage() {
 *   const {
 *     users,
 *     pagination,
 *     isLoading,
 *     filters,
 *     setFilters,
 *     updateUser,
 *     suspendUser,
 *     deleteUser,
 *   } = useAdminUsers('workspace-123', { status: 'active', limit: 20 });
 *
 *   return (
 *     <div>
 *       <UserFilters filters={filters} onChange={setFilters} />
 *       <UserTable
 *         users={users}
 *         onUpdate={updateUser}
 *         onSuspend={suspendUser}
 *         onDelete={deleteUser}
 *       />
 *       <Pagination {...pagination} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminUsers(
  workspaceId: string,
  initialFilters: UserFilters = {},
): UseAdminUsersReturn {
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 20,
    ...initialFilters,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Build query params from filters
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.roleId) queryParams.set('roleId', filters.roleId);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.set('sortOrder', filters.sortOrder);
  queryParams.set('page', String(filters.page ?? 1));
  queryParams.set('limit', String(filters.limit ?? 20));

  const url = `/api/workspaces/${workspaceId}/admin/users?${queryParams}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedUsers>(url, usersFetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // Manual refresh
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Update user
  const updateUser = useCallback(
    async (userId: string, updates: Partial<AdminUser>) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`/api/workspaces/${workspaceId}/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to update user');
        }

        // Optimistic update
        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update user');
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaceId, mutate]
  );

  // Suspend user
  const suspendUser = useCallback(
    async (userId: string, reason?: string) => {
      try {
        setIsUpdating(true);

        const res = await fetch(
          `/api/workspaces/${workspaceId}/admin/users/${userId}/suspend`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          }
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to suspend user');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to suspend user');
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaceId, mutate]
  );

  // Unsuspend user
  const unsuspendUser = useCallback(
    async (userId: string) => {
      try {
        setIsUpdating(true);

        const res = await fetch(
          `/api/workspaces/${workspaceId}/admin/users/${userId}/unsuspend`,
          {
            method: 'POST',
          }
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to unsuspend user');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to unsuspend user');
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaceId, mutate]
  );

  // Delete user
  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`/api/workspaces/${workspaceId}/admin/users/${userId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to delete user');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to delete user');
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaceId, mutate]
  );

  // Bulk update
  const bulkUpdate = useCallback(
    async (userIds: string[], updates: Partial<AdminUser>) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`/api/workspaces/${workspaceId}/admin/users/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, updates }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || 'Failed to bulk update users');
        }

        await mutate();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to bulk update users');
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaceId, mutate]
  );

  return {
    users: data?.users ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    error: error as Error | null,
    setFilters,
    filters,
    refresh,
    updateUser,
    suspendUser,
    unsuspendUser,
    deleteUser,
    bulkUpdate,
    isUpdating,
  };
}
