/**
 * Admin API Keys Management Page
 *
 * Comprehensive API key management with:
 * - List of API keys with name, created date, last used
 * - Create new API key with permissions scope
 * - Regenerate/revoke API keys
 * - Key usage analytics
 * - Rate limit configuration per key
 * - IP restrictions per key
 * - Expiry settings
 *
 * @module app/(workspace)/[workspaceSlug]/admin/api-keys/page
 */

import { prisma } from '@neolith/database';
import { redirect } from 'next/navigation';

import { ApiKeysManagement } from '@/components/admin/api-keys-management';
import { auth } from '@/lib/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys - Admin',
  description: 'Manage API keys for programmatic access',
};

interface PageProps {
  params: Promise<{
    workspaceSlug: string;
  }>;
}

export default async function AdminApiKeysPage({ params }: PageProps) {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { workspaceSlug } = await params;

  // Verify workspace access and admin permissions
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    include: {
      workspaceMembers: {
        where: { userId: session.user.id },
      },
    },
  });

  if (!workspace || workspace.workspaceMembers.length === 0) {
    redirect('/');
  }

  const membership = workspace.workspaceMembers[0];

  // Only ADMIN and OWNER can manage API keys
  if (!['ADMIN', 'OWNER'].includes(membership.role)) {
    redirect(`/${workspaceSlug}`);
  }

  return (
    <div className='flex flex-col gap-6 p-6'>
      <div className='flex flex-col gap-2'>
        <h1 className='text-3xl font-bold tracking-tight'>API Keys</h1>
        <p className='text-muted-foreground'>
          Manage API keys for programmatic access to your workspace. Create,
          revoke, and configure rate limits and permissions.
        </p>
      </div>

      <ApiKeysManagement workspaceSlug={workspaceSlug} />
    </div>
  );
}
