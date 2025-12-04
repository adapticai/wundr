import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { SettingsLayoutClient } from './settings-layout-client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and workspace settings',
};

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * Settings section layout with Slack-inspired sidebar navigation
 */
export default async function SettingsLayout({
  children,
  params,
}: SettingsLayoutProps) {
  const { workspaceSlug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Find workspace by ID or slug
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    select: { id: true, slug: true, name: true },
  });

  if (!workspace) {
    redirect('/');
  }

  // Verify user has access to this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
  });

  if (!membership) {
    // User doesn't have access to this workspace
    // Find their first workspace and redirect to its settings
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        workspace: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
      take: 1,
    });

    // If user has a workspace, redirect to its settings
    if (userWorkspaces.length > 0) {
      const firstWorkspaceId = userWorkspaces[0].workspace.id;
      redirect(`/${firstWorkspaceId}/settings`);
    }

    // No workspaces - redirect to onboarding
    redirect('/onboarding');
  }

  const navSections: NavSection[] = [
    {
      title: 'Account',
      items: [
        {
          href: `/${workspaceSlug}/settings/profile`,
          label: 'Profile',
          icon: 'User',
        },
        {
          href: `/${workspaceSlug}/settings/security`,
          label: 'Security',
          icon: 'Shield',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          href: `/${workspaceSlug}/settings/notifications`,
          label: 'Notifications',
          icon: 'Bell',
        },
        {
          href: `/${workspaceSlug}/settings/appearance`,
          label: 'Appearance',
          icon: 'Palette',
        },
        {
          href: `/${workspaceSlug}/settings/accessibility`,
          label: 'Accessibility',
          icon: 'Eye',
        },
      ],
    },
  ];

  return (
    <SettingsLayoutClient
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      sections={navSections}
    >
      {children}
    </SettingsLayoutClient>
  );
}
