import { redirect, notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getWorkspaceWithAccess } from '@/lib/workspace';

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

  // Resolve slug to workspace ID and check user access
  const workspaceAccess = await getWorkspaceWithAccess(
    workspaceSlug,
    session.user.id
  );
  if (!workspaceAccess) {
    notFound();
  }

  return <DashboardContent workspaceId={workspaceAccess.id} />;
}
