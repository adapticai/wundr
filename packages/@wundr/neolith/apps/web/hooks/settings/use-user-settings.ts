'use client';

/**
 * @neolith/hooks/settings/use-user-settings
 *
 * Hook for fetching and caching user settings with automatic refresh
 * and optimistic updates support.
 *
 * @module hooks/settings/use-user-settings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserSettings } from '@/lib/validations/settings';

/**
 * Options for the useUserSettings hook
 */
export interface UseUserSettingsOptions {
  /** Whether to enable settings fetching */
  enabled?: boolean;
  /** Polling interval in milliseconds (0 to disable) */
  pollInterval?: number;
  /** Callback fired when settings are loaded */
  onLoad?: (settings: UserSettings) => void;
  /** Callback fired when settings fail to load */
  onError?: (error: Error) => void;
}

/**
 * Return type for useUserSettings hook
 */
export interface UseUserSettingsReturn {
  /** Current user settings */
  settings: UserSettings | null;
  /** Whether settings are currently loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Whether settings have been loaded at least once */
  isInitialized: boolean;
  /** Refresh settings from server */
  refresh: () => Promise<void>;
  /** Get a specific settings section */
  getSection: <K extends keyof UserSettings>(section: K) => UserSettings[K] | null;
}

/**
 * Hook for fetching and caching user settings
 *
 * Provides automatic caching, polling, and error handling for user settings.
 * Settings are fetched on mount and can be refreshed manually or automatically.
 *
 * @param options - Configuration options
 * @returns User settings and management methods
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { settings, isLoading, refresh, getSection } = useUserSettings({
 *     pollInterval: 60000, // Refresh every minute
 *     onLoad: (settings) => console.log('Settings loaded:', settings),
 *   });
 *
 *   if (isLoading) return <Loading />;
 *
 *   const appearance = getSection('appearance');
 *   return <div>Theme: {appearance?.theme}</div>;
 * }
 * ```
 */
export function useUserSettings(
  options: UseUserSettingsOptions = {},
): UseUserSettingsReturn {
  const { enabled = true, pollInterval = 0, onLoad, onError } = options;

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    if (!enabled) return;

    try {
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/settings', {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch settings');
      }

      if (!isMountedRef.current) return;

      const fetchedSettings = result.data as UserSettings;
      setSettings(fetchedSettings);
      setIsInitialized(true);

      if (onLoad) {
        onLoad(fetchedSettings);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error('Unknown error');

      if (!isMountedRef.current) return;

      setError(error);

      if (onError) {
        onError(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, onLoad, onError]);

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      return;
    }

    void fetchSettings();

    // Setup polling if interval is specified
    if (pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        void fetchSettings();
      }, pollInterval);
    }

    return () => {
      isMountedRef.current = false;

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, pollInterval, fetchSettings]);

  // Refresh settings manually
  const refresh = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  // Get specific settings section
  const getSection = useCallback(
    <K extends keyof UserSettings>(section: K): UserSettings[K] | null => {
      return settings?.[section] ?? null;
    },
    [settings],
  );

  return {
    settings,
    isLoading,
    error,
    isInitialized,
    refresh,
    getSection,
  };
}
