/**
 * Orchestrator Settings Page
 *
 * Self-service configuration page for orchestrators to manage their settings.
 * Accessible when logged in AS the orchestrator.
 *
 * @module app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/settings/page
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

import { OrchestratorSettingsForm } from './components/OrchestratorSettingsForm';
import { SettingsSkeleton } from './components/SettingsSkeleton';

interface PageProps {
  params: Promise<{
    workspaceSlug: string;
    orchestratorId: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Orchestrator Settings',
  description: 'Configure your orchestrator settings and capabilities',
};

async function getOrchestratorData(orchestratorId: string, userId: string) {
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      config: true,
    },
  });

  if (!orchestrator) {
    return null;
  }

  // Check if user is the orchestrator or an admin
  const isOwner = orchestrator.userId === userId;

  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orchestrator.organizationId,
        userId,
      },
    },
  });

  const isAdmin = orgMember?.role === 'ADMIN' || orgMember?.role === 'OWNER';

  if (!isOwner && !isAdmin) {
    return null;
  }

  return {
    orchestrator,
    isOwner,
    isAdmin,
  };
}

export default async function OrchestratorSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const resolvedParams = await params;
  const data = await getOrchestratorData(
    resolvedParams.orchestratorId,
    session.user.id
  );

  if (!data) {
    notFound();
  }

  return (
    <div className='container mx-auto max-w-6xl py-8 px-4'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold tracking-tight'>
          Orchestrator Settings
        </h1>
        <p className='text-muted-foreground mt-2'>
          Configure your orchestrator capabilities, triggers, and behavior
        </p>
      </div>

      <Suspense fallback={<SettingsSkeleton />}>
        <OrchestratorSettingsForm
          orchestrator={data.orchestrator}
          isAdmin={data.isAdmin}
          workspaceSlug={resolvedParams.workspaceSlug}
        />
      </Suspense>
    </div>
  );
}
