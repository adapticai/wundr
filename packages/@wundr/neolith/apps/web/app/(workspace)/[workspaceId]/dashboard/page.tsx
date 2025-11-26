import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { DashboardContent } from './dashboard-content';

interface DashboardPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const { workspaceId } = await params;

  return (
    <DashboardContent
      userName={session.user?.name || 'User'}
      workspaceId={workspaceId}
    />
  );
}
