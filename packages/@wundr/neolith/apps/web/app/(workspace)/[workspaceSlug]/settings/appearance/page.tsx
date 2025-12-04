/**
 * Appearance Settings Page
 * @module app/(workspace)/[workspaceId]/settings/appearance/page
 */

import { AppearanceSettings } from '@/components/settings/appearance-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Appearance Settings',
  description: 'Customize the appearance of your workspace',
};

export default function AppearancePage() {
  return <AppearanceSettings />;
}
