'use client';

/**
 * @neolith/hooks/settings/use-settings-sync
 *
 * Hook for syncing settings across browser tabs using BroadcastChannel API
 * with fallback to localStorage events.
 *
 * @module hooks/settings/use-settings-sync
 */

import { useEffect, useCallback, useRef } from 'react';

import type { UserSettings } from '@/lib/validations/settings';

/**
 * Settings sync message type
 */
interface SettingsSyncMessage {
  type: 'settings-updated' | 'settings-refresh';
  settings?: Partial<UserSettings>;
  timestamp: number;
}

/**
 * Options for useSettingsSync hook
 */
export interface UseSettingsSyncOptions {
  /** Callback when settings are updated from another tab */
  onSync?: (settings: Partial<UserSettings>) => void;
  /** Callback when refresh is requested from another tab */
  onRefresh?: () => void;
  /** Whether sync is enabled */
  enabled?: boolean;
}

/**
 * Return type for useSettingsSync hook
 */
export interface UseSettingsSyncReturn {
  /** Broadcast settings update to other tabs */
  broadcastUpdate: (settings: Partial<UserSettings>) => void;
  /** Request refresh in all tabs */
  requestRefresh: () => void;
  /** Whether BroadcastChannel is supported */
  isSupported: boolean;
}

const SYNC_CHANNEL_NAME = 'neolith-settings-sync';
const STORAGE_KEY = 'neolith-settings-sync-event';

/**
 * Hook for syncing settings across browser tabs
 *
 * Uses BroadcastChannel API for modern browsers with localStorage
 * fallback for older browsers. Ensures settings stay synchronized
 * when users have multiple tabs open.
 *
 * @param options - Configuration options
 * @returns Settings sync methods
 *
 * @example
 * ```tsx
 * function SettingsManager() {
 *   const { settings, updateSettings } = useUserSettings();
 *   const { broadcastUpdate } = useSettingsSync({
 *     onSync: (updatedSettings) => {
 *       // Merge settings from other tab
 *       console.log('Settings updated in another tab:', updatedSettings);
 *     },
 *     onRefresh: () => {
 *       // Refresh settings from server
 *       refresh();
 *     },
 *   });
 *
 *   const handleUpdate = async (updates: Partial<UserSettings>) => {
 *     await updateSettings(updates);
 *     broadcastUpdate(updates); // Notify other tabs
 *   };
 *
 *   return <SettingsForm onSubmit={handleUpdate} />;
 * }
 * ```
 */
export function useSettingsSync(
  options: UseSettingsSyncOptions = {},
): UseSettingsSyncReturn {
  const { onSync, onRefresh, enabled = true } = options;

  const channelRef = useRef<BroadcastChannel | null>(null);
  const isSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;

  // Initialize BroadcastChannel
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
return;
}

    if (isSupported) {
      // Use BroadcastChannel for modern browsers
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<SettingsSyncMessage>) => {
        const message = event.data;

        if (message.type === 'settings-updated' && message.settings && onSync) {
          onSync(message.settings);
        } else if (message.type === 'settings-refresh' && onRefresh) {
          onRefresh();
        }
      };

      return () => {
        channel.close();
        channelRef.current = null;
      };
    } else {
      // Fallback to localStorage events for older browsers
      const handleStorageEvent = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY || !e.newValue) {
return;
}

        try {
          const message: SettingsSyncMessage = JSON.parse(e.newValue);

          if (message.type === 'settings-updated' && message.settings && onSync) {
            onSync(message.settings);
          } else if (message.type === 'settings-refresh' && onRefresh) {
            onRefresh();
          }
        } catch {
          // Ignore parse errors
        }
      };

      window.addEventListener('storage', handleStorageEvent);

      return () => {
        window.removeEventListener('storage', handleStorageEvent);
      };
    }
  }, [enabled, isSupported, onSync, onRefresh]);

  // Broadcast settings update
  const broadcastUpdate = useCallback(
    (settings: Partial<UserSettings>) => {
      if (!enabled) {
return;
}

      const message: SettingsSyncMessage = {
        type: 'settings-updated',
        settings,
        timestamp: Date.now(),
      };

      if (channelRef.current) {
        // Use BroadcastChannel
        channelRef.current.postMessage(message);
      } else if (typeof window !== 'undefined') {
        // Fallback to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
          // Clean up immediately to trigger storage event
          setTimeout(() => {
            localStorage.removeItem(STORAGE_KEY);
          }, 100);
        } catch {
          // Ignore storage errors
        }
      }
    },
    [enabled],
  );

  // Request refresh in all tabs
  const requestRefresh = useCallback(() => {
    if (!enabled) {
return;
}

    const message: SettingsSyncMessage = {
      type: 'settings-refresh',
      timestamp: Date.now(),
    };

    if (channelRef.current) {
      channelRef.current.postMessage(message);
    } else if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
        setTimeout(() => {
          localStorage.removeItem(STORAGE_KEY);
        }, 100);
      } catch {
        // Ignore storage errors
      }
    }
  }, [enabled]);

  return {
    broadcastUpdate,
    requestRefresh,
    isSupported,
  };
}
