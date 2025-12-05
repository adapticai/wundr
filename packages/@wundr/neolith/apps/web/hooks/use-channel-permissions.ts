'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ChannelPermissions } from '@/types/channel';

/**
 * Return type for the useChannelPermissions hook
 */
export interface UseChannelPermissionsReturn {
  /** User permissions for the channel */
  permissions: ChannelPermissions;
  /** Whether permissions are loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch permissions */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching user permissions in a channel
 *
 * Fetches comprehensive permissions from the API including:
 * - canPost, canRead - Posting and interaction permissions
 * - canInvite, canKick - Member management permissions
 * - canEditChannel, canDelete, canArchive - Channel management permissions
 * - canDeleteMessages, canPin - Message management permissions
 * - canChangeRoles - Role management permissions
 * - isOwner, isAdmin, isMember - Role indicators
 *
 * @param channelId - ID of the channel to fetch permissions for
 * @returns Permissions object with loading state and refetch function
 *
 * @example
 * ```tsx
 * function ChannelSettings({ channelId }: { channelId: string }) {
 *   const { permissions, isLoading } = useChannelPermissions(channelId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {permissions.canEditChannel && <EditButton />}
 *       {permissions.canInvite && <InviteButton />}
 *       {permissions.canDelete && <DeleteButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useChannelPermissions(
  channelId: string
): UseChannelPermissionsReturn {
  // Default permissions state (all false for security)
  const defaultPermissions: ChannelPermissions = {
    canPost: false,
    canRead: false,
    canInvite: false,
    canKick: false,
    canRemoveMembers: false,
    canEditChannel: false,
    canEdit: false,
    canDelete: false,
    canArchive: false,
    canDeleteMessages: false,
    canPin: false,
    canChangeRoles: false,
    isOwner: false,
    isAdmin: false,
    isMember: false,
    role: null,
  };

  const [permissions, setPermissions] =
    useState<ChannelPermissions>(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!channelId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();

    try {
      const response = await fetch(`/api/channels/${channelId}/permissions`, {
        signal: abortController.signal,
        // Add cache control to leverage browser caching
        cache: 'no-cache',
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch permissions' }));
        throw new Error(
          errorData.error || errorData.message || 'Failed to fetch permissions'
        );
      }

      const data: ChannelPermissions = await response.json();
      setPermissions(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }

      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);

      // Default to no permissions on error for security
      setPermissions(defaultPermissions);
    } finally {
      setIsLoading(false);
      abortController.abort();
    }
  }, [channelId, defaultPermissions]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    isLoading,
    error,
    refetch: fetchPermissions,
  };
}
