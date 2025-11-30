import { redirect } from 'next/navigation';

/**
 * Admin Settings Page
 *
 * Redirects to the General settings page
 */
export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/admin/settings/general`);
}
