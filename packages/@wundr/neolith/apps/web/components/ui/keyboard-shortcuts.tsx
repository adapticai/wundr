/**
 * Keyboard Shortcuts Component
 * Display available keyboard shortcuts organized by category
 * @module components/ui/keyboard-shortcuts
 */
'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ['Cmd', 'K'], description: 'Open command palette', category: 'Navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close dialog/modal', category: 'Navigation' },
  { keys: ['Cmd', '1'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['Cmd', '2'], description: 'Go to Channels', category: 'Navigation' },
  { keys: ['Cmd', '3'], description: 'Go to Virtual People', category: 'Navigation' },
  { keys: ['Cmd', '4'], description: 'Go to Workflows', category: 'Navigation' },
  { keys: ['Cmd', '5'], description: 'Go to Analytics', category: 'Navigation' },

  // Actions
  { keys: ['Cmd', 'N'], description: 'Create new item', category: 'Actions' },
  { keys: ['Cmd', 'S'], description: 'Save changes', category: 'Actions' },
  { keys: ['Cmd', 'Enter'], description: 'Submit form/Send message', category: 'Actions' },
  { keys: ['Cmd', 'Shift', 'P'], description: 'Open settings', category: 'Actions' },
  { keys: ['Cmd', '/'], description: 'Toggle sidebar', category: 'Actions' },
  { keys: ['Cmd', 'B'], description: 'Toggle bold', category: 'Actions' },
  { keys: ['Cmd', 'I'], description: 'Toggle italic', category: 'Actions' },

  // Editing
  { keys: ['Cmd', 'Z'], description: 'Undo', category: 'Editing' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo', category: 'Editing' },
  { keys: ['Cmd', 'C'], description: 'Copy', category: 'Editing' },
  { keys: ['Cmd', 'X'], description: 'Cut', category: 'Editing' },
  { keys: ['Cmd', 'V'], description: 'Paste', category: 'Editing' },
  { keys: ['Cmd', 'A'], description: 'Select all', category: 'Editing' },
  { keys: ['Cmd', 'F'], description: 'Find in page', category: 'Editing' },

  // Window Management
  { keys: ['Cmd', 'W'], description: 'Close tab/window', category: 'Window' },
  { keys: ['Cmd', 'T'], description: 'New tab', category: 'Window' },
  { keys: ['Cmd', 'Shift', 'T'], description: 'Reopen closed tab', category: 'Window' },
  { keys: ['Cmd', '['], description: 'Go back', category: 'Window' },
  { keys: ['Cmd', ']'], description: 'Go forward', category: 'Window' },
];

interface KeyboardShortcutsProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KeyboardShortcuts({ open: controlledOpen, onOpenChange }: KeyboardShortcutsProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Open with "?" key
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if typing in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
      // Close with Escape
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatKey = (key: string): string => {
    if (!isMac) {
      if (key === 'Cmd') {
return 'Ctrl';
}
    }
    return key;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="px-2 py-1 text-xs bg-muted rounded">?</kbd> to toggle this dialog
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3 text-foreground">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && (
                            <span className="text-xs text-muted-foreground mx-1">+</span>
                          )}
                          <kbd
                            className={cn(
                              'px-2 py-1 text-xs font-semibold',
                              'bg-background border border-border rounded',
                              'shadow-sm',
                              'min-w-[2rem] text-center',
                            )}
                          >
                            {formatKey(key)}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
          <p>
            Note: On Windows and Linux, use <kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl</kbd> instead of{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Cmd</kbd>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trigger component for keyboard shortcuts dialog
 */
interface KeyboardShortcutsTriggerProps {
  className?: string;
}

export function KeyboardShortcutsTrigger({ className }: KeyboardShortcutsTriggerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center justify-center',
          'text-sm text-muted-foreground hover:text-foreground',
          'transition-colors',
          className,
        )}
        aria-label="Show keyboard shortcuts"
      >
        <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">?</kbd>
        <span className="ml-2">Keyboard Shortcuts</span>
      </button>
      <KeyboardShortcuts open={open} onOpenChange={setOpen} />
    </>
  );
}
