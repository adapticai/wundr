/**
 * useRealtimeSidebar Hook
 *
 * Subscribes to real-time sidebar updates via Server-Sent Events (SSE).
 * Updates channels and direct messages in real-time as changes occur.
 *
 * Features:
 * - Real-time channel updates (unread counts, new channels)
 * - Real-time DM updates (new messages, new conversations)
 * - Auto-reconnection on connection loss
 * - Heartbeat monitoring for connection health
 *
 * @module hooks/use-realtime-sidebar
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

import type { Channel, DirectMessageChannel } from '@/types/channel';

interface ChannelUpdate {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
}

interface DMUpdate {
  id: string;
  participants: Array<{
    id: string;
    user: {
      id: string;
      name: string;
      avatarUrl: string | null;
      status: string;
      isOrchestrator: boolean;
    };
  }>;
  lastMessage: {
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
    };
  } | null;
  updatedAt: string;
  createdAt: string;
  isSelfDM: boolean;
  isGroupDM: boolean;
  unreadCount: number;
  isStarred: boolean;
}

interface UseRealtimeSidebarOptions {
  /** Workspace slug to subscribe to */
  workspaceSlug: string;
  /** Initial channels from server-side fetch */
  initialChannels?: Channel[];
  /** Initial DMs from server-side fetch */
  initialDirectMessages?: DirectMessageChannel[];
  /** Callback when channels are updated */
  onChannelsUpdate?: (channels: Channel[]) => void;
  /** Callback when DMs are updated */
  onDirectMessagesUpdate?: (dms: DirectMessageChannel[]) => void;
  /** Whether to enable realtime updates (can be disabled for testing) */
  enabled?: boolean;
}

interface UseRealtimeSidebarReturn {
  /** Current channels with real-time updates */
  channels: Channel[];
  /** Current DMs with real-time updates */
  directMessages: DirectMessageChannel[];
  /** Starred channels with real-time updates */
  starredChannels: Channel[];
  /** Starred DMs with real-time updates */
  starredDMs: DirectMessageChannel[];
  /** Whether the SSE connection is active */
  isConnected: boolean;
  /** Last error if any */
  error: Error | null;
  /** Manually reconnect the SSE stream */
  reconnect: () => void;
  /** Optimistically update channel star status */
  updateChannelStarStatus: (
    channelId: string,
    isStarred: boolean,
    channel?: Channel
  ) => void;
  /** Optimistically update DM star status */
  updateDMStarStatus: (
    dmId: string,
    isStarred: boolean,
    dm?: DirectMessageChannel
  ) => void;
}

/**
 * Transform SSE channel update to Channel type
 */
function transformChannelUpdate(update: ChannelUpdate): Channel {
  return {
    id: update.id,
    name: update.name,
    description: update.description ?? undefined,
    type: update.type as 'public' | 'private' | 'direct',
    workspaceId: '', // Not provided in SSE update
    createdAt: new Date(update.createdAt),
    updatedAt: new Date(update.updatedAt),
    createdById: '',
    members: [],
    memberCount: 0,
    unreadCount: update.unreadCount,
    isArchived: update.isArchived,
    isStarred: update.isStarred,
  };
}

/**
 * Map status string to valid User status type
 */
function mapStatus(
  status: string,
): 'online' | 'offline' | 'away' | 'busy' | undefined {
  if (
    status === 'online' ||
    status === 'offline' ||
    status === 'away' ||
    status === 'busy'
  ) {
    return status;
  }
  return undefined;
}

/**
 * Transform SSE DM update to DirectMessageChannel type
 */
function transformDMUpdate(update: DMUpdate): DirectMessageChannel {
  return {
    id: update.id,
    participants: update.participants.map(p => ({
      id: p.id,
      user: {
        id: p.user.id,
        name: p.user.name,
        email: '',
        image: p.user.avatarUrl,
        status: mapStatus(p.user.status),
      },
      isOrchestrator: p.user.isOrchestrator,
    })),
    lastMessage: update.lastMessage
      ? {
          content: update.lastMessage.content,
          createdAt: new Date(update.lastMessage.createdAt),
          author: {
            id: update.lastMessage.author.id,
            name: update.lastMessage.author.name,
            email: '',
          },
        }
      : undefined,
    unreadCount: update.unreadCount,
    isStarred: update.isStarred,
    isSelfDM: update.isSelfDM,
    isGroupDM: update.isGroupDM,
    createdAt: new Date(update.createdAt),
    updatedAt: new Date(update.updatedAt),
  };
}

/**
 * Hook for subscribing to real-time sidebar updates
 *
 * @param options - Configuration options
 * @returns Real-time sidebar state and controls
 *
 * @example
 * ```tsx
 * const { channels, directMessages, isConnected } = useRealtimeSidebar({
 *   workspaceSlug: 'my-workspace',
 *   initialChannels: serverChannels,
 *   initialDirectMessages: serverDMs,
 * });
 * ```
 */
export function useRealtimeSidebar({
  workspaceSlug,
  initialChannels = [],
  initialDirectMessages = [],
  onChannelsUpdate,
  onDirectMessagesUpdate,
  enabled = true,
}: UseRealtimeSidebarOptions): UseRealtimeSidebarReturn {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageChannel[]>(
    [],
  );
  const [starredChannels, setStarredChannels] = useState<Channel[]>([]);
  const [starredDMs, setStarredDMs] = useState<DirectMessageChannel[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Store callbacks in refs to avoid dependency issues
  const onChannelsUpdateRef = useRef(onChannelsUpdate);
  const onDirectMessagesUpdateRef = useRef(onDirectMessagesUpdate);

  useEffect(() => {
    onChannelsUpdateRef.current = onChannelsUpdate;
  }, [onChannelsUpdate]);

  useEffect(() => {
    onDirectMessagesUpdateRef.current = onDirectMessagesUpdate;
  }, [onDirectMessagesUpdate]);

  // Initialize channels from props only once (when they first become available)
  useEffect(() => {
    if (!hasInitialized && initialChannels.length > 0) {
      setChannels(initialChannels);
      setHasInitialized(true);
    }
  }, [initialChannels, hasInitialized]);

  // Initialize DMs from props only once (when they first become available)
  useEffect(() => {
    if (!hasInitialized && initialDirectMessages.length > 0) {
      setDirectMessages(initialDirectMessages);
    }
  }, [initialDirectMessages, hasInitialized]);

  const connect = useCallback(() => {
    if (!enabled || !workspaceSlug) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/workspaces/${workspaceSlug}/sidebar/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptRef.current = 0;
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Exponential backoff for reconnection (max 30 seconds)
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        30000,
      );
      reconnectAttemptRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    // Handle connected event
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Realtime Sidebar] Connected:', data);
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing connected event:', e);
      }
    });

    // Handle sidebar init (initial channel state)
    eventSource.addEventListener('sidebar:init', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const newChannels = data.channels.map(transformChannelUpdate);
        setChannels(prev => {
          // Merge with existing channels, preferring SSE data for unread counts
          const merged = [...prev];
          for (const newChannel of newChannels) {
            const existingIndex = merged.findIndex(c => c.id === newChannel.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = {
                ...merged[existingIndex],
                unreadCount: newChannel.unreadCount,
              };
            }
          }
          return merged;
        });
        onChannelsUpdateRef.current?.(newChannels);
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing sidebar:init:', e);
      }
    });

    // Handle DMs init (initial DM state)
    eventSource.addEventListener('dms:init', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const newDMs = data.directMessages.map(transformDMUpdate);
        setDirectMessages(prev => {
          // Merge with existing DMs, preferring SSE data
          const merged = [...prev];
          for (const newDM of newDMs) {
            const existingIndex = merged.findIndex(d => d.id === newDM.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = {
                ...merged[existingIndex],
                unreadCount: newDM.unreadCount,
                lastMessage:
                  newDM.lastMessage || merged[existingIndex].lastMessage,
              };
            }
          }
          return merged;
        });
        onDirectMessagesUpdateRef.current?.(newDMs);
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing dms:init:', e);
      }
    });

    // Handle channel update
    eventSource.addEventListener('channel:update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const updatedChannel = transformChannelUpdate(data.channel);
        setChannels(prev => {
          const index = prev.findIndex(c => c.id === updatedChannel.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...prev[index], ...updatedChannel };
            onChannelsUpdateRef.current?.(updated);
            return updated;
          }
          return prev;
        });
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing channel:update:', e);
      }
    });

    // Handle channel created
    eventSource.addEventListener('channel:created', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const newChannel = transformChannelUpdate(data.channel);
        setChannels(prev => {
          // Check if channel already exists
          if (prev.some(c => c.id === newChannel.id)) {
            return prev;
          }
          const updated = [...prev, newChannel].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          onChannelsUpdateRef.current?.(updated);
          return updated;
        });
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing channel:created:', e);
      }
    });

    // Handle channel deleted
    eventSource.addEventListener('channel:deleted', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setChannels(prev => {
          const updated = prev.filter(c => c.id !== data.channelId);
          onChannelsUpdateRef.current?.(updated);
          return updated;
        });
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing channel:deleted:', e);
      }
    });

    // Handle DM update
    eventSource.addEventListener('dm:update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const updatedDM = transformDMUpdate(data.dm);
        setDirectMessages(prev => {
          const index = prev.findIndex(d => d.id === updatedDM.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...prev[index], ...updatedDM };
            // Re-sort by most recent activity
            updated.sort((a, b) => {
              const aDate =
                a.lastMessage?.createdAt || a.updatedAt || a.createdAt;
              const bDate =
                b.lastMessage?.createdAt || b.updatedAt || b.createdAt;
              if (!aDate && !bDate) {
                return 0;
              }
              if (!aDate) {
                return 1;
              }
              if (!bDate) {
                return -1;
              }
              return new Date(bDate).getTime() - new Date(aDate).getTime();
            });
            onDirectMessagesUpdateRef.current?.(updated);
            return updated;
          }
          return prev;
        });
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing dm:update:', e);
      }
    });

    // Handle DM created
    eventSource.addEventListener('dm:created', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const newDM = transformDMUpdate(data.dm);
        setDirectMessages(prev => {
          // Check if DM already exists
          if (prev.some(d => d.id === newDM.id)) {
            return prev;
          }
          // Add to beginning (most recent)
          const updated = [newDM, ...prev];
          onDirectMessagesUpdateRef.current?.(updated);
          return updated;
        });
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing dm:created:', e);
      }
    });

    // Handle starred:init (initial starred state)
    eventSource.addEventListener('starred:init', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const starred = data.starredChannels?.map(transformChannelUpdate) ?? [];
        const starredDms = data.starredDMs?.map(transformDMUpdate) ?? [];
        setStarredChannels(starred);
        setStarredDMs(starredDms);
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing starred:init:', e);
      }
    });

    // Handle starred:update (starred status changed)
    eventSource.addEventListener('starred:update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { type, id, isStarred } = data;

        if (type === 'channel' && data.channel) {
          const updatedChannel = transformChannelUpdate(data.channel);
          if (isStarred) {
            // Add to starred channels
            setStarredChannels(prev => {
              if (prev.some(c => c.id === id)) {
                return prev.map(c => (c.id === id ? updatedChannel : c));
              }
              return [...prev, updatedChannel].sort((a, b) =>
                a.name.localeCompare(b.name),
              );
            });
          } else {
            // Remove from starred channels
            setStarredChannels(prev => prev.filter(c => c.id !== id));
          }
          // Also update the channel in the channels list
          setChannels(prev =>
            prev.map(c => (c.id === id ? { ...c, isStarred } : c)),
          );
        } else if (type === 'dm' && data.dm) {
          const updatedDM = transformDMUpdate(data.dm);
          if (isStarred) {
            // Add to starred DMs
            setStarredDMs(prev => {
              if (prev.some(d => d.id === id)) {
                return prev.map(d => (d.id === id ? updatedDM : d));
              }
              return [updatedDM, ...prev];
            });
          } else {
            // Remove from starred DMs
            setStarredDMs(prev => prev.filter(d => d.id !== id));
          }
          // Also update the DM in the directMessages list
          setDirectMessages(prev =>
            prev.map(d => (d.id === id ? { ...d, isStarred } : d)),
          );
        }
      } catch (e) {
        console.error('[Realtime Sidebar] Error parsing starred:update:', e);
      }
    });

    // Handle heartbeat
    eventSource.addEventListener('heartbeat', () => {
      // Connection is still alive
    });

    // Handle error events from server
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setError(new Error(data.error || 'Unknown error'));
      } catch {
        // Non-JSON error, handled by onerror
      }
    });
  }, [enabled, workspaceSlug]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  // Optimistic update for channel star status
  const updateChannelStarStatus = useCallback(
    (channelId: string, isStarred: boolean, channel?: Channel) => {
      console.log('[useRealtimeSidebar] updateChannelStarStatus called:', {
        channelId,
        isStarred,
        hasChannel: !!channel,
      });
      if (isStarred) {
        // Add to starred channels
        setStarredChannels(prev => {
          console.log(
            '[useRealtimeSidebar] Adding to starred, prev count:',
            prev.length,
          );
          if (prev.some(c => c.id === channelId)) {
            console.log(
              '[useRealtimeSidebar] Channel already starred, skipping',
            );
            return prev;
          }
          // Find the channel from channels list or use provided channel
          const channelToAdd =
            channel || channels.find(c => c.id === channelId);
          console.log(
            '[useRealtimeSidebar] Channel to add:',
            channelToAdd?.name,
          );
          if (channelToAdd) {
            const newList = [
              ...prev,
              { ...channelToAdd, isStarred: true },
            ].sort((a, b) => a.name.localeCompare(b.name));
            console.log(
              '[useRealtimeSidebar] New starred count:',
              newList.length,
            );
            return newList;
          }
          console.log('[useRealtimeSidebar] No channel found to add');
          return prev;
        });
      } else {
        // Remove from starred channels
        setStarredChannels(prev => {
          console.log(
            '[useRealtimeSidebar] Removing from starred, prev count:',
            prev.length,
          );
          const newList = prev.filter(c => c.id !== channelId);
          console.log(
            '[useRealtimeSidebar] New starred count after removal:',
            newList.length,
          );
          return newList;
        });
      }
      // Also update the channel in the channels list
      setChannels(prev =>
        prev.map(c => (c.id === channelId ? { ...c, isStarred } : c)),
      );
    },
    [channels],
  );

  // Optimistic update for DM star status
  const updateDMStarStatus = useCallback(
    (dmId: string, isStarred: boolean, dm?: DirectMessageChannel) => {
      if (isStarred) {
        // Add to starred DMs
        setStarredDMs(prev => {
          if (prev.some(d => d.id === dmId)) {
            return prev;
          }
          // Find the DM from directMessages list or use provided dm
          const dmToAdd = dm || directMessages.find(d => d.id === dmId);
          if (dmToAdd) {
            return [{ ...dmToAdd, isStarred: true }, ...prev];
          }
          return prev;
        });
      } else {
        // Remove from starred DMs
        setStarredDMs(prev => prev.filter(d => d.id !== dmId));
      }
      // Also update the DM in the directMessages list
      setDirectMessages(prev =>
        prev.map(d => (d.id === dmId ? { ...d, isStarred } : d)),
      );
    },
    [directMessages],
  );

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    channels,
    directMessages,
    starredChannels,
    starredDMs,
    isConnected,
    error,
    reconnect,
    updateChannelStarStatus,
    updateDMStarStatus,
  };
}
