import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { AdminLayoutClient } from './admin-layout-client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Console',
  description: 'Manage your workspace settings, members, roles, and billing',
};

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Admin section layout with admin-only access check
 * The old sidebar has been removed - navigation is handled by sub-layouts
 * Main workspace sidebar is auto-collapsed when in admin routes
 */
export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
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
    select: { id: true },
  });

  if (!workspace) {
    redirect('/');
  }

  // Check if user is admin or owner of this workspace
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    redirect(`/${workspaceSlug}/dashboard`);
  }

  // Pass through to children - the AdminLayoutClient handles sidebar collapse
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
