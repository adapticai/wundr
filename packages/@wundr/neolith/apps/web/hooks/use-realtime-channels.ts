/**
 * useRealtimeChannels Hook
 *
 * Subscribes to real-time channel updates using SWR with automatic revalidation.
 * Provides live updates for channel list including typing indicators and member counts.
 *
 * Features:
 * - Real-time channel updates via SWR polling (15-30s interval)
 * - Typing indicators for active channels
 * - Online member count tracking
 * - Automatic deduplication and change detection
 * - New channel notifications
 * - Optimistic updates support
 *
 * @module hooks/use-realtime-channels
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { Channel } from '@/types/channel';

// =============================================================================
// Types
// =============================================================================

/**
 * Typing indicator for a channel
 */
export interface ChannelTypingIndicator {
  channelId: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

/**
 * Online members count for a channel
 */
export interface ChannelOnlineStatus {
  channelId: string;
  onlineCount: number;
  totalCount: number;
  lastUpdated: Date;
}

/**
 * Extended channel data with real-time information
 */
export interface RealtimeChannel extends Channel {
  /** Users currently typing in this channel */
  typingUsers?: ChannelTypingIndicator[];
  /** Online member count */
  onlineStatus?: ChannelOnlineStatus;
  /** Whether this channel has new updates since last view */
  hasNewActivity?: boolean;
}

/**
 * Configuration options for the hook
 */
export interface UseRealtimeChannelsOptions {
  /** Workspace ID to subscribe to */
  workspaceId: string;
  /** Initial channels from server-side fetch */
  initialChannels?: Channel[];
  /** Polling interval in milliseconds (default: 20000 = 20s) */
  pollingInterval?: number;
  /** Whether to enable realtime updates */
  enabled?: boolean;
  /** Callback when new channels are detected */
  onNewChannels?: (newChannels: Channel[]) => void;
  /** Callback when channels are deleted */
  onChannelsDeleted?: (deletedIds: string[]) => void;
  /** Whether to fetch typing indicators */
  includeTyping?: boolean;
  /** Whether to fetch online member counts */
  includeOnlineStatus?: boolean;
}

/**
 * Return type for the hook
 */
export interface UseRealtimeChannelsReturn {
  /** Channels with real-time data */
  channels: RealtimeChannel[];
  /** Public channels (excluding starred) */
  publicChannels: RealtimeChannel[];
  /** Private channels (excluding starred) */
  privateChannels: RealtimeChannel[];
  /** Starred channels */
  starredChannels: RealtimeChannel[];
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether a background refresh is in progress */
  isRefreshing: boolean;
  /** Last error if any */
  error: Error | null;
  /** Number of new channels since last view */
  newChannelCount: number;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Clear new channel indicator */
  clearNewChannels: () => void;
}

// =============================================================================
// API Response Types
// =============================================================================

interface ChannelApiResponse {
  id: string;
  name: string;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  createdById: string;
  memberCount?: number;
  unreadCount?: number;
  isStarred?: boolean;
  isArchived?: boolean;
  lastMessage?: {
    content: string;
    createdAt: string;
    author: {
      id: string;
      name?: string;
      displayName?: string;
      email?: string;
      image?: string;
      avatarUrl?: string;
      status?: string;
    };
  };
  members?: Array<{
    id: string;
    userId: string;
    joinedAt: string;
    role?: string;
    user: {
      id: string;
      displayName?: string;
      name?: string;
      email?: string;
      avatarUrl?: string;
      image?: string;
      status?: string;
    };
  }>;
  [key: string]: unknown;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform API response to frontend Channel type
 */
function transformChannel(apiChannel: ChannelApiResponse): Channel {
  return {
    id: apiChannel.id,
    name: apiChannel.name,
    description: apiChannel.description,
    type: apiChannel.type?.toLowerCase() as Channel['type'],
    workspaceId: apiChannel.workspaceId,
    createdById: apiChannel.createdById,
    createdAt: new Date(apiChannel.createdAt),
    updatedAt: new Date(apiChannel.updatedAt),
    memberCount: apiChannel.memberCount ?? apiChannel.members?.length ?? 0,
    unreadCount: apiChannel.unreadCount ?? 0,
    isStarred: apiChannel.isStarred,
    isArchived: apiChannel.isArchived,
    lastMessage: apiChannel.lastMessage
      ? {
          content: apiChannel.lastMessage.content,
          createdAt: new Date(apiChannel.lastMessage.createdAt),
          author: {
            id: apiChannel.lastMessage.author.id,
            name:
              apiChannel.lastMessage.author.displayName ||
              apiChannel.lastMessage.author.name ||
              'Unknown',
            email: apiChannel.lastMessage.author.email || '',
            image:
              apiChannel.lastMessage.author.avatarUrl ||
              apiChannel.lastMessage.author.image,
            status:
              (apiChannel.lastMessage.author.status as
                | 'online'
                | 'offline'
                | 'away'
                | 'busy') || 'offline',
          },
        }
      : undefined,
    members: (apiChannel.members || []).map(m => ({
      id: m.id,
      userId: m.userId,
      channelId: apiChannel.id,
      role: (m.role?.toLowerCase() as 'admin' | 'member') || 'member',
      joinedAt: new Date(m.joinedAt),
      user: {
        id: m.user.id,
        name: m.user.displayName || m.user.name || 'Unknown',
        image: m.user.avatarUrl || m.user.image,
        email: m.user.email || '',
        status:
          (m.user.status as 'online' | 'offline' | 'away' | 'busy') ||
          'offline',
      },
    })),
  };
}

/**
 * Calculate online member count from channel members
 */
function calculateOnlineStatus(channel: Channel): ChannelOnlineStatus {
  const onlineStatuses = ['online', 'busy', 'away'];
  const onlineCount = channel.members.filter(m =>
    onlineStatuses.includes(m.user.status || '')
  ).length;

  return {
    channelId: channel.id,
    onlineCount,
    totalCount: channel.memberCount || channel.members.length,
    lastUpdated: new Date(),
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for real-time channel updates
 *
 * @param options - Configuration options
 * @returns Real-time channel state and controls
 *
 * @example
 * ```tsx
 * const {
 *   channels,
 *   publicChannels,
 *   privateChannels,
 *   isLoading,
 *   newChannelCount,
 *   clearNewChannels
 * } = useRealtimeChannels({
 *   workspaceId: 'workspace-123',
 *   pollingInterval: 20000,
 *   includeTyping: true,
 *   includeOnlineStatus: true,
 *   onNewChannels: (newChannels) => {
 *     console.log('New channels:', newChannels);
 *   }
 * });
 * ```
 */
export function useRealtimeChannels({
  workspaceId,
  initialChannels = [],
  pollingInterval = 20000, // 20 seconds
  enabled = true,
  onNewChannels,
  onChannelsDeleted,
  includeTyping = true,
  includeOnlineStatus = true,
}: UseRealtimeChannelsOptions): UseRealtimeChannelsReturn {
  // State
  const [newChannelCount, setNewChannelCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs
  const previousChannelIdsRef = useRef<Set<string>>(new Set());
  const onNewChannelsRef = useRef(onNewChannels);
  const onChannelsDeletedRef = useRef(onChannelsDeleted);

  // Update callback refs
  useEffect(() => {
    onNewChannelsRef.current = onNewChannels;
    onChannelsDeletedRef.current = onChannelsDeleted;
  }, [onNewChannels, onChannelsDeleted]);

  // SWR fetcher
  const fetcher = useCallback(
    async (url: string): Promise<Channel[]> => {
      if (!enabled || !workspaceId) {
        return initialChannels;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch channels' }));
        throw new Error(
          errorData.error || errorData.message || 'Failed to fetch channels'
        );
      }

      const result: ApiResponse<ChannelApiResponse[]> = await response.json();
      const channelsData = result.data || [];

      return channelsData.map(transformChannel);
    },
    [enabled, workspaceId, initialChannels]
  );

  // SWR hook for automatic revalidation
  const { data, error, isLoading, isValidating, mutate } = useSWR<Channel[]>(
    enabled && workspaceId ? `/api/workspaces/${workspaceId}/channels` : null,
    fetcher,
    {
      fallbackData: initialChannels,
      refreshInterval: enabled ? pollingInterval : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Prevent duplicate requests within 5s
      onSuccess: data => {
        setIsRefreshing(false);
      },
      onError: err => {
        setIsRefreshing(false);
        console.error('[useRealtimeChannels] Error:', err);
      },
    }
  );

  const channels = data || initialChannels;

  // Detect channel changes
  useEffect(() => {
    if (!channels.length) {
      return;
    }

    const currentChannelIds = new Set(channels.map(c => c.id));

    // Initialize on first load
    if (previousChannelIdsRef.current.size === 0) {
      previousChannelIdsRef.current = currentChannelIds;
      return;
    }

    // Detect new channels
    const newChannels = channels.filter(
      c => !previousChannelIdsRef.current.has(c.id)
    );

    if (newChannels.length > 0) {
      setNewChannelCount(prev => prev + newChannels.length);
      onNewChannelsRef.current?.(newChannels);
    }

    // Detect deleted channels
    const deletedIds = Array.from(previousChannelIdsRef.current).filter(
      id => !currentChannelIds.has(id)
    );

    if (deletedIds.length > 0) {
      onChannelsDeletedRef.current?.(deletedIds);
    }

    previousChannelIdsRef.current = currentChannelIds;
  }, [channels]);

  // Update isRefreshing state
  useEffect(() => {
    if (isValidating && !isLoading) {
      setIsRefreshing(true);
    }
  }, [isValidating, isLoading]);

  // Enhance channels with real-time data
  const realtimeChannels = useMemo((): RealtimeChannel[] => {
    return channels.map(channel => {
      const enhanced: RealtimeChannel = { ...channel };

      // Add online status if enabled
      if (
        includeOnlineStatus &&
        channel.members &&
        channel.members.length > 0
      ) {
        enhanced.onlineStatus = calculateOnlineStatus(channel);
      }

      // Add typing indicators if enabled (placeholder for now)
      if (includeTyping) {
        enhanced.typingUsers = [];
      }

      return enhanced;
    });
  }, [channels, includeOnlineStatus, includeTyping]);

  // Categorize channels
  const { publicChannels, privateChannels, starredChannels } = useMemo(() => {
    const starred = realtimeChannels.filter(c => c.isStarred);
    const publicCh = realtimeChannels.filter(
      c => c.type === 'public' && !c.isStarred
    );
    const privateCh = realtimeChannels.filter(
      c => c.type === 'private' && !c.isStarred
    );

    return {
      starredChannels: starred,
      publicChannels: publicCh,
      privateChannels: privateCh,
    };
  }, [realtimeChannels]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await mutate();
  }, [mutate]);

  // Clear new channel count
  const clearNewChannels = useCallback(() => {
    setNewChannelCount(0);
  }, []);

  return {
    channels: realtimeChannels,
    publicChannels,
    privateChannels,
    starredChannels,
    isLoading,
    isRefreshing,
    error: error as Error | null,
    newChannelCount,
    refresh,
    clearNewChannels,
  };
}
