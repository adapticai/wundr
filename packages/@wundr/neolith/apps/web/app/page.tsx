/**
 * Root Page - Handles authentication-based routing
 *
 * This page redirects users based on their authentication status:
 * - Unauthenticated users → /login
 * - Authenticated users → their first workspace or /dashboard
 *
 * @module app/page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

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
      redirect(`/${workspaceId}/vps`);
    }

    // No workspace found - redirect to dashboard
    redirect('/dashboard');
  } catch (error) {
    // If there's an error fetching workspaces, redirect to dashboard
    console.error('Error fetching user workspaces:', error);
    redirect('/dashboard');
  }
}
