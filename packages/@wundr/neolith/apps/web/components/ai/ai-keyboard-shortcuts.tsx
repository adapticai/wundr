'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AIKeyboardShortcutsProps {
  workspaceSlug: string;
  onNewChat?: () => void;
  onSearch?: () => void;
  onToggleSidebar?: () => void;
}

/**
 * AI Chat keyboard shortcuts component
 * Handles global keyboard shortcuts for AI chat functionality
 */
export function AIKeyboardShortcuts({
  workspaceSlug,
  onNewChat,
  onSearch,
  onToggleSidebar,
}: AIKeyboardShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Cmd/Ctrl + K - New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !isInput) {
        e.preventDefault();
        onNewChat?.() || router.push(`/${workspaceSlug}/ai`);
      }

      // Cmd/Ctrl + / - Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === '/' && !isInput) {
        e.preventDefault();
        onToggleSidebar?.();
      }

      // Cmd/Ctrl + F - Search conversations
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !isInput) {
        e.preventDefault();
        onSearch?.();
      }

      // Escape - Clear focus from search or close sidebar
      if (e.key === 'Escape') {
        if (target.getAttribute('data-search-input')) {
          (target as HTMLInputElement).blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceSlug, onNewChat, onSearch, onToggleSidebar, router]);

  return null;
}

/**
 * Hook for AI chat keyboard shortcuts
 */
export function useAIKeyboardShortcuts(
  workspaceSlug: string,
  handlers: Omit<AIKeyboardShortcutsProps, 'workspaceSlug'>
) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !isInput) {
        e.preventDefault();
        handlers.onNewChat?.() || router.push(`/${workspaceSlug}/ai`);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '/' && !isInput) {
        e.preventDefault();
        handlers.onToggleSidebar?.();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !isInput) {
        e.preventDefault();
        handlers.onSearch?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceSlug, handlers, router]);
}
