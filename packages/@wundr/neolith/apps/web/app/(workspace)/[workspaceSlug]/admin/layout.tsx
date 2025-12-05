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
 * Admin section layout with comprehensive features:
 * - Role-based access control (ADMIN/OWNER only)
 * - Sidebar navigation with all admin sections
 * - Breadcrumb navigation
 * - Admin header with quick actions
 * - Collapsible sidebar
 * - Mobile-responsive navigation
 * - Quick search for admin features
 */
export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { workspaceSlug } = await params;
  const session = await auth();

  // Authentication check
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Find workspace by ID or slug
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    select: { id: true, name: true, slug: true },
  });

  if (!workspace) {
    redirect('/');
  }

  // Authorization check - only ADMIN and OWNER roles
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId: session.user.id,
    },
    select: {
      role: true,
    },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    redirect(`/${workspaceSlug}/dashboard`);
  }

  // Pass workspace and user data to client component
  return (
    <AdminLayoutClient
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      userRole={membership.role}
      userName={session.user.name || session.user.email || 'Admin'}
    >
      {children}
    </AdminLayoutClient>
  );
}
