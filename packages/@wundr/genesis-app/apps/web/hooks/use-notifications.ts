'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import type {
  Notification,
  NotificationSettings,
  SyncStatus,
  QueuedAction,
  ConflictResolution,
} from '@/types/notification';

// ============================================================================
// useNotifications Hook
// ============================================================================

interface UseNotificationsOptions {
  enabled?: boolean;
  pollInterval?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { enabled = true, pollInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (refresh = false) => {
      if (!enabled) return;

      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (!refresh && cursor) {
          params.set('cursor', cursor);
        }
        params.set('limit', '20');

        const response = await fetch(`/api/notifications?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }

        const data = await response.json();
        const newNotifications = data.notifications.map((n: Notification) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));

        if (refresh) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }

        setCursor(data.nextCursor || null);
        setHasMore(!!data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, cursor]
  );

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    fetchNotifications(true);

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications(true);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
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

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
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

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
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

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  }, []);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
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

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isEnabled: boolean;
  permission: NotificationPermission | null;
  requestPermission: () => Promise<boolean>;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

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
    if (!isSupported) return false;

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
    if (!isSupported || !isEnabled) return;

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
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
    }
  }, [isSupported, isEnabled]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (!isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsEnabled(false);
    } catch (err) {
      console.error('Error unsubscribing from push notifications:', err);
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

interface UseOfflineStatusReturn {
  isOnline: boolean;
  queuedActions: number;
  syncStatus: SyncStatus;
  conflicts: ConflictResolution[];
  forceSync: () => Promise<void>;
  resolveConflict: (id: string, resolution: 'local' | 'server' | 'merge') => Promise<void>;
  queueAction: (action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>) => void;
}

const QUEUED_ACTIONS_KEY = 'genesis-queued-actions';

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
          }))
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

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      forceSync();
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
  }, []);

  // Queue an action for offline sync
  const queueAction = useCallback(
    (action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>) => {
      const newAction: QueuedAction = {
        ...action,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        retryCount: 0,
      };

      setQueuedActions((prev) => [...prev, newAction]);

      // Try to sync immediately if online
      if (isOnline) {
        forceSync();
      }
    },
    [isOnline]
  );

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
      setConflicts((prev) => [...prev, ...newConflicts]);

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

  // Resolve a conflict
  const resolveConflict = useCallback(
    async (id: string, resolution: 'local' | 'server' | 'merge') => {
      const conflict = conflicts.find((c) => c.id === id);
      if (!conflict) return;

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

        if (response.ok) {
          setConflicts((prev) => prev.filter((c) => c.id !== id));

          // Update sync status
          if (conflicts.length === 1) {
            setSyncStatus('synced');
          }
        }
      } catch (err) {
        console.error('Error resolving conflict:', err);
      }
    },
    [conflicts]
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

interface UseNotificationSettingsReturn {
  settings: NotificationSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  muteChannel: (channelId: string) => Promise<void>;
  unmuteChannel: (channelId: string) => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

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
      if (!settings) return;

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
      }
    },
    [settings]
  );

  // Mute channel
  const muteChannel = useCallback(
    async (channelId: string) => {
      if (!settings) return;

      const newMuted = [...settings.mutedChannels, channelId];
      await updateSettings({ mutedChannels: newMuted });
    },
    [settings, updateSettings]
  );

  // Unmute channel
  const unmuteChannel = useCallback(
    async (channelId: string) => {
      if (!settings) return;

      const newMuted = settings.mutedChannels.filter((id) => id !== channelId);
      await updateSettings({ mutedChannels: newMuted });
    },
    [settings, updateSettings]
  );

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error sending test notification:', err);
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
