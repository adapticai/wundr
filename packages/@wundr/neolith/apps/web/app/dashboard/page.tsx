import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Dashboard Redirect Page
 *
 * This page handles routing logic for the /dashboard route:
 * 1. If user is not authenticated -> redirect to /login
 * 2. If user has no workspaces -> redirect to /workspaces (workspace selection/creation page)
 * 3. If user has workspaces -> redirect to most recently accessed workspace dashboard
 *
 * @returns Never returns - always redirects
 */
export default async function DashboardPage() {
  // Check authentication
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Query user's workspace memberships, ordered by most recently joined
  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    take: 1, // Only need the most recent one
  });

  // If user has no workspaces, send them to workspace selection
  if (workspaceMemberships.length === 0) {
    redirect('/workspaces');
  }

  // Redirect to most recently accessed workspace dashboard
  const mostRecentWorkspace = workspaceMemberships[0].workspace;
  redirect(`/${mostRecentWorkspace.id}/dashboard`);
}
