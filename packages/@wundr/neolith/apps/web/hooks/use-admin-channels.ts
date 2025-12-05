'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';

// =============================================================================
// Types
// =============================================================================

/**
 * Channel type enum
 */
export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';

/**
 * Channel information with analytics
 */
export interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  type: ChannelType;
  isArchived: boolean;
  settings: Record<string, unknown>;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  totalMessages: number;
  activeMembers: number;
  recentMessages: number;
}

/**
 * Channel default settings
 */
export interface ChannelDefaults {
  autoJoinPublic: boolean;
  defaultType: ChannelType;
  allowMemberCreation: boolean;
  requireApproval: boolean;
  maxChannelsPerUser: number;
  notificationDefaults: {
    muteByDefault: boolean;
    desktopNotifications: boolean;
    emailNotifications: boolean;
  };
}

/**
 * Bulk operation type
 */
export type BulkOperation =
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'change_visibility';

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: 'Failed to fetch' }));
    throw new Error(
      errorData.message || `HTTP ${res.status}: ${res.statusText}`
    );
  }
  return res.json() as Promise<T>;
};

// =============================================================================
// useAdminChannels Hook
// =============================================================================

export interface UseAdminChannelsOptions {
  type?: ChannelType;
  archived?: boolean;
  search?: string;
  limit?: number;
}

export interface UseAdminChannelsReturn {
  channels: ChannelInfo[];
  total: number;
  isLoading: boolean;
  error?: Error;
  createChannel: (data: {
    name: string;
    description?: string;
    type?: ChannelType;
    settings?: Record<string, unknown>;
  }) => Promise<ChannelInfo>;
  updateChannel: (
    channelId: string,
    updates: Partial<ChannelInfo>
  ) => Promise<ChannelInfo>;
  deleteChannel: (channelId: string) => Promise<void>;
  bulkOperation: (
    channelIds: string[],
    operation: BulkOperation,
    data?: { type?: ChannelType }
  ) => Promise<void>;
  refresh: () => void;
}

/**
 * Hook for managing workspace channels
 *
 * @param workspaceSlug - The workspace slug
 * @param options - Optional filtering options
 * @returns Channels data and management functions
 */
export function useAdminChannels(
  workspaceSlug: string,
  options: UseAdminChannelsOptions = {}
): UseAdminChannelsReturn {
  const queryParams = new URLSearchParams();
  if (options.type) {
    queryParams.set('type', options.type);
  }
  if (options.archived !== undefined) {
    queryParams.set('archived', String(options.archived));
  }
  if (options.search) {
    queryParams.set('search', options.search);
  }
  if (options.limit) {
    queryParams.set('limit', String(options.limit));
  }

  const { data, error, isLoading, mutate } = useSWR<{
    channels: ChannelInfo[];
    total: number;
  }>(`/api/workspaces/${workspaceSlug}/admin/channels?${queryParams}`, fetcher);

  const createChannel = useCallback(
    async (channelData: {
      name: string;
      description?: string;
      type?: ChannelType;
      settings?: Record<string, unknown>;
    }): Promise<ChannelInfo> => {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/channels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(channelData),
        }
      );
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: 'Failed to create channel' }));
        throw new Error(error.message || 'Failed to create channel');
      }
      const created = (await res.json()) as ChannelInfo;
      await mutate();
      return created;
    },
    [workspaceSlug, mutate]
  );

  const updateChannel = useCallback(
    async (
      channelId: string,
      updates: Partial<ChannelInfo>
    ): Promise<ChannelInfo> => {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/channels/${channelId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: 'Failed to update channel' }));
        throw new Error(error.message || 'Failed to update channel');
      }
      const updated = (await res.json()) as ChannelInfo;
      await mutate();
      return updated;
    },
    [workspaceSlug, mutate]
  );

  const deleteChannel = useCallback(
    async (channelId: string) => {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/channels/${channelId}`,
        {
          method: 'DELETE',
        }
      );
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: 'Failed to delete channel' }));
        throw new Error(error.message || 'Failed to delete channel');
      }
      await mutate();
    },
    [workspaceSlug, mutate]
  );

  const bulkOperation = useCallback(
    async (
      channelIds: string[],
      operation: BulkOperation,
      data?: { type?: ChannelType }
    ) => {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/channels/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelIds, operation, data }),
        }
      );
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: 'Failed to perform bulk operation' }));
        throw new Error(error.message || 'Failed to perform bulk operation');
      }
      await mutate();
    },
    [workspaceSlug, mutate]
  );

  return {
    channels: data?.channels ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | undefined,
    createChannel,
    updateChannel,
    deleteChannel,
    bulkOperation,
    refresh: () => void mutate(),
  };
}

// =============================================================================
// useChannelDefaults Hook
// =============================================================================

export interface UseChannelDefaultsReturn {
  defaults: ChannelDefaults | null;
  isLoading: boolean;
  error?: Error;
  updateDefaults: (updates: Partial<ChannelDefaults>) => Promise<void>;
}

/**
 * Hook for managing default channel settings
 *
 * @param workspaceSlug - The workspace slug
 * @returns Default settings and update function
 */
export function useChannelDefaults(
  workspaceSlug: string
): UseChannelDefaultsReturn {
  const { data, error, isLoading, mutate } = useSWR<{
    defaults: ChannelDefaults;
  }>(`/api/workspaces/${workspaceSlug}/admin/channels/defaults`, fetcher);

  const updateDefaults = useCallback(
    async (updates: Partial<ChannelDefaults>) => {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/channels/defaults`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaults: updates }),
        }
      );
      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ message: 'Failed to update defaults' }));
        throw new Error(error.message || 'Failed to update defaults');
      }
      await mutate();
    },
    [workspaceSlug, mutate]
  );

  return {
    defaults: data?.defaults ?? null,
    isLoading,
    error: error as Error | undefined,
    updateDefaults,
  };
}
