/**
 * Email Settings Page - Redirects to Notifications
 *
 * Email preferences have been consolidated into the Notifications settings page
 * for a better user experience. This page redirects to the notifications page
 * with the email tab pre-selected.
 */

import { redirect } from 'next/navigation';

interface EmailSettingsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function EmailSettingsPage({
  params,
}: EmailSettingsPageProps) {
  const { workspaceSlug } = await params;

  // Redirect to notifications page
  // TODO: Add hash/query param to auto-select email tab when navigation supports it
  redirect(`/${workspaceSlug}/settings/notifications`);
}
