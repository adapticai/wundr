/**
 * Orchestrator API Helper Functions
 *
 * Shared helper functions for orchestrator API routes to avoid duplication
 * and circular dependencies.
 *
 * @module lib/api/orchestrator-helpers
 */

import { prisma } from '@neolith/database';

/**
 * Check if a user has access to an orchestrator
 *
 * @param orchestratorId - The orchestrator ID to check access for
 * @param userId - The user ID requesting access
 * @returns Access information including whether user has access, is owner, or is admin
 */
export async function checkOrchestratorAccess(
  orchestratorId: string,
  userId: string,
) {
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: { id: true },
      },
      organization: {
        select: { id: true },
      },
    },
  });

  if (!orchestrator) {
    return { hasAccess: false, isOwner: false, orchestrator: null };
  }

  // Check if user is the orchestrator owner
  const isOwner = orchestrator.userId === userId;

  // Check if user is admin in organization
  const orgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orchestrator.organizationId,
        userId,
      },
    },
  });

  const isAdmin = orgMember?.role === 'ADMIN' || orgMember?.role === 'OWNER';

  return {
    hasAccess: isOwner || isAdmin,
    isOwner,
    isAdmin,
    orchestrator,
  };
}
