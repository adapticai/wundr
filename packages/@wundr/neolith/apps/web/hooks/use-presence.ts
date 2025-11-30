'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import type { PresenceStatus } from '@/components/presence/presence-indicator';
import type {
  DaemonHealthStatus,
  OrchestratorHealthMetrics,
  OrchestratorStatusData,
} from '@/components/presence/orchestrator-status-card';

// Types
export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  lastSeen: Date | null;
  updatedAt: Date;
}

export interface OrchestratorHealthStatus extends OrchestratorStatusData {
  organizationId: string;
}

// =============================================================================
// Hook Return Type Interfaces
// =============================================================================

/**
 * Return type for useUserPresence hook
 */
export type UseUserPresenceReturn = UserPresence | null;

/**
 * Return type for useMultiplePresence hook
 */
export type UseMultiplePresenceReturn = Map<string, UserPresence>;

/**
 * Return type for useChannelPresence hook
 */
export type UseChannelPresenceReturn = UserPresence[];

/**
 * Return type for useSetStatus hook
 */
export interface UseSetStatusReturn {
  /** Set the current user's presence status */
  setStatus: (status: PresenceStatus, customText?: string) => Promise<boolean>;
  /** Clear the current user's custom status */
  clearStatus: () => Promise<boolean>;
  /** Whether a status update is in progress */
  isUpdating: boolean;
}

/**
 * Return type for useOrchestratorHealth hook
 */
export type UseOrchestratorHealthReturn = OrchestratorHealthStatus | null;

/**
 * Return type for useOrchestratorHealthList hook
 */
export interface UseOrchestratorHealthListReturn {
  /** List of Orchestrator health statuses */
  orchestratorList: OrchestratorHealthStatus[];
  /** Whether the list is loading */
  isLoading: boolean;
  /** Refetch the Orchestrator health list */
  refetch: () => Promise<void>;
}

/**
 * Return type for usePresenceSubscription hook
 */
export interface UsePresenceSubscriptionReturn {
  /** Whether the subscription is connected */
  isConnected: boolean;
  /** Connection error if any */
  connectionError: Error | null;
}

// Configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PRESENCE_POLL_INTERVAL = 10000; // 10 seconds
const ORCHESTRATOR_HEALTH_POLL_INTERVAL = 15000; // 15 seconds
const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Hook for fetching a single user's presence
 * @param userId - The ID of the user to fetch presence for
 * @returns The user's presence data or null if not available
 */
export function useUserPresence(userId: string): UseUserPresenceReturn {
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const fetchPresence = async () => {
      try {
        timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT);

        const response = await fetch(`/api/presence/users/${userId}`, {
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          // API returns { data: { userId, status, customStatus, lastSeen, isOnline } }
          const data = json.data;
          if (data) {
            // Map API response status (uppercase) to PresenceStatus (lowercase)
            const statusMap: Record<string, PresenceStatus> = {
              'ONLINE': 'online',
              'OFFLINE': 'offline',
              'AWAY': 'away',
              'BUSY': 'busy',
              'DND': 'busy', // Map DND to busy since PresenceStatus doesn't have 'dnd'
            };
            setPresence({
              userId: data.userId,
              status: statusMap[data.status] || 'offline',
              customStatus: data.customStatus ?? undefined,
              lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
              updatedAt: new Date(),
            });
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        // Silently fail - presence is non-critical
        // AbortError is expected on cleanup
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Failed to fetch user presence:', error.message);
        }
      }
    };

    void fetchPresence();
    const interval = setInterval(() => void fetchPresence(), PRESENCE_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [userId]);

  return presence;
}

/**
 * Hook for fetching multiple users' presence
 * @param userIds - Array of user IDs to fetch presence for
 * @returns A map of user IDs to their presence data
 */
export function useMultiplePresence(userIds: string[]): UseMultiplePresenceReturn {
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const userIdsKey = useMemo(() => userIds.sort().join(','), [userIds]);

  useEffect(() => {
    if (userIds.length === 0) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const fetchPresence = async () => {
      try {
        timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT);

        const response = await fetch('/api/presence/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const newMap = new Map<string, UserPresence>();

          for (const item of data.presence) {
            newMap.set(item.userId, {
              ...item,
              lastSeen: item.lastSeen ? new Date(item.lastSeen) : null,
              updatedAt: new Date(item.updatedAt),
            });
          }

          setPresenceMap(newMap);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Failed to fetch multiple presence:', error.message);
        }
      }
    };

    void fetchPresence();
    const interval = setInterval(() => void fetchPresence(), PRESENCE_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [userIdsKey, userIds]);

  return presenceMap;
}

/**
 * Hook for fetching presence of all users in a channel
 * @param channelId - The ID of the channel to fetch presence for
 * @returns Array of presence data for all users in the channel
 */
export function useChannelPresence(channelId: string): UseChannelPresenceReturn {
  const [presenceList, setPresenceList] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const fetchPresence = async () => {
      try {
        timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT);

        const response = await fetch(`/api/channels/${channelId}/presence`, {
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setPresenceList(
            data.presence.map((item: UserPresence & { lastSeen: string; updatedAt: string }) => ({
              ...item,
              lastSeen: item.lastSeen ? new Date(item.lastSeen) : null,
              updatedAt: new Date(item.updatedAt),
            })),
          );
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Failed to fetch channel presence:', error.message);
        }
      }
    };

    void fetchPresence();
    const interval = setInterval(() => void fetchPresence(), PRESENCE_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [channelId]);

  return presenceList;
}

/**
 * Hook for setting the current user's status
 * @returns Methods for updating and clearing user status
 */
export function useSetStatus(): UseSetStatusReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const setStatus = useCallback(
    async (status: PresenceStatus, customText?: string): Promise<boolean> => {
      // Cancel any pending request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsUpdating(true);
      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), FETCH_TIMEOUT);

      try {
        const response = await fetch('/api/presence/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, customStatus: customText }),
          signal: abortControllerRef.current.signal,
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to set status:', error.message);
        }
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  const clearStatus = useCallback(async (): Promise<boolean> => {
    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsUpdating(true);
    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch('/api/presence/me/custom-status', {
        method: 'DELETE',
        signal: abortControllerRef.current.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to clear status:', error.message);
      }
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { setStatus, clearStatus, isUpdating };
}

/**
 * Hook for Orchestrator health status
 * @param orchestratorId - The ID of the Orchestrator to fetch health for
 * @returns The Orchestrator health status or null if not available
 */
export function useOrchestratorHealth(orchestratorId: string): UseOrchestratorHealthReturn {
  const [health, setHealth] = useState<OrchestratorHealthStatus | null>(null);

  useEffect(() => {
    if (!orchestratorId) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const fetchHealth = async () => {
      try {
        timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT);

        const response = await fetch(`/api/orchestrators/${orchestratorId}/health`, {
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setHealth({
            ...data,
            lastHeartbeat: data.lastHeartbeat ? new Date(data.lastHeartbeat) : null,
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Failed to fetch orchestrator health:', error.message);
        }
      }
    };

    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), ORCHESTRATOR_HEALTH_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [orchestratorId]);

  return health;
}

/**
 * Hook for listing all Orchestrator health statuses in a workspace
 * @param workspaceId - The ID of the workspace to fetch Orchestrator health for
 * @returns List of Orchestrator health statuses with loading state and refetch method
 */
export function useOrchestratorHealthList(workspaceId: string): UseOrchestratorHealthListReturn {
  const [orchestratorList, setOrchestratorList] = useState<OrchestratorHealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/orchestrators/health`, {
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setOrchestratorList(
          data.orchestrators.map((orchestrator: OrchestratorHealthStatus & { lastHeartbeat: string | null }) => ({
            ...orchestrator,
            lastHeartbeat: orchestrator.lastHeartbeat ? new Date(orchestrator.lastHeartbeat) : null,
          })),
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name !== 'AbortError') {
        console.debug('Failed to fetch orchestrator health list:', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), ORCHESTRATOR_HEALTH_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [fetchHealth]);

  return { orchestratorList, isLoading, refetch: fetchHealth };
}

/**
 * Hook for automatic heartbeat to maintain online presence
 */
export function usePresenceHeartbeat(enabled: boolean = true): void {
  const isEnabled = useRef(enabled);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isEnabled.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const sendHeartbeat = async () => {
      if (!isEnabled.current) {
        return;
      }

      // Cancel any pending heartbeat
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), FETCH_TIMEOUT);

      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          signal: abortControllerRef.current.signal,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug('Failed to send heartbeat:', error.message);
        }
      }
    };

    // Send initial heartbeat
    void sendHeartbeat();

    // Set up interval
    const interval = setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      abortControllerRef.current?.abort();
    };
  }, [enabled]);
}

/**
 * Hook for managing presence with WebSocket/SSE connection
 * @param channelId - The ID of the channel to subscribe to
 * @param onPresenceUpdate - Callback for presence updates
 * @returns Connection status and any connection errors
 */
export function usePresenceSubscription(
  channelId: string,
  onPresenceUpdate?: (presence: UserPresence) => void,
): UsePresenceSubscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);

  // Update callback ref without triggering reconnection
  useEffect(() => {
    onPresenceUpdateRef.current = onPresenceUpdate;
  }, [onPresenceUpdate]);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) {
        return;
      }

      // Clear any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(
        `/api/presence/stream?channelIds=${encodeURIComponent(channelId)}`,
      );

      eventSource.onopen = () => {
        if (!isMounted) {
          return;
        }
        setIsConnected(true);
        setConnectionError(null);
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          const presence: UserPresence = {
            ...data,
            lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
            updatedAt: new Date(data.updatedAt),
          };
          onPresenceUpdateRef.current?.(presence);
        } catch (error) {
          // Ignore parse errors
          console.debug('Failed to parse presence update:', error);
        }
      };

      eventSource.onerror = () => {
        if (!isMounted) {
          return;
        }

        setIsConnected(false);
        setConnectionError(new Error('Connection lost'));
        eventSource.close();

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) {
            connect();
          }
        }, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      eventSourceRef.current?.close();
    };
  }, [channelId]);

  return { isConnected, connectionError };
}

// Type exports
export type { PresenceStatus, DaemonHealthStatus, OrchestratorHealthMetrics };
