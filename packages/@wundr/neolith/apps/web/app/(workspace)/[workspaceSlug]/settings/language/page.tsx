/**
 * Language and Regional Settings Page
 * @module app/(workspace)/[workspaceId]/settings/language/page
 */

import { LanguageSettings } from '@/components/settings/language-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Language & Regional Settings',
  description: 'Configure language, timezone, and regional formatting preferences',
};

export default function LanguagePage() {
  return <LanguageSettings />;
}
