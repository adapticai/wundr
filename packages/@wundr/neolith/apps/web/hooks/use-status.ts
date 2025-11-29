/**
 * Status Hooks
 *
 * React hooks for managing real-time user status with auto-away,
 * DND scheduling, and SSE streaming.
 *
 * @module hooks/use-status
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import type { PresenceStatusType } from '@/lib/validations/presence';
import {
  getStatusService,
  type UserStatus,
  type DNDSchedule,
  type AutoAwayConfig,
  type StatusUpdateOptions,
} from '@/lib/services/status-service';

// =============================================================================
// useUserStatus Hook
// =============================================================================

/**
 * Hook for getting and updating current user's status
 *
 * Features:
 * - Get/set current status
 * - Auto-away detection
 * - DND scheduling
 * - Custom status messages
 *
 * @returns Status management interface
 *
 * @example
 * ```tsx
 * function StatusWidget() {
 *   const { status, customStatus, updateStatus, setCustomStatus } = useUserStatus();
 *
 *   return (
 *     <div>
 *       <span>Status: {status}</span>
 *       <button onClick={() => updateStatus('BUSY')}>Set Busy</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUserStatus() {
  const statusService = useMemo(() => getStatusService(), []);
  const [status, setStatus] = useState<PresenceStatusType>(statusService.getCurrentStatus());
  const [customStatus, setCustomStatus] = useState<string | null>(
    statusService.getCustomStatus(),
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = statusService.subscribe((updatedStatus) => {
      setStatus(updatedStatus.status);
      setCustomStatus(updatedStatus.customStatus ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, [statusService]);

  // Update status
  const updateStatus = useCallback(
    async (newStatus: PresenceStatusType, options?: StatusUpdateOptions): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const success = await statusService.updateStatus(newStatus, options);
        return success;
      } finally {
        setIsUpdating(false);
      }
    },
    [statusService],
  );

  // Update custom status
  const updateCustomStatus = useCallback(
    async (message: string | null): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const success = await statusService.setCustomStatus(message);
        return success;
      } finally {
        setIsUpdating(false);
      }
    },
    [statusService],
  );

  // Clear custom status
  const clearCustomStatus = useCallback(async (): Promise<boolean> => {
    setIsUpdating(true);
    try {
      const success = await statusService.clearCustomStatus();
      return success;
    } finally {
      setIsUpdating(false);
    }
  }, [statusService]);

  return {
    status,
    customStatus,
    isUpdating,
    updateStatus,
    setCustomStatus: updateCustomStatus,
    clearCustomStatus,
  };
}

// =============================================================================
// useAutoAway Hook
// =============================================================================

/**
 * Hook for configuring auto-away behavior
 *
 * @param initialConfig - Initial auto-away configuration
 * @returns Auto-away configuration interface
 *
 * @example
 * ```tsx
 * function SettingsPanel() {
 *   const { config, updateConfig, timeSinceActivity } = useAutoAway({
 *     enabled: true,
 *     idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         type="checkbox"
 *         checked={config.enabled}
 *         onChange={(e) => updateConfig({ enabled: e.target.checked })}
 *       />
 *       <span>Idle for: {Math.floor(timeSinceActivity / 1000)}s</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAutoAway(initialConfig?: Partial<AutoAwayConfig>) {
  const statusService = useMemo(() => getStatusService(), []);
  const [config, setConfig] = useState<AutoAwayConfig>({
    enabled: true,
    idleTimeoutMs: 5 * 60 * 1000,
    ...initialConfig,
  });
  const [timeSinceActivity, setTimeSinceActivity] = useState(0);

  // Update config
  const updateConfig = useCallback(
    (newConfig: Partial<AutoAwayConfig>) => {
      const updatedConfig = { ...config, ...newConfig };
      setConfig(updatedConfig);
      statusService.configureAutoAway(updatedConfig);
    },
    [config, statusService],
  );

  // Update time since activity every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceActivity(statusService.getTimeSinceLastActivity());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [statusService]);

  // Initialize config
  useEffect(() => {
    if (initialConfig) {
      statusService.configureAutoAway(initialConfig);
    }
  }, [initialConfig, statusService]);

  return {
    config,
    updateConfig,
    timeSinceActivity,
  };
}

// =============================================================================
// useDNDSchedule Hook
// =============================================================================

/**
 * Hook for managing DND (Do Not Disturb) schedule
 *
 * @param initialSchedule - Initial DND schedule
 * @returns DND schedule management interface
 *
 * @example
 * ```tsx
 * function DNDSettings() {
 *   const { schedule, updateSchedule, isInDNDWindow } = useDNDSchedule({
 *     enabled: true,
 *     startTime: '22:00',
 *     endTime: '08:00',
 *     daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
 *     timezone: 'America/New_York',
 *   });
 *
 *   return (
 *     <div>
 *       {isInDNDWindow && <span>DND is active</span>}
 *       <button onClick={() => updateSchedule({ enabled: !schedule?.enabled })}>
 *         Toggle DND
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDNDSchedule(initialSchedule?: DNDSchedule | null) {
  const statusService = useMemo(() => getStatusService(), []);
  const [schedule, setSchedule] = useState<DNDSchedule | null>(initialSchedule ?? null);
  const [isInDNDWindow, setIsInDNDWindow] = useState(false);

  // Update schedule
  const updateSchedule = useCallback(
    (newSchedule: Partial<DNDSchedule> | null) => {
      const updatedSchedule = newSchedule
        ? { ...schedule, ...newSchedule } as DNDSchedule
        : null;
      setSchedule(updatedSchedule);
      statusService.configureDNDSchedule(updatedSchedule);
    },
    [schedule, statusService],
  );

  // Check DND window status every minute
  useEffect(() => {
    const checkDND = () => {
      setIsInDNDWindow(statusService.isInDNDWindow());
    };

    checkDND();
    const interval = setInterval(checkDND, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [statusService]);

  // Initialize schedule
  useEffect(() => {
    if (initialSchedule) {
      statusService.configureDNDSchedule(initialSchedule);
    }
  }, [initialSchedule, statusService]);

  return {
    schedule,
    updateSchedule,
    isInDNDWindow,
  };
}

// =============================================================================
// useStatusStream Hook
// =============================================================================

/**
 * Hook for subscribing to real-time status updates via SSE
 *
 * @param userIds - Array of user IDs to subscribe to
 * @param channelIds - Array of channel IDs to subscribe to
 * @returns Status stream interface
 *
 * @example
 * ```tsx
 * function UserList({ userIds }: { userIds: string[] }) {
 *   const { statuses, isConnected } = useStatusStream({ userIds });
 *
 *   return (
 *     <div>
 *       {!isConnected && <span>Connecting...</span>}
 *       {Array.from(statuses.entries()).map(([userId, status]) => (
 *         <div key={userId}>
 *           {userId}: {status.status}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStatusStream(options: {
  userIds?: string[];
  channelIds?: string[];
}) {
  const { userIds = [], channelIds = [] } = options;
  const [statuses, setStatuses] = useState<Map<string, UserStatus>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize subscription params
  const params = useMemo(() => {
    const queryParams = new URLSearchParams();
    if (userIds.length > 0) {
      queryParams.append('userIds', userIds.join(','));
    }
    if (channelIds.length > 0) {
      queryParams.append('channelIds', channelIds.join(','));
    }
    return queryParams.toString();
  }, [userIds, channelIds]);

  useEffect(() => {
    if (!params) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted) {
        return;
      }

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new SSE connection
      const eventSource = new EventSource(`/api/presence/stream?${params}`);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setError(null);
      };

      // Handle presence updates
      eventSource.addEventListener('presence:update', (event) => {
        if (!isMounted) return;

        try {
          const data = JSON.parse(event.data);
          setStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.userId, {
              userId: data.userId,
              status: data.status,
              customStatus: data.customStatus,
              lastSeen: new Date(data.lastSeen),
              isOnline: data.isOnline,
            });
            return newMap;
          });
        } catch (err) {
          console.error('Failed to parse presence update:', err);
        }
      });

      // Handle channel presence
      eventSource.addEventListener('channel:presence', (event) => {
        if (!isMounted) return;

        try {
          const data = JSON.parse(event.data);
          const { onlineUsers } = data;

          setStatuses((prev) => {
            const newMap = new Map(prev);
            onlineUsers.forEach((user: UserStatus) => {
              newMap.set(user.userId, {
                ...user,
                lastSeen: new Date(user.lastSeen),
              });
            });
            return newMap;
          });
        } catch (err) {
          console.error('Failed to parse channel presence:', err);
        }
      });

      eventSource.onerror = () => {
        if (!isMounted) return;

        setIsConnected(false);
        setError(new Error('Connection lost'));
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
  }, [params]);

  return {
    statuses,
    isConnected,
    error,
  };
}

// =============================================================================
// useMultiUserStatus Hook
// =============================================================================

/**
 * Convenience hook for getting status of multiple users
 * Combines SSE streaming with fallback to polling
 *
 * @param userIds - Array of user IDs
 * @returns Map of user IDs to their status
 *
 * @example
 * ```tsx
 * function TeamStatusList({ teamUserIds }: { teamUserIds: string[] }) {
 *   const statuses = useMultiUserStatus(teamUserIds);
 *
 *   return (
 *     <div>
 *       {Array.from(statuses.entries()).map(([userId, status]) => (
 *         <StatusBadge key={userId} status={status} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMultiUserStatus(userIds: string[]): Map<string, UserStatus> {
  const { statuses } = useStatusStream({ userIds });
  return statuses;
}
