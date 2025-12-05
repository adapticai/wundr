'use client';

/**
 * @neolith/hooks/settings/use-privacy-settings
 *
 * Hook for managing privacy and data sharing settings with
 * granular controls and compliance helpers.
 *
 * @module hooks/settings/use-privacy-settings
 */

import { useCallback } from 'react';
import type { PrivacySettings } from '@/lib/validations/settings';
import { useUserSettings } from './use-user-settings';
import { useSettingsUpdate } from './use-settings-update';

/**
 * Return type for usePrivacySettings hook
 */
export interface UsePrivacySettingsReturn {
  /** Current privacy settings */
  privacy: PrivacySettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Error loading settings */
  error: Error | null;
  /** Update privacy settings */
  updatePrivacy: (updates: Partial<PrivacySettings>) => Promise<void>;
  /** Whether update is in progress */
  isUpdating: boolean;
  /** Toggle online status visibility */
  toggleOnlineStatus: () => Promise<void>;
  /** Toggle read receipts */
  toggleReadReceipts: () => Promise<void>;
  /** Toggle typing indicators */
  toggleTypingIndicators: () => Promise<void>;
  /** Toggle profile discoverability */
  toggleProfileDiscoverable: () => Promise<void>;
  /** Toggle analytics */
  toggleAnalytics: () => Promise<void>;
  /** Set who can send messages */
  setWhoCanSendMessages: (value: 'everyone' | 'workspace-members' | 'connections') => Promise<void>;
  /** Set who can see posts */
  setWhoCanSeePosts: (value: 'public' | 'workspace' | 'private') => Promise<void>;
  /** Set data retention policy */
  setDataRetention: (value: 'forever' | '1-year' | '6-months' | '3-months') => Promise<void>;
  /** Enable maximum privacy mode */
  enableMaxPrivacy: () => Promise<void>;
  /** Disable all privacy restrictions */
  disableAllPrivacy: () => Promise<void>;
}

/**
 * Hook for managing privacy settings
 *
 * Provides convenient methods for controlling privacy and visibility
 * settings, including preset privacy modes.
 *
 * @returns Privacy settings and management methods
 *
 * @example
 * ```tsx
 * function PrivacyControls() {
 *   const {
 *     privacy,
 *     toggleOnlineStatus,
 *     enableMaxPrivacy,
 *     setWhoCanSendMessages,
 *   } = usePrivacySettings();
 *
 *   return (
 *     <div>
 *       <Switch
 *         checked={privacy?.showOnlineStatus}
 *         onChange={toggleOnlineStatus}
 *         label="Show Online Status"
 *       />
 *       <Button onClick={enableMaxPrivacy}>
 *         Maximum Privacy
 *       </Button>
 *       <Select
 *         value={privacy?.whoCanSendMessages}
 *         onChange={(e) => setWhoCanSendMessages(e.target.value)}
 *       >
 *         <option value="everyone">Everyone</option>
 *         <option value="workspace-members">Workspace Members</option>
 *         <option value="connections">Connections Only</option>
 *       </Select>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrivacySettings(): UsePrivacySettingsReturn {
  const { settings, isLoading, error } = useUserSettings();
  const { updateSettings, isUpdating } = useSettingsUpdate({
    optimistic: true,
    debounceMs: 300,
  });

  const privacy = settings?.privacy ?? null;

  // Update privacy settings
  const updatePrivacy = useCallback(
    async (updates: Partial<PrivacySettings>) => {
      await updateSettings({
        privacy: updates,
      });
    },
    [updateSettings],
  );

  // Toggle online status
  const toggleOnlineStatus = useCallback(async () => {
    const current = privacy?.showOnlineStatus ?? true;
    await updatePrivacy({ showOnlineStatus: !current });
  }, [privacy?.showOnlineStatus, updatePrivacy]);

  // Toggle read receipts
  const toggleReadReceipts = useCallback(async () => {
    const current = privacy?.showReadReceipts ?? true;
    await updatePrivacy({ showReadReceipts: !current });
  }, [privacy?.showReadReceipts, updatePrivacy]);

  // Toggle typing indicators
  const toggleTypingIndicators = useCallback(async () => {
    const current = privacy?.showTypingIndicators ?? true;
    await updatePrivacy({ showTypingIndicators: !current });
  }, [privacy?.showTypingIndicators, updatePrivacy]);

  // Toggle profile discoverability
  const toggleProfileDiscoverable = useCallback(async () => {
    const current = privacy?.profileDiscoverable ?? true;
    await updatePrivacy({ profileDiscoverable: !current });
  }, [privacy?.profileDiscoverable, updatePrivacy]);

  // Toggle analytics
  const toggleAnalytics = useCallback(async () => {
    const current = privacy?.allowAnalytics ?? true;
    await updatePrivacy({ allowAnalytics: !current });
  }, [privacy?.allowAnalytics, updatePrivacy]);

  // Set who can send messages
  const setWhoCanSendMessages = useCallback(
    async (value: 'everyone' | 'workspace-members' | 'connections') => {
      await updatePrivacy({ whoCanSendMessages: value });
    },
    [updatePrivacy],
  );

  // Set who can see posts
  const setWhoCanSeePosts = useCallback(
    async (value: 'public' | 'workspace' | 'private') => {
      await updatePrivacy({ whoCanSeePosts: value });
    },
    [updatePrivacy],
  );

  // Set data retention
  const setDataRetention = useCallback(
    async (value: 'forever' | '1-year' | '6-months' | '3-months') => {
      await updatePrivacy({ dataRetention: value });
    },
    [updatePrivacy],
  );

  // Enable maximum privacy mode
  const enableMaxPrivacy = useCallback(async () => {
    await updatePrivacy({
      showOnlineStatus: false,
      showReadReceipts: false,
      showTypingIndicators: false,
      profileDiscoverable: false,
      allowAnalytics: false,
      allowThirdPartyDataSharing: false,
      whoCanSendMessages: 'connections',
      whoCanSeePosts: 'private',
      allowDirectMessages: false,
      showActivityStatus: false,
    });
  }, [updatePrivacy]);

  // Disable all privacy restrictions (public mode)
  const disableAllPrivacy = useCallback(async () => {
    await updatePrivacy({
      showOnlineStatus: true,
      showReadReceipts: true,
      showTypingIndicators: true,
      profileDiscoverable: true,
      allowAnalytics: true,
      allowThirdPartyDataSharing: false, // Keep this off by default
      whoCanSendMessages: 'everyone',
      whoCanSeePosts: 'public',
      allowDirectMessages: true,
      showActivityStatus: true,
    });
  }, [updatePrivacy]);

  return {
    privacy,
    isLoading,
    error,
    updatePrivacy,
    isUpdating,
    toggleOnlineStatus,
    toggleReadReceipts,
    toggleTypingIndicators,
    toggleProfileDiscoverable,
    toggleAnalytics,
    setWhoCanSendMessages,
    setWhoCanSeePosts,
    setDataRetention,
    enableMaxPrivacy,
    disableAllPrivacy,
  };
}
