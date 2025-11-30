import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { AdminSettingsLayoutClient } from './admin-settings-layout-client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Settings',
  description: 'Manage workspace settings and configuration',
};

interface AdminSettingsLayoutProps {
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
 * Admin Settings Layout with sidebar navigation
 * Accessible only to workspace admins and owners
 */
export default async function AdminSettingsLayout({
  children,
  params,
}: AdminSettingsLayoutProps) {
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
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
    },
  });

  if (!workspace) {
    redirect('/');
  }

  // Verify user has admin access to this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    redirect('/');
  }

  // Check if user is admin or owner
  const isAdmin = membership.role === 'ADMIN' || membership.role === 'OWNER';

  if (!isAdmin) {
    // Non-admin users are redirected to dashboard with a toast message
    // The toast will be handled by middleware or client-side redirect
    redirect(`/${workspaceSlug}/dashboard?error=unauthorized`);
  }

  // Get member and channel counts
  const [memberCount, channelCount] = await Promise.all([
    prisma.workspaceMember.count({
      where: { workspaceId: workspace.id },
    }),
    prisma.channel.count({
      where: { workspaceId: workspace.id },
    }),
  ]);

  const navSections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        {
          href: `/${workspaceSlug}/admin/settings/general`,
          label: 'General',
          icon: 'Building2',
        },
        {
          href: `/${workspaceSlug}/admin/settings/channels`,
          label: 'Channels',
          icon: 'Hash',
        },
      ],
    },
    {
      title: 'Members',
      items: [
        {
          href: `/${workspaceSlug}/admin/settings/members`,
          label: 'Members & Permissions',
          icon: 'Users',
        },
        {
          href: `/${workspaceSlug}/admin/settings/roles`,
          label: 'Roles',
          icon: 'UserCog',
        },
        {
          href: `/${workspaceSlug}/admin/settings/invitations`,
          label: 'Invitations',
          icon: 'Mail',
        },
      ],
    },
    {
      title: 'Apps',
      items: [
        {
          href: `/${workspaceSlug}/admin/settings/apps`,
          label: 'Installed Apps',
          icon: 'Plug',
        },
        {
          href: `/${workspaceSlug}/admin/settings/webhooks`,
          label: 'Webhooks',
          icon: 'Webhook',
        },
        {
          href: `/${workspaceSlug}/admin/settings/api`,
          label: 'API Settings',
          icon: 'Key',
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          href: `/${workspaceSlug}/admin/settings/security`,
          label: 'Security & Compliance',
          icon: 'Shield',
        },
        {
          href: `/${workspaceSlug}/admin/settings/audit-logs`,
          label: 'Audit Logs',
          icon: 'FileText',
        },
      ],
    },
    {
      title: 'Billing',
      items: [
        {
          href: `/${workspaceSlug}/admin/settings/plans`,
          label: 'Plans & Usage',
          icon: 'CreditCard',
        },
        {
          href: `/${workspaceSlug}/admin/settings/payment`,
          label: 'Payment Methods',
          icon: 'Wallet',
        },
      ],
    },
  ];

  return (
    <AdminSettingsLayoutClient
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      workspaceIcon={workspace.avatarUrl}
      userRole={membership.role}
      memberCount={memberCount}
      channelCount={channelCount}
      sections={navSections}
    >
      {children}
    </AdminSettingsLayoutClient>
  );
}
