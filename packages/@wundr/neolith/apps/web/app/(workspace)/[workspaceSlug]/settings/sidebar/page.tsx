/**
 * Sidebar Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/sidebar/page
 */

import { SidebarSettings } from '@/components/settings/sidebar-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sidebar Settings',
  description: 'Customize your sidebar layout and organization',
};

export default function SidebarSettingsPage() {
  return <SidebarSettings />;
}
