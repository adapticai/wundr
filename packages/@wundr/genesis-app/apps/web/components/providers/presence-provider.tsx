'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import type { ReactNode } from 'react';
import type { PresenceStatus } from '@/components/presence/presence-indicator';

// Types
interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  lastSeen: Date | null;
  updatedAt: Date;
}

interface PresenceContextValue {
  // Current user's presence
  currentUserPresence: UserPresence | null;
  setStatus: (status: PresenceStatus) => Promise<void>;
  setCustomStatus: (text: string) => Promise<void>;
  clearCustomStatus: () => Promise<void>;

  // Other users' presence
  getPresence: (userId: string) => UserPresence | undefined;
  subscribeToPresence: (userIds: string[]) => void;
  unsubscribeFromPresence: (userIds: string[]) => void;

  // Connection state
  isConnected: boolean;
  reconnect: () => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

// Configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface PresenceProviderProps {
  children: ReactNode;
  userId?: string;
  enabled?: boolean;
}

export function PresenceProvider({
  children,
  userId,
  enabled = true,
}: PresenceProviderProps) {
  const [currentUserPresence, setCurrentUserPresence] = useState<UserPresence | null>(
    null,
  );
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedUserIds, setSubscribedUserIds] = useState<Set<string>>(new Set());

  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send heartbeat to maintain presence
  const sendHeartbeat = useCallback(async () => {
    if (!userId || !enabled) return;

    try {
      const response = await fetch('/api/presence/heartbeat', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUserPresence({
          userId,
          status: data.status,
          customStatus: data.customStatus,
          lastSeen: null,
          updatedAt: new Date(),
        });
      }
    } catch {
      // Silently fail - presence is non-critical
    }
  }, [userId, enabled]);

  // Set user status
  const setStatus = useCallback(
    async (status: PresenceStatus) => {
      if (!userId) return;

      try {
        const response = await fetch('/api/presence/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (response.ok) {
          setCurrentUserPresence((prev) =>
            prev ? { ...prev, status, updatedAt: new Date() } : null,
          );
        }
      } catch {
        // Silently fail
      }
    },
    [userId],
  );

  // Set custom status text
  const setCustomStatus = useCallback(
    async (text: string) => {
      if (!userId) return;

      try {
        const response = await fetch('/api/presence/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customStatus: text }),
        });

        if (response.ok) {
          setCurrentUserPresence((prev) =>
            prev ? { ...prev, customStatus: text, updatedAt: new Date() } : null,
          );
        }
      } catch {
        // Silently fail
      }
    },
    [userId],
  );

  // Clear custom status
  const clearCustomStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/presence/me/custom-status', {
        method: 'DELETE',
      });

      if (response.ok) {
        setCurrentUserPresence((prev) =>
          prev ? { ...prev, customStatus: undefined, updatedAt: new Date() } : null,
        );
      }
    } catch {
      // Silently fail
    }
  }, [userId]);

  // Get presence for a specific user
  const getPresence = useCallback(
    (targetUserId: string): UserPresence | undefined => {
      if (targetUserId === userId) {
        return currentUserPresence ?? undefined;
      }
      return presenceMap.get(targetUserId);
    },
    [userId, currentUserPresence, presenceMap],
  );

  // Subscribe to presence updates for specific users
  const subscribeToPresence = useCallback((userIds: string[]) => {
    setSubscribedUserIds((prev) => {
      const next = new Set(prev);
      for (const id of userIds) {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Unsubscribe from presence updates
  const unsubscribeFromPresence = useCallback((userIds: string[]) => {
    setSubscribedUserIds((prev) => {
      const next = new Set(prev);
      for (const id of userIds) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Connect to presence SSE stream
  const connect = useCallback(() => {
    if (!userId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/presence/subscribe');

    eventSource.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'presence_update') {
          const presence: UserPresence = {
            userId: data.userId,
            status: data.status,
            customStatus: data.customStatus,
            lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
            updatedAt: new Date(data.updatedAt),
          };

          if (data.userId === userId) {
            setCurrentUserPresence(presence);
          } else {
            setPresenceMap((prev) => {
              const next = new Map(prev);
              next.set(data.userId, presence);
              return next;
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    eventSourceRef.current = eventSource;
  }, [userId, enabled]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Fetch presence for subscribed users
  useEffect(() => {
    if (subscribedUserIds.size === 0) return;

    const fetchPresence = async () => {
      try {
        const response = await fetch('/api/presence/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: Array.from(subscribedUserIds) }),
        });

        if (response.ok) {
          const data = await response.json();
          setPresenceMap((prev) => {
            const next = new Map(prev);
            for (const item of data.presence) {
              next.set(item.userId, {
                ...item,
                lastSeen: item.lastSeen ? new Date(item.lastSeen) : null,
                updatedAt: new Date(item.updatedAt),
              });
            }
            return next;
          });
        }
      } catch {
        // Silently fail
      }
    };

    fetchPresence();
  }, [subscribedUserIds]);

  // Set up heartbeat and connection
  useEffect(() => {
    if (!userId || !enabled) return;

    // Initial heartbeat and connection
    sendHeartbeat();
    connect();

    // Set up heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        if (!isConnected) {
          connect();
        }
      }
    };

    // Handle before unload - mark as offline
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/presence/offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Mark as offline
      fetch('/api/presence/offline', { method: 'POST' }).catch(() => {});
    };
  }, [userId, enabled, sendHeartbeat, connect, isConnected]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      currentUserPresence,
      setStatus,
      setCustomStatus,
      clearCustomStatus,
      getPresence,
      subscribeToPresence,
      unsubscribeFromPresence,
      isConnected,
      reconnect,
    }),
    [
      currentUserPresence,
      setStatus,
      setCustomStatus,
      clearCustomStatus,
      getPresence,
      subscribeToPresence,
      unsubscribeFromPresence,
      isConnected,
      reconnect,
    ],
  );

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  );
}

/**
 * Hook to access presence context
 */
export function usePresenceContext(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresenceContext must be used within a PresenceProvider');
  }
  return context;
}

/**
 * Hook for components that optionally use presence
 * Returns null if outside provider instead of throwing
 */
export function useOptionalPresenceContext(): PresenceContextValue | null {
  return useContext(PresenceContext);
}
