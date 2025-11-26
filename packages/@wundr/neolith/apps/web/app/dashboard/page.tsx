/**
 * Dashboard Redirect Page
 *
 * This page handles the post-authentication redirect logic:
 * 1. If user has workspace memberships, redirect to most recently accessed workspace
 * 2. If user has no workspaces, redirect to onboarding to create one
 *
 * @module app/dashboard/page
 */

import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function DashboardRedirectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Find user's workspace memberships, ordered by most recent join
  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      workspace: {
        select: {
          id: true,
          slug: true,
          organization: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    take: 1,
  });

  // If user has a workspace, redirect to its dashboard
  if (workspaceMemberships.length > 0) {
    const workspace = workspaceMemberships[0].workspace;
    redirect(`/${workspace.id}/dashboard`);
  }

  // Check if user has any organization memberships
  const orgMemberships = await prisma.organizationMember.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      organization: {
        include: {
          workspaces: {
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    take: 1,
  });

  // If user has an org with workspaces, redirect to first workspace
  if (orgMemberships.length > 0 && orgMemberships[0].organization.workspaces.length > 0) {
    const workspaceId = orgMemberships[0].organization.workspaces[0].id;
    redirect(`/${workspaceId}/dashboard`);
  }

  // User has no workspaces - send to onboarding
  redirect('/onboarding');
}
