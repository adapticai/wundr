/**
 * Desktop Notifications Hook
 * Hook for managing browser desktop notifications with permission handling
 * @module hooks/use-desktop-notifications
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface DesktopNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: unknown;
  requireInteraction?: boolean;
  silent?: boolean;
  onClick?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export interface UseDesktopNotificationsReturn {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (
    options: DesktopNotificationOptions
  ) => Promise<Notification | null>;
  isPermissionGranted: boolean;
  isPermissionDenied: boolean;
}

/**
 * Hook for managing desktop notifications
 */
export function useDesktopNotifications(): UseDesktopNotificationsReturn {
  const [permission, setPermission] =
    useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported and get initial permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermission);
    } else {
      setIsSupported(false);
    }
  }, []);

  /**
   * Request notification permission from the user
   */
  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      if (!isSupported) {
        console.warn('Notifications are not supported in this browser');
        return 'denied';
      }

      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermission);
        return result as NotificationPermission;
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
      }
    }, [isSupported]);

  /**
   * Send a desktop notification
   */
  const sendNotification = useCallback(
    async (
      options: DesktopNotificationOptions,
    ): Promise<Notification | null> => {
      if (!isSupported) {
        console.warn('Notifications are not supported in this browser');
        return null;
      }

      // Request permission if not already granted
      let currentPermission = permission;
      if (currentPermission === 'default') {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icon-192x192.png',
          badge: options.badge,
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction,
          silent: options.silent,
        });

        // Handle notification click
        if (options.onClick) {
          notification.onclick = event => {
            event.preventDefault();
            window.focus();
            options.onClick?.();
          };
        }

        // Handle notification close
        if (options.onClose) {
          notification.onclose = () => {
            options.onClose?.();
          };
        }

        // Handle notification error
        if (options.onError) {
          notification.onerror = () => {
            options.onError?.(new Error('Notification error'));
          };
        }

        return notification;
      } catch (error) {
        console.error('Error creating notification:', error);
        options.onError?.(error as Error);
        return null;
      }
    },
    [isSupported, permission, requestPermission],
  );

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    isPermissionGranted: permission === 'granted',
    isPermissionDenied: permission === 'denied',
  };
}

/**
 * Hook for sending a notification when a specific condition is met
 */
export function useNotificationOnCondition(
  condition: boolean,
  options: DesktopNotificationOptions,
  deps: React.DependencyList = [],
) {
  const { sendNotification, isPermissionGranted } = useDesktopNotifications();

  useEffect(() => {
    if (condition && isPermissionGranted) {
      sendNotification(options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, isPermissionGranted, ...deps]);
}

/**
 * Hook for managing notification badge count (if supported)
 */
export function useNotificationBadge() {
  const [count, setCount] = useState(0);

  const updateBadge = useCallback((newCount: number) => {
    setCount(newCount);

    // Update badge if supported (mainly for PWA)
    if ('setAppBadge' in navigator && navigator.setAppBadge) {
      if (newCount > 0) {
        navigator.setAppBadge(newCount).catch(err => {
          console.warn('Failed to set app badge:', err);
        });
      } else if (navigator.clearAppBadge) {
        navigator.clearAppBadge().catch(err => {
          console.warn('Failed to clear app badge:', err);
        });
      }
    }
  }, []);

  const clearBadge = useCallback(() => {
    updateBadge(0);
  }, [updateBadge]);

  const incrementBadge = useCallback(() => {
    updateBadge(count + 1);
  }, [count, updateBadge]);

  return {
    count,
    updateBadge,
    clearBadge,
    incrementBadge,
  };
}
