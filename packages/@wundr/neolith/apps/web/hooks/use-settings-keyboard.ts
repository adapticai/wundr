'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface UseSettingsKeyboardOptions {
  workspaceSlug: string;
  onOpenSearch?: () => void;
  onOpenQuickSettings?: () => void;
  onSave?: () => void;
}

export function useSettingsKeyboard(options: UseSettingsKeyboardOptions) {
  const { workspaceSlug, onOpenSearch, onOpenQuickSettings, onSave } = options;
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenSearch?.();
      }

      // Command/Ctrl + , for quick settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        onOpenQuickSettings?.();
      }

      // Command/Ctrl + S for save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }

      // Command/Ctrl + [ to go back
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        router.back();
      }

      // Escape to go to settings home
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeElement = document.activeElement;
        // Only trigger if not in an input or dialog
        if (
          activeElement?.tagName !== 'INPUT' &&
          activeElement?.tagName !== 'TEXTAREA' &&
          !activeElement?.closest('[role="dialog"]')
        ) {
          router.push(`/${workspaceSlug}/settings`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceSlug, onOpenSearch, onOpenQuickSettings, onSave, router]);
}
