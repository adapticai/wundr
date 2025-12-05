'use client';

/**
 * @neolith/hooks/settings/use-notification-preferences
 *
 * Specialized hook for managing notification preferences with
 * granular controls and quick toggle actions.
 *
 * @module hooks/settings/use-notification-preferences
 */

import { useCallback, useMemo } from 'react';

import { useSettingsUpdate } from './use-settings-update';
import { useUserSettings } from './use-user-settings';

import type { NotificationPreferences } from '@/lib/validations/settings';

/**
 * Return type for useNotificationPreferences hook
 */
export interface UseNotificationPreferencesReturn {
  /** Current notification preferences */
  preferences: NotificationPreferences | null;
  /** Whether preferences are loading */
  isLoading: boolean;
  /** Error loading preferences */
  error: Error | null;
  /** Update notification preferences */
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  /** Whether update is in progress */
  isUpdating: boolean;
  /** Toggle email notifications */
  toggleEmailNotifications: (enabled: boolean) => Promise<void>;
  /** Toggle push notifications */
  togglePushNotifications: (enabled: boolean) => Promise<void>;
  /** Toggle desktop notifications */
  toggleDesktopNotifications: (enabled: boolean) => Promise<void>;
  /** Enable Do Not Disturb mode */
  enableDoNotDisturb: (startTime: string, endTime: string, days?: number[]) => Promise<void>;
  /** Disable Do Not Disturb mode */
  disableDoNotDisturb: () => Promise<void>;
  /** Whether DND is currently active */
  isDndActive: boolean;
  /** Mute all notifications */
  muteAll: () => Promise<void>;
  /** Unmute all notifications */
  unmuteAll: () => Promise<void>;
}

/**
 * Hook for managing notification preferences
 *
 * Provides convenient methods for toggling notification settings
 * and managing Do Not Disturb mode with schedule support.
 *
 * @returns Notification preferences and management methods
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const {
 *     preferences,
 *     toggleEmailNotifications,
 *     enableDoNotDisturb,
 *     isDndActive,
 *     muteAll,
 *   } = useNotificationPreferences();
 *
 *   return (
 *     <div>
 *       <Switch
 *         checked={preferences?.email?.messages}
 *         onChange={(e) => toggleEmailNotifications(e.target.checked)}
 *       />
 *       <Button onClick={() => enableDoNotDisturb('22:00', '08:00')}>
 *         Enable DND
 *       </Button>
 *       {isDndActive && <Badge>DND Active</Badge>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotificationPreferences(): UseNotificationPreferencesReturn {
  const { settings, isLoading, error } = useUserSettings();
  const { updateSettings, isUpdating } = useSettingsUpdate({
    optimistic: true,
    debounceMs: 300,
  });

  const preferences = settings?.notifications ?? null;

  // Check if DND is currently active based on current time and schedule
  const isDndActive = useMemo(() => {
    if (!preferences?.doNotDisturb?.enabled) {
      return false;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const dndDays = preferences.doNotDisturb.days ?? [0, 1, 2, 3, 4, 5, 6];
    if (!dndDays.includes(currentDay)) {
      return false;
    }

    const startTime = preferences.doNotDisturb.startTime ?? '22:00';
    const endTime = preferences.doNotDisturb.endTime ?? '08:00';

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentTime >= startMinutes || currentTime <= endMinutes;
    }

    return currentTime >= startMinutes && currentTime <= endMinutes;
  }, [preferences]);

  // Update notification preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      await updateSettings({
        notifications: updates,
      });
    },
    [updateSettings],
  );

  // Toggle email notifications
  const toggleEmailNotifications = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({
        email: {
          messages: enabled,
          mentions: enabled,
          channelActivity: enabled,
          taskUpdates: enabled,
        },
      });
    },
    [updatePreferences],
  );

  // Toggle push notifications
  const togglePushNotifications = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({
        push: {
          messages: enabled,
          mentions: enabled,
          calls: enabled,
          taskReminders: enabled,
        },
      });
    },
    [updatePreferences],
  );

  // Toggle desktop notifications
  const toggleDesktopNotifications = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({
        desktop: {
          enabled,
          sound: enabled,
          badge: enabled,
        },
      });
    },
    [updatePreferences],
  );

  // Enable Do Not Disturb
  const enableDoNotDisturb = useCallback(
    async (startTime: string, endTime: string, days?: number[]) => {
      await updatePreferences({
        doNotDisturb: {
          enabled: true,
          startTime,
          endTime,
          days: days ?? [0, 1, 2, 3, 4, 5, 6],
        },
      });
    },
    [updatePreferences],
  );

  // Disable Do Not Disturb
  const disableDoNotDisturb = useCallback(async () => {
    await updatePreferences({
      doNotDisturb: {
        enabled: false,
      },
    });
  }, [updatePreferences]);

  // Mute all notifications
  const muteAll = useCallback(async () => {
    await updatePreferences({
      email: {
        messages: false,
        mentions: false,
        channelActivity: false,
        taskUpdates: false,
      },
      push: {
        messages: false,
        mentions: false,
        calls: false,
        taskReminders: false,
      },
      inApp: {
        messages: false,
        mentions: false,
        reactions: false,
        channelActivity: false,
        calls: false,
      },
      desktop: {
        enabled: false,
      },
    });
  }, [updatePreferences]);

  // Unmute all notifications
  const unmuteAll = useCallback(async () => {
    await updatePreferences({
      email: {
        messages: true,
        mentions: true,
        channelActivity: true,
        taskUpdates: true,
      },
      push: {
        messages: true,
        mentions: true,
        calls: true,
        taskReminders: true,
      },
      inApp: {
        messages: true,
        mentions: true,
        reactions: true,
        channelActivity: true,
        calls: true,
      },
      desktop: {
        enabled: true,
        sound: true,
        badge: true,
      },
    });
  }, [updatePreferences]);

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    isUpdating,
    toggleEmailNotifications,
    togglePushNotifications,
    toggleDesktopNotifications,
    enableDoNotDisturb,
    disableDoNotDisturb,
    isDndActive,
    muteAll,
    unmuteAll,
  };
}
