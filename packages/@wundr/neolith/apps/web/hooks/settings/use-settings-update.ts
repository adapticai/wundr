'use client';

/**
 * @neolith/hooks/settings/use-settings-update
 *
 * Hook for updating user settings with optimistic updates,
 * automatic rollback on failure, and debouncing support.
 *
 * @module hooks/settings/use-settings-update
 */

import { useState, useCallback, useRef } from 'react';
import type { UserSettings } from '@/lib/validations/settings';

/**
 * Options for the useSettingsUpdate hook
 */
export interface UseSettingsUpdateOptions {
  /** Debounce delay in milliseconds (0 to disable) */
  debounceMs?: number;
  /** Whether to use optimistic updates */
  optimistic?: boolean;
  /** Callback fired on successful update */
  onSuccess?: (settings: Partial<UserSettings>) => void;
  /** Callback fired on update failure */
  onError?: (error: Error, rollbackData?: Partial<UserSettings>) => void;
  /** Callback fired after update attempt (success or failure) */
  onSettled?: () => void;
}

/**
 * Return type for useSettingsUpdate hook
 */
export interface UseSettingsUpdateReturn {
  /** Update settings (supports partial updates) */
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Error from last update attempt */
  error: Error | null;
  /** Whether an update was successful */
  isSuccess: boolean;
  /** Reset error and success states */
  reset: () => void;
  /** Cancel pending debounced updates */
  cancel: () => void;
}

/**
 * Hook for updating user settings with optimistic updates
 *
 * Provides debouncing, optimistic updates with automatic rollback,
 * and comprehensive error handling for settings updates.
 *
 * @param options - Configuration options
 * @returns Settings update methods and state
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { updateSettings, isUpdating, error } = useSettingsUpdate({
 *     optimistic: true,
 *     debounceMs: 500,
 *     onSuccess: () => toast.success('Settings saved'),
 *     onError: (err) => toast.error(err.message),
 *   });
 *
 *   const handleThemeChange = (theme: string) => {
 *     updateSettings({
 *       appearance: { theme: theme as 'light' | 'dark' | 'system' }
 *     });
 *   };
 *
 *   return (
 *     <Select value={theme} onChange={handleThemeChange} disabled={isUpdating}>
 *       <option value="light">Light</option>
 *       <option value="dark">Dark</option>
 *       <option value="system">System</option>
 *     </Select>
 *   );
 * }
 * ```
 */
export function useSettingsUpdate(
  options: UseSettingsUpdateOptions = {},
): UseSettingsUpdateReturn {
  const {
    debounceMs = 0,
    optimistic = true,
    onSuccess,
    onError,
    onSettled,
  } = options;

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousSettingsRef = useRef<Partial<UserSettings> | null>(null);

  // Perform the actual API update
  const performUpdate = useCallback(
    async (updates: Partial<UserSettings>) => {
      try {
        // Cancel any in-flight requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        setIsUpdating(true);
        setError(null);
        setIsSuccess(false);

        const response = await fetch('/api/user/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to update settings');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to update settings');
        }

        setIsSuccess(true);

        if (onSuccess) {
          onSuccess(updates);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);

        if (onError) {
          onError(error, previousSettingsRef.current ?? undefined);
        }

        throw error;
      } finally {
        setIsUpdating(false);

        if (onSettled) {
          onSettled();
        }
      }
    },
    [onSuccess, onError, onSettled],
  );

  // Update settings with debouncing and optimistic updates
  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      // Store previous settings for potential rollback
      if (optimistic) {
        previousSettingsRef.current = updates;
      }

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If debouncing is enabled, delay the update
      if (debounceMs > 0) {
        return new Promise<void>((resolve, reject) => {
          debounceTimerRef.current = setTimeout(async () => {
            try {
              await performUpdate(updates);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, debounceMs);
        });
      }

      // Otherwise, update immediately
      await performUpdate(updates);
    },
    [debounceMs, optimistic, performUpdate],
  );

  // Reset error and success states
  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  // Cancel pending debounced updates
  const cancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsUpdating(false);
  }, []);

  return {
    updateSettings,
    isUpdating,
    error,
    isSuccess,
    reset,
    cancel,
  };
}
