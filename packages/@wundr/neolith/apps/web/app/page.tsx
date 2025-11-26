/**
 * Root Page - Handles authentication-based routing
 *
 * This page redirects users based on their authentication status:
 * - Unauthenticated users → /login
 * - Authenticated users → their first workspace dashboard
 *
 * @module app/page
 */

import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

// Default workspace for users without any workspaces
const DEFAULT_WORKSPACE = 'neolith';

export default async function HomePage() {
  // Check if user is authenticated
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // User is authenticated - find their workspaces
  try {
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        workspace: true,
      },
      orderBy: {
        joinedAt: 'asc', // Get the first workspace they joined
      },
      take: 1,
    });

    // If user has a workspace, redirect to it
    if (userWorkspaces.length > 0 && userWorkspaces[0]) {
      const workspaceId = userWorkspaces[0].workspace.id;
      redirect(`/${workspaceId}/dashboard`);
    }

    // No workspace found - redirect to default workspace
    redirect(`/${DEFAULT_WORKSPACE}/dashboard`);
  } catch (error) {
    // If there's an error fetching workspaces, redirect to default workspace
    console.error('Error fetching user workspaces:', error);
    redirect(`/${DEFAULT_WORKSPACE}/dashboard`);
  }
}
