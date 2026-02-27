/**
 * Keyboard Shortcuts Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/keyboard-shortcuts/page
 */

import { KeyboardShortcutsSettings } from '@/components/settings/keyboard-shortcuts-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Keyboard Shortcuts',
  description: 'Customize keyboard shortcuts to match your workflow',
};

export default function KeyboardShortcutsPage() {
  return <KeyboardShortcutsSettings />;
}
