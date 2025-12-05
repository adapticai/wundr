/**
 * Import/Export Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/import-export/page
 */

import { ImportExportSettings } from '@/components/settings/import-export-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Import/Export & Backup Settings',
  description: 'Manage your settings backups and data exports',
};

export default function ImportExportPage() {
  return <ImportExportSettings />;
}
