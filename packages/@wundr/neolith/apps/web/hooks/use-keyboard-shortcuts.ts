/**
 * Keyboard Shortcuts Hook
 * @module hooks/use-keyboard-shortcuts
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

import {
  loadShortcuts,
  saveShortcuts,
  normalizeKey,
  keysEqual,
  findConflicts,
  DEFAULT_SHORTCUTS,
  SHORTCUT_PRESETS,
} from '@/lib/keyboard-shortcuts';

import type {
  KeyboardShortcut,
  ShortcutPreset,
  ShortcutCategory,
  ShortcutContext,
} from '@/lib/keyboard-shortcuts';

interface UseKeyboardShortcutsReturn {
  shortcuts: KeyboardShortcut[];
  updateShortcut: (id: string, keys: string[]) => void;
  toggleShortcut: (id: string) => void;
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  applyPreset: (presetId: string) => void;
  toggleCategory: (category: ShortcutCategory, enabled: boolean) => void;
  conflicts: Array<{
    shortcut1: KeyboardShortcut;
    shortcut2: KeyboardShortcut;
  }>;
  exportConfig: () => string;
  importConfig: (json: string) => { success: boolean; error?: string };
  filterByCategory: (category: ShortcutCategory) => KeyboardShortcut[];
  filterByContext: (context: ShortcutContext) => KeyboardShortcut[];
  searchShortcuts: (query: string) => KeyboardShortcut[];
}

export function useKeyboardShortcuts(): UseKeyboardShortcutsReturn {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);

  // Load shortcuts on mount
  useEffect(() => {
    const loaded = loadShortcuts();
    setShortcuts(loaded);
  }, []);

  // Save shortcuts whenever they change
  useEffect(() => {
    if (shortcuts.length > 0) {
      saveShortcuts(shortcuts);
    }
  }, [shortcuts]);

  // Update a shortcut's key combination
  const updateShortcut = useCallback((id: string, keys: string[]) => {
    setShortcuts(prev =>
      prev.map(shortcut =>
        shortcut.id === id ? { ...shortcut, keys } : shortcut
      )
    );
  }, []);

  // Toggle a shortcut's enabled state
  const toggleShortcut = useCallback((id: string) => {
    setShortcuts(prev =>
      prev.map(shortcut =>
        shortcut.id === id
          ? { ...shortcut, enabled: !shortcut.enabled }
          : shortcut
      )
    );
  }, []);

  // Reset a single shortcut to default
  const resetShortcut = useCallback((id: string) => {
    const defaultShortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
    if (defaultShortcut) {
      setShortcuts(prev =>
        prev.map(shortcut =>
          shortcut.id === id
            ? { ...shortcut, keys: [...defaultShortcut.defaultKeys] }
            : shortcut
        )
      );
    }
  }, []);

  // Reset all shortcuts to defaults
  const resetAll = useCallback(() => {
    setShortcuts(
      DEFAULT_SHORTCUTS.map(s => ({ ...s, keys: [...s.defaultKeys] }))
    );
  }, []);

  // Apply a preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = SHORTCUT_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      return;
    }

    setShortcuts(prev =>
      prev.map(shortcut => {
        const presetKeys = preset.shortcuts[shortcut.id];
        return presetKeys ? { ...shortcut, keys: [...presetKeys] } : shortcut;
      })
    );
  }, []);

  // Toggle all shortcuts in a category
  const toggleCategory = useCallback(
    (category: ShortcutCategory, enabled: boolean) => {
      setShortcuts(prev =>
        prev.map(shortcut =>
          shortcut.category === category ? { ...shortcut, enabled } : shortcut
        )
      );
    },
    []
  );

  // Find conflicts
  const conflicts = findConflicts(shortcuts);

  // Export configuration
  const exportConfig = useCallback(() => {
    return JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        shortcuts: shortcuts.map(s => ({
          id: s.id,
          keys: s.keys,
          enabled: s.enabled,
        })),
      },
      null,
      2
    );
  }, [shortcuts]);

  // Import configuration
  const importConfig = useCallback(
    (json: string): { success: boolean; error?: string } => {
      try {
        const data = JSON.parse(json);

        if (!data.shortcuts || !Array.isArray(data.shortcuts)) {
          return { success: false, error: 'Invalid configuration format' };
        }

        const imported = DEFAULT_SHORTCUTS.map(defaultShortcut => {
          const importedShortcut = data.shortcuts.find(
            (s: { id: string }) => s.id === defaultShortcut.id
          );
          if (importedShortcut) {
            return {
              ...defaultShortcut,
              keys: importedShortcut.keys || defaultShortcut.keys,
              enabled:
                importedShortcut.enabled !== undefined
                  ? importedShortcut.enabled
                  : defaultShortcut.enabled,
            };
          }
          return defaultShortcut;
        });

        setShortcuts(imported);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to parse JSON',
        };
      }
    },
    []
  );

  // Filter shortcuts by category
  const filterByCategory = useCallback(
    (category: ShortcutCategory) => {
      return shortcuts.filter(s => s.category === category);
    },
    [shortcuts]
  );

  // Filter shortcuts by context
  const filterByContext = useCallback(
    (context: ShortcutContext) => {
      return shortcuts.filter(s => s.context === context);
    },
    [shortcuts]
  );

  // Search shortcuts
  const searchShortcuts = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase();
      return shortcuts.filter(
        s =>
          s.description.toLowerCase().includes(lowerQuery) ||
          s.category.toLowerCase().includes(lowerQuery) ||
          s.keys.some(k => k.toLowerCase().includes(lowerQuery))
      );
    },
    [shortcuts]
  );

  return {
    shortcuts,
    updateShortcut,
    toggleShortcut,
    resetShortcut,
    resetAll,
    applyPreset,
    toggleCategory,
    conflicts,
    exportConfig,
    importConfig,
    filterByCategory,
    filterByContext,
    searchShortcuts,
  };
}

/**
 * Hook for capturing keyboard shortcuts
 */
interface UseShortcutCaptureReturn {
  isCapturing: boolean;
  capturedKeys: string[];
  startCapture: () => void;
  stopCapture: () => void;
  clearCapture: () => void;
}

export function useShortcutCapture(): UseShortcutCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedKeys, setCapturedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!isCapturing) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys: string[] = [];

      // Add modifier keys
      if (e.metaKey || e.key === 'Meta') {
        keys.push('Meta');
      }
      if (e.ctrlKey || e.key === 'Control') {
        keys.push('Control');
      }
      if (e.altKey || e.key === 'Alt') {
        keys.push('Alt');
      }
      if (e.shiftKey || e.key === 'Shift') {
        keys.push('Shift');
      }

      // Add the main key (if it's not a modifier)
      if (
        e.key !== 'Meta' &&
        e.key !== 'Control' &&
        e.key !== 'Alt' &&
        e.key !== 'Shift'
      ) {
        keys.push(normalizeKey(e.key));
      }

      // Only update if we have keys
      if (keys.length > 0) {
        setCapturedKeys(keys);
      }
    };

    const handleKeyUp = () => {
      // Stop capturing on key up
      setIsCapturing(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isCapturing]);

  const startCapture = useCallback(() => {
    setCapturedKeys([]);
    setIsCapturing(true);
  }, []);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  const clearCapture = useCallback(() => {
    setCapturedKeys([]);
  }, []);

  return {
    isCapturing,
    capturedKeys,
    startCapture,
    stopCapture,
    clearCapture,
  };
}

/**
 * Platform detection
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof window !== 'undefined' &&
        navigator.platform.toUpperCase().indexOf('MAC') >= 0
    );
  }, []);

  return isMac;
}
