'use client';

/**
 * @neolith/hooks/settings/use-theme-settings
 *
 * Hook for managing theme and appearance settings with
 * system preference detection and live preview support.
 *
 * @module hooks/settings/use-theme-settings
 */

import { useCallback, useEffect, useState, useMemo } from 'react';

import { useSettingsUpdate } from './use-settings-update';
import { useUserSettings } from './use-user-settings';

import type { AppearanceSettings } from '@/lib/validations/settings';

/**
 * Resolved theme type (without 'system')
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Return type for useThemeSettings hook
 */
export interface UseThemeSettingsReturn {
  /** Current appearance settings */
  appearance: AppearanceSettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Resolved theme (light/dark) considering system preference */
  resolvedTheme: ResolvedTheme;
  /** Whether dark mode is active */
  isDarkMode: boolean;
  /** System color scheme preference */
  systemTheme: ResolvedTheme;
  /** Update appearance settings */
  updateAppearance: (updates: Partial<AppearanceSettings>) => Promise<void>;
  /** Set theme (light, dark, or system) */
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  /** Toggle between light and dark mode */
  toggleTheme: () => Promise<void>;
  /** Set color scheme */
  setColorScheme: (scheme: AppearanceSettings['colorScheme']) => Promise<void>;
  /** Set font size */
  setFontSize: (size: AppearanceSettings['fontSize']) => Promise<void>;
  /** Set density */
  setDensity: (density: AppearanceSettings['density']) => Promise<void>;
  /** Toggle reduced motion */
  toggleReducedMotion: () => Promise<void>;
  /** Toggle high contrast */
  toggleHighContrast: () => Promise<void>;
  /** Whether update is in progress */
  isUpdating: boolean;
}

/**
 * Hook for managing theme and appearance settings
 *
 * Automatically detects system color scheme preference and provides
 * convenient methods for toggling theme, colors, and accessibility features.
 *
 * @returns Theme settings and management methods
 *
 * @example
 * ```tsx
 * function ThemeSelector() {
 *   const {
 *     resolvedTheme,
 *     isDarkMode,
 *     setTheme,
 *     toggleTheme,
 *     appearance,
 *   } = useThemeSettings();
 *
 *   return (
 *     <div>
 *       <Button onClick={toggleTheme}>
 *         {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
 *       </Button>
 *       <Select
 *         value={appearance?.theme ?? 'system'}
 *         onChange={(e) => setTheme(e.target.value)}
 *       >
 *         <option value="light">Light</option>
 *         <option value="dark">Dark</option>
 *         <option value="system">System</option>
 *       </Select>
 *     </div>
 *   );
 * }
 * ```
 */
export function useThemeSettings(): UseThemeSettingsReturn {
  const { settings, isLoading } = useUserSettings();
  const { updateSettings, isUpdating } = useSettingsUpdate({
    optimistic: true,
    debounceMs: 0, // Immediate updates for theme changes
  });

  const appearance = settings?.appearance ?? null;

  // Detect system theme preference
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Initial check
    handleChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Resolve theme based on user preference and system theme
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    const theme = appearance?.theme ?? 'system';
    return theme === 'system' ? systemTheme : theme;
  }, [appearance?.theme, systemTheme]);

  const isDarkMode = resolvedTheme === 'dark';

  // Update appearance settings
  const updateAppearance = useCallback(
    async (updates: Partial<AppearanceSettings>) => {
      await updateSettings({
        appearance: updates,
      });
    },
    [updateSettings]
  );

  // Set theme
  const setTheme = useCallback(
    async (theme: 'light' | 'dark' | 'system') => {
      await updateAppearance({ theme });
    },
    [updateAppearance]
  );

  // Toggle between light and dark mode
  const toggleTheme = useCallback(async () => {
    const currentTheme = appearance?.theme ?? 'system';
    let newTheme: 'light' | 'dark';

    if (currentTheme === 'system') {
      // If using system, toggle based on resolved theme
      newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    } else {
      // Otherwise toggle the explicit theme
      newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    }

    await setTheme(newTheme);
  }, [appearance?.theme, resolvedTheme, setTheme]);

  // Set color scheme
  const setColorScheme = useCallback(
    async (scheme: AppearanceSettings['colorScheme']) => {
      await updateAppearance({ colorScheme: scheme });
    },
    [updateAppearance]
  );

  // Set font size
  const setFontSize = useCallback(
    async (size: AppearanceSettings['fontSize']) => {
      await updateAppearance({ fontSize: size });
    },
    [updateAppearance]
  );

  // Set density
  const setDensity = useCallback(
    async (density: AppearanceSettings['density']) => {
      await updateAppearance({ density });
    },
    [updateAppearance]
  );

  // Toggle reduced motion
  const toggleReducedMotion = useCallback(async () => {
    const current = appearance?.reduceMotion ?? false;
    await updateAppearance({ reduceMotion: !current });
  }, [appearance?.reduceMotion, updateAppearance]);

  // Toggle high contrast
  const toggleHighContrast = useCallback(async () => {
    const current = appearance?.highContrast ?? false;
    await updateAppearance({ highContrast: !current });
  }, [appearance?.highContrast, updateAppearance]);

  return {
    appearance,
    isLoading,
    resolvedTheme,
    isDarkMode,
    systemTheme,
    updateAppearance,
    setTheme,
    toggleTheme,
    setColorScheme,
    setFontSize,
    setDensity,
    toggleReducedMotion,
    toggleHighContrast,
    isUpdating,
  };
}
