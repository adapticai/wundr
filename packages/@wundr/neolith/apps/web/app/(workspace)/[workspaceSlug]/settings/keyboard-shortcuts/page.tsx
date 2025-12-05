/**
 * Keyboard Shortcuts Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/keyboard-shortcuts/page
 */
'use client';

import { useEffect } from 'react';

import { KeyboardShortcutsSettings } from '@/components/settings/keyboard-shortcuts-settings';
import { usePageHeader } from '@/contexts/page-header-context';

export default function KeyboardShortcutsPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      'Keyboard Shortcuts',
      'Customize keyboard shortcuts to match your workflow'
    );
  }, [setPageHeader]);

  return (
    <div className='max-w-5xl mx-auto p-6'>
      <KeyboardShortcutsSettings />
    </div>
  );
}
