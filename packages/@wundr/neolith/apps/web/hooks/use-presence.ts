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

    const fetchPresence = async () => {
      try {
        const response = await fetch(`/api/presence/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setPresence({
            ...data,
            lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
            updatedAt: new Date(data.updatedAt),
          });
        }
      } catch {
        // Silently fail - presence is non-critical
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, PRESENCE_POLL_INTERVAL);

    return () => clearInterval(interval);
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

    const fetchPresence = async () => {
      try {
        const response = await fetch('/api/presence/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });

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
      } catch {
        // Silently fail
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, PRESENCE_POLL_INTERVAL);

    return () => clearInterval(interval);
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

    const fetchPresence = async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/presence`);
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
      } catch {
        // Silently fail
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, PRESENCE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [channelId]);

  return presenceList;
}

/**
 * Hook for setting the current user's status
 * @returns Methods for updating and clearing user status
 */
export function useSetStatus(): UseSetStatusReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const setStatus = useCallback(
    async (status: PresenceStatus, customText?: string): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetch('/api/presence/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, customStatus: customText }),
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  const clearStatus = useCallback(async (): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/presence/me/custom-status', {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
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

    const fetchHealth = async () => {
      try {
        const response = await fetch(`/api/orchestrators/${orchestratorId}/health`);
        if (response.ok) {
          const data = await response.json();
          setHealth({
            ...data,
            lastHeartbeat: data.lastHeartbeat ? new Date(data.lastHeartbeat) : null,
          });
        }
      } catch {
        // Silently fail
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, ORCHESTRATOR_HEALTH_POLL_INTERVAL);

    return () => clearInterval(interval);
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

  const fetchHealth = useCallback(async () => {
    if (!workspaceId) {
return;
}

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/orchestrators/health`);
      if (response.ok) {
        const data = await response.json();
        setOrchestratorList(
          data.orchestrators.map((orchestrator: OrchestratorHealthStatus & { lastHeartbeat: string | null }) => ({
            ...orchestrator,
            lastHeartbeat: orchestrator.lastHeartbeat ? new Date(orchestrator.lastHeartbeat) : null,
          })),
        );
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, ORCHESTRATOR_HEALTH_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return { orchestratorList, isLoading, refetch: fetchHealth };
}

/**
 * Hook for automatic heartbeat to maintain online presence
 */
export function usePresenceHeartbeat(enabled: boolean = true): void {
  const isEnabled = useRef(enabled);

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

      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
        });
      } catch {
        // Silently fail
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  useEffect(() => {
    if (!channelId) {
return;
}

    const connect = () => {
      const eventSource = new EventSource(
        `/api/presence/stream?channelIds=${channelId}`,
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const presence: UserPresence = {
            ...data,
            lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
            updatedAt: new Date(data.updatedAt),
          };
          onPresenceUpdate?.(presence);
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setConnectionError(new Error('Connection lost'));
        eventSource.close();

        // Attempt to reconnect after 5 seconds
        setTimeout(connect, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [channelId, onPresenceUpdate]);

  return { isConnected, connectionError };
}

// Type exports
export type { PresenceStatus, DaemonHealthStatus, OrchestratorHealthMetrics };
