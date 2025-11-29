import { redirect, notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getWorkspaceId } from '@/lib/workspace';

import { DashboardContent } from './dashboard-content';

interface DashboardPageProps {
  params: Promise<{
    workspaceSlug: string;
  }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { workspaceSlug } = await params;

  // Resolve slug to workspace ID
  const workspaceId = await getWorkspaceId(workspaceSlug);
  if (!workspaceId) {
    notFound();
  }

  return (
    <DashboardContent
      workspaceId={workspaceId}
    />
  );
}
