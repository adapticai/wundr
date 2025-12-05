/**
 * Keyboard Shortcuts Configuration and Management
 * @module lib/keyboard-shortcuts
 */

export type ShortcutCategory =
  | 'navigation'
  | 'actions'
  | 'editing'
  | 'window'
  | 'messaging'
  | 'orchestrators'
  | 'channels';

export type ShortcutContext = 'global' | 'editor' | 'chat' | 'orchestrator';

export interface KeyboardShortcut {
  id: string;
  category: ShortcutCategory;
  context: ShortcutContext;
  description: string;
  keys: string[];
  defaultKeys: string[];
  action: string;
  enabled: boolean;
  editable: boolean;
}

export interface ShortcutPreset {
  id: string;
  name: string;
  description: string;
  shortcuts: Record<string, string[]>;
}

/**
 * Default keyboard shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    id: 'open-command-palette',
    category: 'navigation',
    context: 'global',
    description: 'Open command palette',
    keys: ['Meta', 'k'],
    defaultKeys: ['Meta', 'k'],
    action: 'openCommandPalette',
    enabled: true,
    editable: true,
  },
  {
    id: 'show-shortcuts',
    category: 'navigation',
    context: 'global',
    description: 'Show keyboard shortcuts',
    keys: ['?'],
    defaultKeys: ['?'],
    action: 'showShortcuts',
    enabled: true,
    editable: true,
  },
  {
    id: 'close-dialog',
    category: 'navigation',
    context: 'global',
    description: 'Close dialog/modal',
    keys: ['Escape'],
    defaultKeys: ['Escape'],
    action: 'closeDialog',
    enabled: true,
    editable: false,
  },
  {
    id: 'go-to-dashboard',
    category: 'navigation',
    context: 'global',
    description: 'Go to Dashboard',
    keys: ['Meta', '1'],
    defaultKeys: ['Meta', '1'],
    action: 'goToDashboard',
    enabled: true,
    editable: true,
  },
  {
    id: 'go-to-channels',
    category: 'navigation',
    context: 'global',
    description: 'Go to Channels',
    keys: ['Meta', '2'],
    defaultKeys: ['Meta', '2'],
    action: 'goToChannels',
    enabled: true,
    editable: true,
  },
  {
    id: 'go-to-orchestrators',
    category: 'navigation',
    context: 'global',
    description: 'Go to Orchestrators',
    keys: ['Meta', '3'],
    defaultKeys: ['Meta', '3'],
    action: 'goToOrchestrators',
    enabled: true,
    editable: true,
  },
  {
    id: 'go-to-workflows',
    category: 'navigation',
    context: 'global',
    description: 'Go to Workflows',
    keys: ['Meta', '4'],
    defaultKeys: ['Meta', '4'],
    action: 'goToWorkflows',
    enabled: true,
    editable: true,
  },
  {
    id: 'go-to-analytics',
    category: 'navigation',
    context: 'global',
    description: 'Go to Analytics',
    keys: ['Meta', '5'],
    defaultKeys: ['Meta', '5'],
    action: 'goToAnalytics',
    enabled: true,
    editable: true,
  },
  {
    id: 'search',
    category: 'navigation',
    context: 'global',
    description: 'Search',
    keys: ['Meta', 'f'],
    defaultKeys: ['Meta', 'f'],
    action: 'search',
    enabled: true,
    editable: true,
  },

  // Actions
  {
    id: 'create-new',
    category: 'actions',
    context: 'global',
    description: 'Create new item',
    keys: ['Meta', 'n'],
    defaultKeys: ['Meta', 'n'],
    action: 'createNew',
    enabled: true,
    editable: true,
  },
  {
    id: 'save',
    category: 'actions',
    context: 'global',
    description: 'Save changes',
    keys: ['Meta', 's'],
    defaultKeys: ['Meta', 's'],
    action: 'save',
    enabled: true,
    editable: true,
  },
  {
    id: 'submit',
    category: 'actions',
    context: 'chat',
    description: 'Submit form/Send message',
    keys: ['Meta', 'Enter'],
    defaultKeys: ['Meta', 'Enter'],
    action: 'submit',
    enabled: true,
    editable: true,
  },
  {
    id: 'open-settings',
    category: 'actions',
    context: 'global',
    description: 'Open settings',
    keys: ['Meta', ','],
    defaultKeys: ['Meta', ','],
    action: 'openSettings',
    enabled: true,
    editable: true,
  },
  {
    id: 'toggle-sidebar',
    category: 'actions',
    context: 'global',
    description: 'Toggle sidebar',
    keys: ['Meta', '\\'],
    defaultKeys: ['Meta', '\\'],
    action: 'toggleSidebar',
    enabled: true,
    editable: true,
  },

  // Editing
  {
    id: 'undo',
    category: 'editing',
    context: 'editor',
    description: 'Undo',
    keys: ['Meta', 'z'],
    defaultKeys: ['Meta', 'z'],
    action: 'undo',
    enabled: true,
    editable: false,
  },
  {
    id: 'redo',
    category: 'editing',
    context: 'editor',
    description: 'Redo',
    keys: ['Meta', 'Shift', 'z'],
    defaultKeys: ['Meta', 'Shift', 'z'],
    action: 'redo',
    enabled: true,
    editable: false,
  },
  {
    id: 'copy',
    category: 'editing',
    context: 'editor',
    description: 'Copy',
    keys: ['Meta', 'c'],
    defaultKeys: ['Meta', 'c'],
    action: 'copy',
    enabled: true,
    editable: false,
  },
  {
    id: 'cut',
    category: 'editing',
    context: 'editor',
    description: 'Cut',
    keys: ['Meta', 'x'],
    defaultKeys: ['Meta', 'x'],
    action: 'cut',
    enabled: true,
    editable: false,
  },
  {
    id: 'paste',
    category: 'editing',
    context: 'editor',
    description: 'Paste',
    keys: ['Meta', 'v'],
    defaultKeys: ['Meta', 'v'],
    action: 'paste',
    enabled: true,
    editable: false,
  },
  {
    id: 'select-all',
    category: 'editing',
    context: 'editor',
    description: 'Select all',
    keys: ['Meta', 'a'],
    defaultKeys: ['Meta', 'a'],
    action: 'selectAll',
    enabled: true,
    editable: false,
  },
  {
    id: 'bold',
    category: 'editing',
    context: 'editor',
    description: 'Toggle bold',
    keys: ['Meta', 'b'],
    defaultKeys: ['Meta', 'b'],
    action: 'bold',
    enabled: true,
    editable: true,
  },
  {
    id: 'italic',
    category: 'editing',
    context: 'editor',
    description: 'Toggle italic',
    keys: ['Meta', 'i'],
    defaultKeys: ['Meta', 'i'],
    action: 'italic',
    enabled: true,
    editable: true,
  },

  // Window Management
  {
    id: 'close-tab',
    category: 'window',
    context: 'global',
    description: 'Close tab/window',
    keys: ['Meta', 'w'],
    defaultKeys: ['Meta', 'w'],
    action: 'closeTab',
    enabled: true,
    editable: true,
  },
  {
    id: 'new-tab',
    category: 'window',
    context: 'global',
    description: 'New tab',
    keys: ['Meta', 't'],
    defaultKeys: ['Meta', 't'],
    action: 'newTab',
    enabled: true,
    editable: true,
  },
  {
    id: 'reopen-tab',
    category: 'window',
    context: 'global',
    description: 'Reopen closed tab',
    keys: ['Meta', 'Shift', 't'],
    defaultKeys: ['Meta', 'Shift', 't'],
    action: 'reopenTab',
    enabled: true,
    editable: true,
  },

  // Messaging
  {
    id: 'next-channel',
    category: 'messaging',
    context: 'chat',
    description: 'Next channel',
    keys: ['Alt', 'ArrowDown'],
    defaultKeys: ['Alt', 'ArrowDown'],
    action: 'nextChannel',
    enabled: true,
    editable: true,
  },
  {
    id: 'prev-channel',
    category: 'messaging',
    context: 'chat',
    description: 'Previous channel',
    keys: ['Alt', 'ArrowUp'],
    defaultKeys: ['Alt', 'ArrowUp'],
    action: 'prevChannel',
    enabled: true,
    editable: true,
  },
  {
    id: 'mark-read',
    category: 'messaging',
    context: 'chat',
    description: 'Mark as read',
    keys: ['Escape'],
    defaultKeys: ['Escape'],
    action: 'markRead',
    enabled: true,
    editable: true,
  },

  // Orchestrators
  {
    id: 'run-orchestrator',
    category: 'orchestrators',
    context: 'orchestrator',
    description: 'Run orchestrator',
    keys: ['Meta', 'Enter'],
    defaultKeys: ['Meta', 'Enter'],
    action: 'runOrchestrator',
    enabled: true,
    editable: true,
  },
  {
    id: 'stop-orchestrator',
    category: 'orchestrators',
    context: 'orchestrator',
    description: 'Stop orchestrator',
    keys: ['Meta', '.'],
    defaultKeys: ['Meta', '.'],
    action: 'stopOrchestrator',
    enabled: true,
    editable: true,
  },
];

/**
 * Shortcut presets
 */
export const SHORTCUT_PRESETS: ShortcutPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard keyboard shortcuts',
    shortcuts: DEFAULT_SHORTCUTS.reduce(
      (acc, shortcut) => {
        acc[shortcut.id] = shortcut.defaultKeys;
        return acc;
      },
      {} as Record<string, string[]>,
    ),
  },
  {
    id: 'vim',
    name: 'Vim',
    description: 'Vim-inspired shortcuts',
    shortcuts: {
      'go-to-dashboard': ['g', 'd'],
      'go-to-channels': ['g', 'c'],
      'go-to-orchestrators': ['g', 'o'],
      'go-to-workflows': ['g', 'w'],
      'go-to-analytics': ['g', 'a'],
      'next-channel': ['j'],
      'prev-channel': ['k'],
      search: ['/'],
      'create-new': ['i'],
      'close-dialog': ['Escape'],
      'toggle-sidebar': ['Meta', 'b'],
    },
  },
  {
    id: 'emacs',
    name: 'Emacs',
    description: 'Emacs-style shortcuts',
    shortcuts: {
      search: ['Control', 's'],
      save: ['Control', 'x', 'Control', 's'],
      'open-command-palette': ['Alt', 'x'],
      undo: ['Control', '/'],
      'close-dialog': ['Control', 'g'],
      'next-channel': ['Control', 'n'],
      'prev-channel': ['Control', 'p'],
    },
  },
];

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<
  ShortcutCategory,
  { label: string; icon: string; description: string }
> = {
  navigation: {
    label: 'Navigation',
    icon: 'Compass',
    description: 'Navigate between pages and sections',
  },
  actions: {
    label: 'Actions',
    icon: 'Zap',
    description: 'Perform common actions',
  },
  editing: {
    label: 'Editing',
    icon: 'Edit',
    description: 'Text editing and formatting',
  },
  window: {
    label: 'Window',
    icon: 'Layout',
    description: 'Window and tab management',
  },
  messaging: {
    label: 'Messaging',
    icon: 'MessageSquare',
    description: 'Chat and channel navigation',
  },
  orchestrators: {
    label: 'Orchestrators',
    icon: 'Bot',
    description: 'Orchestrator controls',
  },
  channels: {
    label: 'Channels',
    icon: 'Hash',
    description: 'Channel-specific actions',
  },
};

/**
 * Normalize key for cross-platform compatibility
 */
export function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    cmd: 'Meta',
    command: 'Meta',
    ctrl: 'Control',
    control: 'Control',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift',
    meta: 'Meta',
    escape: 'Escape',
    esc: 'Escape',
    enter: 'Enter',
    return: 'Enter',
    backspace: 'Backspace',
    delete: 'Delete',
    tab: 'Tab',
    space: ' ',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
  };

  const normalized = key.toLowerCase().trim();
  return keyMap[normalized] || key;
}

/**
 * Format key for display (platform-aware)
 */
export function formatKeyForDisplay(key: string, isMac: boolean): string {
  if (!isMac && key === 'Meta') {
    return 'Ctrl';
  }
  if (key === 'Meta' && isMac) {
    return '⌘';
  }
  if (key === 'Alt' && isMac) {
    return '⌥';
  }
  if (key === 'Shift') {
    return isMac ? '⇧' : 'Shift';
  }
  if (key === 'Control') {
    return isMac ? '⌃' : 'Ctrl';
  }
  return key;
}

/**
 * Check if two key combinations are equal
 */
export function keysEqual(keys1: string[], keys2: string[]): boolean {
  if (keys1.length !== keys2.length) {
    return false;
  }
  const normalized1 = keys1.map(normalizeKey).sort();
  const normalized2 = keys2.map(normalizeKey).sort();
  return normalized1.every((key, i) => key === normalized2[i]);
}

/**
 * Find conflicts between shortcuts
 */
export function findConflicts(
  shortcuts: KeyboardShortcut[],
): Array<{ shortcut1: KeyboardShortcut; shortcut2: KeyboardShortcut }> {
  const conflicts: Array<{
    shortcut1: KeyboardShortcut;
    shortcut2: KeyboardShortcut;
  }> = [];

  for (let i = 0; i < shortcuts.length; i++) {
    for (let j = i + 1; j < shortcuts.length; j++) {
      const s1 = shortcuts[i];
      const s2 = shortcuts[j];

      // Only check conflicts if both are enabled and in the same context or one is global
      if (
        s1.enabled &&
        s2.enabled &&
        (s1.context === s2.context ||
          s1.context === 'global' ||
          s2.context === 'global')
      ) {
        if (keysEqual(s1.keys, s2.keys)) {
          conflicts.push({ shortcut1: s1, shortcut2: s2 });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Storage key for persisted shortcuts
 */
export const SHORTCUTS_STORAGE_KEY = 'keyboard-shortcuts-config';

/**
 * Load shortcuts from localStorage
 */
export function loadShortcuts(): KeyboardShortcut[] {
  if (typeof window === 'undefined') {
    return DEFAULT_SHORTCUTS;
  }

  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SHORTCUTS;
    }

    const parsed = JSON.parse(stored);
    // Merge with defaults to ensure new shortcuts are included
    return DEFAULT_SHORTCUTS.map(defaultShortcut => {
      const customShortcut = parsed.find(
        (s: KeyboardShortcut) => s.id === defaultShortcut.id,
      );
      return customShortcut
        ? { ...defaultShortcut, ...customShortcut }
        : defaultShortcut;
    });
  } catch (error) {
    console.error('Failed to load shortcuts from localStorage:', error);
    return DEFAULT_SHORTCUTS;
  }
}

/**
 * Save shortcuts to localStorage
 */
export function saveShortcuts(shortcuts: KeyboardShortcut[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error('Failed to save shortcuts to localStorage:', error);
  }
}

/**
 * Export shortcuts configuration as JSON
 */
export function exportShortcuts(shortcuts: KeyboardShortcut[]): string {
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
    2,
  );
}

/**
 * Import shortcuts configuration from JSON
 */
export function importShortcuts(
  json: string,
): KeyboardShortcut[] | { error: string } {
  try {
    const data = JSON.parse(json);

    if (!data.shortcuts || !Array.isArray(data.shortcuts)) {
      return { error: 'Invalid shortcuts configuration format' };
    }

    const imported = DEFAULT_SHORTCUTS.map(defaultShortcut => {
      const importedShortcut = data.shortcuts.find(
        (s: { id: string }) => s.id === defaultShortcut.id,
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

    return imported;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to parse JSON file',
    };
  }
}
