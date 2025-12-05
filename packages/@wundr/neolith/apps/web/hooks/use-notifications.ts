'use client';

/**
 * @neolith/hooks/use-notifications - Notification Management Hooks
 *
 * Provides hooks for managing in-app notifications, push notifications,
 * offline status, and notification preferences.
 *
 * @packageDocumentation
 * @module @neolith/hooks/use-notifications
 *
 * @example
 * ```typescript
 * // Basic notification usage
 * const { notifications, unreadCount, markAsRead } = useNotifications();
 *
 * // Push notification management
 * const { isSupported, requestPermission, subscribeToPush } = usePushNotifications();
 *
 * // Offline status and sync
 * const { isOnline, queuedActions, forceSync } = useOfflineStatus();
 *
 * // Notification settings
 * const { settings, updateSettings, muteChannel } = useNotificationSettings();
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import type {
  Notification as AppNotification,
  NotificationSettings,
  SyncStatus,
  QueuedAction,
  ConflictResolution,
} from '@/types/notification';

// ============================================================================
// useNotifications Hook
// ============================================================================

/**
 * Options for the useNotifications hook
 */
export interface UseNotificationsOptions {
  /** Whether to enable notification fetching */
  enabled?: boolean;
  /** Polling interval in milliseconds */
  pollInterval?: number;
}

/**
 * Return type for the useNotifications hook.
 * Provides notification data and methods for managing notifications.
 */
export interface UseNotificationsReturn {
  /** List of notifications sorted by creation time (newest first) */
  notifications: AppNotification[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Whether notifications are currently being fetched */
  isLoading: boolean;
  /** Error that occurred during fetch, or null if none */
  error: Error | null;
  /** Whether there are more notifications to load */
  hasMore: boolean;
  /** Mark a single notification as read by ID */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Dismiss (delete) a notification by ID */
  dismiss: (id: string) => Promise<void>;
  /** Load more notifications (pagination) */
  loadMore: () => Promise<void>;
  /** Refresh notifications from the beginning */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and managing user notifications.
 *
 * Provides paginated notification data with real-time polling,
 * along with methods for marking notifications as read or dismissing them.
 *
 * @param options - Configuration options for the hook
 * @returns Notification data and management methods
 *
 * @example
 * ```typescript
 * const {
 *   notifications,
 *   unreadCount,
 *   markAsRead,
 *   markAllAsRead,
 *   dismiss,
 *   loadMore,
 *   refresh
 * } = useNotifications({ pollInterval: 30000 });
 *
 * // Mark a notification as read
 * await markAsRead(notification.id);
 *
 * // Load more notifications
 * if (hasMore) await loadMore();
 * ```
 */
export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const { enabled = true, pollInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  // Type guard for notification type
  const isValidNotificationType = (
    type: string,
  ): type is AppNotification['type'] => {
    return ['message', 'mention', 'reaction', 'system'].includes(
      type.toLowerCase(),
    );
  };

  // Type guard for notification priority
  const isValidNotificationPriority = (
    priority: string,
  ): priority is AppNotification['priority'] => {
    return ['low', 'normal', 'high', 'urgent'].includes(priority.toLowerCase());
  };

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (refresh = false) => {
      if (!enabled) {
        return;
      }

      try {
        // Cancel any in-flight requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (!refresh && cursor) {
          params.set('page', cursor);
        }
        params.set('limit', '20');

        const response = await fetch(
          `/api/notifications?${params.toString()}`,
          {
            signal: abortControllerRef.current.signal,
          },
        );

        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }

        const result = await response.json();
        // API returns { data: [...], pagination: {...} }
        const notificationsData = result.data || [];
        const newNotifications = notificationsData.map(
          (n: AppNotification & { type: string; priority: string }) => {
            const normalizedType = n.type?.toLowerCase() || 'system';
            const normalizedPriority = n.priority?.toLowerCase() || 'normal';

            return {
              ...n,
              // Map database type to frontend type with validation
              type: isValidNotificationType(normalizedType)
                ? normalizedType
                : 'system',
              priority: isValidNotificationPriority(normalizedPriority)
                ? normalizedPriority
                : 'normal',
              createdAt: new Date(n.createdAt),
            };
          },
        );

        if (refresh) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }

        // Handle pagination
        const pagination = result.pagination;
        if (pagination) {
          setCursor(
            pagination.hasNextPage ? String(pagination.page + 1) : null,
          );
          setHasMore(pagination.hasNextPage);
        } else {
          setCursor(null);
          setHasMore(false);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, cursor],
  );

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetchNotifications(true);

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications(true);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Abort any in-flight requests on cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, pollInterval, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, []);

  // Dismiss notification
  const dismiss = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error dismissing notification:', err);
      throw err;
    }
  }, []);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return;
    }
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Refresh notifications
  const refresh = useCallback(async () => {
    setCursor(null);
    await fetchNotifications(true);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    loadMore,
    refresh,
  };
}

// ============================================================================
// usePushNotifications Hook
// ============================================================================

/**
 * Return type for the usePushNotifications hook.
 * Manages browser push notification permissions and subscriptions.
 */
export interface UsePushNotificationsReturn {
  /** Whether push notifications are supported in the current browser */
  isSupported: boolean;
  /** Whether push notifications are currently enabled for this user */
  isEnabled: boolean;
  /** Current notification permission state ('granted', 'denied', or 'default') */
  permission: NotificationPermission | null;
  /** Request notification permission from the user, returns true if granted */
  requestPermission: () => Promise<boolean>;
  /** Subscribe to push notifications after permission is granted */
  subscribeToPush: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribeFromPush: () => Promise<void>;
}

/**
 * Hook for managing browser push notifications.
 *
 * Handles permission requests, push subscription management,
 * and browser compatibility detection.
 *
 * @returns Push notification state and management methods
 *
 * @example
 * ```typescript
 * const {
 *   isSupported,
 *   isEnabled,
 *   permission,
 *   requestPermission,
 *   subscribeToPush,
 *   unsubscribeFromPush
 * } = usePushNotifications();
 *
 * // Request permission and subscribe
 * if (isSupported && !isEnabled) {
 *   const granted = await requestPermission();
 *   if (granted) {
 *     await subscribeToPush();
 *   }
 * }
 * ```
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );

  // Check support on mount
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      const granted = result === 'granted';
      setIsEnabled(granted);
      return granted;
    } catch {
      return false;
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!isSupported || !isEnabled) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Get the server's VAPID public key
      const response = await fetch('/api/notifications/vapid-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID key');
      }
      const { publicKey } = await response.json();

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const subscribeResponse = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!subscribeResponse.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
      throw err;
    }
  }, [isSupported, isEnabled]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (!isSupported) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        const response = await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        if (!response.ok) {
          throw new Error('Failed to notify server of unsubscription');
        }
      }

      setIsEnabled(false);
    } catch (err) {
      console.error('Error unsubscribing from push notifications:', err);
      throw err;
    }
  }, [isSupported]);

  return {
    isSupported,
    isEnabled,
    permission,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

// ============================================================================
// useOfflineStatus Hook
// ============================================================================

/**
 * Return type for the useOfflineStatus hook.
 * Manages offline state, action queuing, and sync conflict resolution.
 */
export interface UseOfflineStatusReturn {
  /** Whether the browser currently has network connectivity */
  isOnline: boolean;
  /** Number of actions queued for sync when back online */
  queuedActions: number;
  /** Current sync status: 'idle', 'syncing', 'synced', 'error', or 'conflict' */
  syncStatus: SyncStatus;
  /** List of conflicts that need manual resolution */
  conflicts: ConflictResolution[];
  /** Force sync all queued actions immediately */
  forceSync: () => Promise<void>;
  /** Resolve a sync conflict by choosing local, server, or merged data */
  resolveConflict: (
    id: string,
    resolution: 'local' | 'server' | 'merge'
  ) => Promise<void>;
  /** Queue an action to be synced when online */
  queueAction: (
    action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>
  ) => void;
}

const QUEUED_ACTIONS_KEY = 'neolith-queued-actions';

/**
 * Hook for managing offline status and action queuing.
 *
 * Detects network connectivity changes, queues actions while offline,
 * and handles sync conflict resolution when back online.
 *
 * @returns Offline status and sync management methods
 *
 * @example
 * ```typescript
 * const {
 *   isOnline,
 *   queuedActions,
 *   syncStatus,
 *   conflicts,
 *   forceSync,
 *   resolveConflict,
 *   queueAction
 * } = useOfflineStatus();
 *
 * // Queue an action while offline
 * if (!isOnline) {
 *   queueAction({
 *     type: 'message.create',
 *     payload: { content: 'Hello!' }
 *   });
 * }
 *
 * // Resolve a sync conflict
 * if (conflicts.length > 0) {
 *   await resolveConflict(conflicts[0].id, 'local');
 * }
 * ```
 */
export function useOfflineStatus(): UseOfflineStatusReturn {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);

  const syncInProgressRef = useRef(false);

  // Load queued actions from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUEUED_ACTIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setQueuedActions(
          parsed.map((a: QueuedAction) => ({
            ...a,
            createdAt: new Date(a.createdAt),
          })),
        );
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save queued actions to storage
  useEffect(() => {
    try {
      localStorage.setItem(QUEUED_ACTIONS_KEY, JSON.stringify(queuedActions));
    } catch {
      // Ignore storage errors
    }
  }, [queuedActions]);

  // Force sync queued actions
  const forceSync = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current || queuedActions.length === 0) {
      return;
    }

    syncInProgressRef.current = true;
    setSyncStatus('syncing');

    try {
      const actionsToSync = [...queuedActions];
      const failedActions: QueuedAction[] = [];
      const newConflicts: ConflictResolution[] = [];

      for (const action of actionsToSync) {
        try {
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action),
          });

          if (!response.ok) {
            const error = await response.json();

            if (response.status === 409) {
              // Conflict detected
              newConflicts.push({
                id: action.id,
                localData: action.payload,
                serverData: error.serverData,
                type: action.type,
                createdAt: new Date(),
              });
            } else if (action.retryCount < 3) {
              // Retry later
              failedActions.push({
                ...action,
                retryCount: action.retryCount + 1,
              });
            }
          }
        } catch {
          // Network error - retry later
          if (action.retryCount < 3) {
            failedActions.push({
              ...action,
              retryCount: action.retryCount + 1,
            });
          }
        }
      }

      setQueuedActions(failedActions);
      setConflicts(prev => [...prev, ...newConflicts]);

      if (newConflicts.length > 0) {
        setSyncStatus('conflict');
      } else if (failedActions.length > 0) {
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    } catch {
      setSyncStatus('error');
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isOnline, queuedActions]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      void forceSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [forceSync]);

  // Queue an action for offline sync
  const queueAction = useCallback(
    (action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>) => {
      const newAction: QueuedAction = {
        ...action,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        retryCount: 0,
      };

      setQueuedActions(prev => [...prev, newAction]);

      // Try to sync immediately if online
      if (isOnline) {
        void forceSync();
      }
    },
    [isOnline, forceSync],
  );

  // Resolve a conflict
  const resolveConflict = useCallback(
    async (id: string, resolution: 'local' | 'server' | 'merge') => {
      const conflict = conflicts.find(c => c.id === id);
      if (!conflict) {
        return;
      }

      try {
        const response = await fetch('/api/sync/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conflictId: id,
            resolution,
            localData: conflict.localData,
            serverData: conflict.serverData,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to resolve conflict');
        }

        setConflicts(prev => prev.filter(c => c.id !== id));

        // Update sync status
        if (conflicts.length === 1) {
          setSyncStatus('synced');
        }
      } catch (err) {
        console.error('Error resolving conflict:', err);
        throw err;
      }
    },
    [conflicts],
  );

  return {
    isOnline,
    queuedActions: queuedActions.length,
    syncStatus,
    conflicts,
    forceSync,
    resolveConflict,
    queueAction,
  };
}

// ============================================================================
// useNotificationSettings Hook
// ============================================================================

/**
 * Return type for the useNotificationSettings hook.
 * Manages user notification preferences and channel muting.
 */
export interface UseNotificationSettingsReturn {
  /** Current notification settings, or null if not loaded */
  settings: NotificationSettings | null;
  /** Whether settings are currently being fetched */
  isLoading: boolean;
  /** Error that occurred during fetch or update, or null if none */
  error: Error | null;
  /** Update notification settings with a partial settings object */
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  /** Mute notifications from a specific channel */
  muteChannel: (channelId: string) => Promise<void>;
  /** Unmute notifications from a specific channel */
  unmuteChannel: (channelId: string) => Promise<void>;
  /** Send a test notification to verify settings */
  sendTestNotification: () => Promise<void>;
}

/**
 * Hook for managing user notification preferences.
 *
 * Provides access to notification settings with optimistic updates
 * and convenient methods for muting/unmuting channels.
 *
 * @returns Notification settings and management methods
 *
 * @example
 * ```typescript
 * const {
 *   settings,
 *   isLoading,
 *   updateSettings,
 *   muteChannel,
 *   unmuteChannel,
 *   sendTestNotification
 * } = useNotificationSettings();
 *
 * // Update settings
 * await updateSettings({
 *   messages: true,
 *   mentions: true,
 *   digest: 'daily'
 * });
 *
 * // Mute a channel
 * await muteChannel(channelId);
 *
 * // Test notification delivery
 * await sendTestNotification();
 * ```
 */
export function useNotificationSettings(): UseNotificationSettingsReturn {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/notifications/settings');

        if (!response.ok) {
          throw new Error('Failed to fetch notification settings');
        }

        const data = await response.json();
        setSettings(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update settings
  const updateSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      if (!settings) {
        return;
      }

      const newSettings = { ...settings, ...updates };

      // Optimistic update
      setSettings(newSettings);

      try {
        const response = await fetch('/api/notifications/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          // Rollback on error
          setSettings(settings);
          throw new Error('Failed to update notification settings');
        }
      } catch (err) {
        setSettings(settings);
        console.error('Error updating settings:', err);
        throw err;
      }
    },
    [settings],
  );

  // Mute channel
  const muteChannel = useCallback(
    async (channelId: string) => {
      if (!settings) {
        return;
      }

      const newMuted = [...settings.mutedChannels, channelId];
      await updateSettings({ mutedChannels: newMuted });
    },
    [settings, updateSettings],
  );

  // Unmute channel
  const unmuteChannel = useCallback(
    async (channelId: string) => {
      if (!settings) {
        return;
      }

      const newMuted = settings.mutedChannels.filter(id => id !== channelId);
      await updateSettings({ mutedChannels: newMuted });
    },
    [settings, updateSettings],
  );

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      throw err;
    }
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    muteChannel,
    unmuteChannel,
    sendTestNotification,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a URL-safe Base64 string to a Uint8Array.
 * Used for converting VAPID public keys for push subscription.
 *
 * @param base64String - URL-safe Base64 encoded string
 * @returns Decoded Uint8Array suitable for use as BufferSource
 * @internal
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
