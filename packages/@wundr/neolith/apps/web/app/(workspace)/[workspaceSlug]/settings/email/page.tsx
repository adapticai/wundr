/**
 * Email Settings Page - Redirects to Notifications
 *
 * Email preferences have been consolidated into the Notifications settings page
 * for a better user experience. This page redirects to the notifications page.
 */

import { redirect } from 'next/navigation';

interface EmailSettingsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function EmailSettingsPage({
  params,
}: EmailSettingsPageProps) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/settings/notifications`);
}
