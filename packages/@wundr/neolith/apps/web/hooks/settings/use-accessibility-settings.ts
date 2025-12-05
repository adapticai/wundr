'use client';

/**
 * @neolith/hooks/settings/use-accessibility-settings
 *
 * Hook for managing accessibility preferences including
 * screen reader support, keyboard navigation, and visual adjustments.
 *
 * @module hooks/settings/use-accessibility-settings
 */

import { useCallback, useEffect, useState } from 'react';
import type { AppearanceSettings } from '@/lib/validations/settings';
import { useUserSettings } from './use-user-settings';
import { useSettingsUpdate } from './use-settings-update';

/**
 * Return type for useAccessibilitySettings hook
 */
export interface UseAccessibilitySettingsReturn {
  /** Current appearance settings (contains a11y preferences) */
  settings: AppearanceSettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Update accessibility settings */
  updateA11y: (updates: Partial<AppearanceSettings>) => Promise<void>;
  /** Whether update is in progress */
  isUpdating: boolean;
  /** Toggle reduced motion */
  toggleReducedMotion: () => Promise<void>;
  /** Toggle high contrast mode */
  toggleHighContrast: () => Promise<void>;
  /** Increase font size */
  increaseFontSize: () => Promise<void>;
  /** Decrease font size */
  decreaseFontSize: () => Promise<void>;
  /** Set font size directly */
  setFontSize: (size: 'small' | 'medium' | 'large' | 'extra-large') => Promise<void>;
  /** Set density (spacing) */
  setDensity: (density: 'compact' | 'comfortable' | 'spacious') => Promise<void>;
  /** Enable accessibility preset (high contrast + large text + reduced motion) */
  enableA11yPreset: () => Promise<void>;
  /** Reset to default accessibility settings */
  resetA11ySettings: () => Promise<void>;
  /** Whether reduced motion is preferred (system or setting) */
  prefersReducedMotion: boolean;
}

const FONT_SIZE_ORDER: Array<'small' | 'medium' | 'large' | 'extra-large'> = [
  'small',
  'medium',
  'large',
  'extra-large',
];

/**
 * Hook for managing accessibility settings
 *
 * Provides comprehensive accessibility controls including motion reduction,
 * contrast adjustment, and text sizing with system preference detection.
 *
 * @returns Accessibility settings and management methods
 *
 * @example
 * ```tsx
 * function AccessibilityPanel() {
 *   const {
 *     settings,
 *     toggleReducedMotion,
 *     toggleHighContrast,
 *     increaseFontSize,
 *     enableA11yPreset,
 *     prefersReducedMotion,
 *   } = useAccessibilitySettings();
 *
 *   return (
 *     <div>
 *       <Switch
 *         checked={settings?.reduceMotion ?? prefersReducedMotion}
 *         onChange={toggleReducedMotion}
 *         label="Reduce Motion"
 *       />
 *       <Switch
 *         checked={settings?.highContrast}
 *         onChange={toggleHighContrast}
 *         label="High Contrast"
 *       />
 *       <ButtonGroup>
 *         <Button onClick={decreaseFontSize}>A-</Button>
 *         <Button onClick={increaseFontSize}>A+</Button>
 *       </ButtonGroup>
 *       <Button onClick={enableA11yPreset}>
 *         Enable Accessibility Mode
 *       </Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAccessibilitySettings(): UseAccessibilitySettingsReturn {
  const { settings: allSettings, isLoading } = useUserSettings();
  const { updateSettings, isUpdating } = useSettingsUpdate({
    optimistic: true,
    debounceMs: 0, // Immediate updates for a11y changes
  });

  const settings = allSettings?.appearance ?? null;

  // Detect system reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Update accessibility settings
  const updateA11y = useCallback(
    async (updates: Partial<AppearanceSettings>) => {
      await updateSettings({
        appearance: updates,
      });
    },
    [updateSettings],
  );

  // Toggle reduced motion
  const toggleReducedMotion = useCallback(async () => {
    const current = settings?.reduceMotion ?? false;
    await updateA11y({ reduceMotion: !current });
  }, [settings?.reduceMotion, updateA11y]);

  // Toggle high contrast
  const toggleHighContrast = useCallback(async () => {
    const current = settings?.highContrast ?? false;
    await updateA11y({ highContrast: !current });
  }, [settings?.highContrast, updateA11y]);

  // Set font size directly
  const setFontSize = useCallback(
    async (size: 'small' | 'medium' | 'large' | 'extra-large') => {
      await updateA11y({ fontSize: size });
    },
    [updateA11y],
  );

  // Increase font size
  const increaseFontSize = useCallback(async () => {
    const current = settings?.fontSize ?? 'medium';
    const currentIndex = FONT_SIZE_ORDER.indexOf(current);
    const nextIndex = Math.min(currentIndex + 1, FONT_SIZE_ORDER.length - 1);
    await setFontSize(FONT_SIZE_ORDER[nextIndex]);
  }, [settings?.fontSize, setFontSize]);

  // Decrease font size
  const decreaseFontSize = useCallback(async () => {
    const current = settings?.fontSize ?? 'medium';
    const currentIndex = FONT_SIZE_ORDER.indexOf(current);
    const prevIndex = Math.max(currentIndex - 1, 0);
    await setFontSize(FONT_SIZE_ORDER[prevIndex]);
  }, [settings?.fontSize, setFontSize]);

  // Set density
  const setDensity = useCallback(
    async (density: 'compact' | 'comfortable' | 'spacious') => {
      await updateA11y({ density });
    },
    [updateA11y],
  );

  // Enable accessibility preset
  const enableA11yPreset = useCallback(async () => {
    await updateA11y({
      reduceMotion: true,
      highContrast: true,
      fontSize: 'large',
      density: 'spacious',
      messageGrouping: false, // Better for screen readers
      showAvatars: true, // Visual clarity
    });
  }, [updateA11y]);

  // Reset accessibility settings
  const resetA11ySettings = useCallback(async () => {
    await updateA11y({
      reduceMotion: false,
      highContrast: false,
      fontSize: 'medium',
      density: 'comfortable',
      messageGrouping: true,
      showAvatars: true,
    });
  }, [updateA11y]);

  return {
    settings,
    isLoading,
    updateA11y,
    isUpdating,
    toggleReducedMotion,
    toggleHighContrast,
    increaseFontSize,
    decreaseFontSize,
    setFontSize,
    setDensity,
    enableA11yPreset,
    resetA11ySettings,
    prefersReducedMotion,
  };
}
