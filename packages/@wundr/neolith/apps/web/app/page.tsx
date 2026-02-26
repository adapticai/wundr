/**
 * Root Page - Handles authentication-based routing
 *
 * This page redirects users based on their authentication status:
 * - Unauthenticated users → /login
 * - Authenticated users with workspaces → their last-visited workspace dashboard
 * - Authenticated users without workspaces → /workspaces (selection/creation)
 *
 * @module app/page
 */

import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function HomePage() {
  // Check if user is authenticated
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // User is authenticated - check for preferred workspace
  try {
    // First, get the user's current workspace preference
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentWorkspaceSlug: true },
    });

    // If user has a saved workspace preference, verify they still have access
    if (user?.currentWorkspaceSlug) {
      const hasAccess = await prisma.workspaceMember.findFirst({
        where: {
          userId: session.user.id,
          workspace: { slug: user.currentWorkspaceSlug },
        },
      });

      if (hasAccess) {
        redirect(`/${user.currentWorkspaceSlug}/dashboard`);
      }
    }

    // Fall back to first workspace user has access to
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

    // If user has a workspace, redirect to it and save preference
    if (userWorkspaces.length > 0 && userWorkspaces[0]) {
      const workspaceSlug = userWorkspaces[0].workspace.slug;

      // Save this as their current workspace
      await prisma.user.update({
        where: { id: session.user.id },
        data: { currentWorkspaceSlug: workspaceSlug },
      });

      redirect(`/${workspaceSlug}/dashboard`);
    }

    // No workspace found - send user to workspace selection/creation
    redirect('/workspaces');
  } catch (error) {
    // Check if it's a redirect error (which is expected)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error; // Re-throw redirect errors
    }
    // If there's an actual error fetching workspaces, send to workspace selection
    console.error('Error fetching user workspaces:', error);
    redirect('/workspaces');
  }
}
