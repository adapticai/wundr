/**
 * Orchestrator Charter Version API Route
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/charter/:versionId - Fetch a specific charter version
 * - POST /api/orchestrators/:orchestratorId/charter/:versionId - Activate this version
 *
 * @module app/api/orchestrators/[orchestratorId]/charter/[versionId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse, CHARTER_ERROR_CODES } from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

interface VersionRouteContext {
  params: Promise<{ orchestratorId: string; versionId: string }>;
}

async function checkOrchestratorAccess(orchestratorId: string, userId: string) {
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    select: {
      id: true,
      organizationId: true,
      role: true,
      discipline: true,
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * GET /api/orchestrators/:orchestratorId/charter/:versionId
 *
 * Fetch a specific charter version by its ID.
 */
export async function GET(
  _request: NextRequest,
  context: VersionRouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { orchestratorId, versionId } = params;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.VALIDATION_ERROR, 'Orchestrator ID is required'),
        { status: 400 }
      );
    }

    if (!versionId) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.VALIDATION_ERROR, 'Version ID is required'),
        { status: 400 }
      );
    }

    const access = await checkOrchestratorAccess(orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found or access denied'
        ),
        { status: 404 }
      );
    }

    const version = await prisma.charterVersion.findUnique({
      where: { id: versionId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        orchestrator: {
          select: {
            id: true,
            organizationId: true,
            role: true,
            discipline: true,
          },
        },
      },
    });

    if (!version || version.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: version });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/charter/:versionId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(CHARTER_ERROR_CODES.INTERNAL_ERROR, 'An internal error occurred'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrators/:orchestratorId/charter/:versionId
 *
 * Activate this charter version. Deactivates all other versions for the same
 * charterId, then sets this version as active. Requires ADMIN or OWNER role.
 */
export async function POST(
  _request: NextRequest,
  context: VersionRouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { orchestratorId, versionId } = params;

    if (!orchestratorId) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.VALIDATION_ERROR, 'Orchestrator ID is required'),
        { status: 400 }
      );
    }

    if (!versionId) {
      return NextResponse.json(
        createErrorResponse(CHARTER_ERROR_CODES.VALIDATION_ERROR, 'Version ID is required'),
        { status: 400 }
      );
    }

    const access = await checkOrchestratorAccess(orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found or access denied'
        ),
        { status: 404 }
      );
    }

    if (access.role !== 'OWNER' && access.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions to activate charter version'
        ),
        { status: 403 }
      );
    }

    // Fetch the target version first to confirm it belongs to this orchestrator
    const targetVersion = await prisma.charterVersion.findUnique({
      where: { id: versionId },
      select: { id: true, orchestratorId: true, charterId: true },
    });

    if (!targetVersion || targetVersion.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    // Activate target version in a transaction: deactivate all others, activate this one
    const activatedVersion = await prisma.$transaction(async tx => {
      await tx.charterVersion.updateMany({
        where: {
          orchestratorId,
          charterId: targetVersion.charterId,
          isActive: true,
          id: { not: versionId },
        },
        data: { isActive: false },
      });

      return tx.charterVersion.update({
        where: { id: versionId },
        data: { isActive: true },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          orchestrator: {
            select: {
              id: true,
              organizationId: true,
              role: true,
              discipline: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      data: activatedVersion,
      message: 'Charter version activated successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/orchestrators/:orchestratorId/charter/:versionId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(CHARTER_ERROR_CODES.INTERNAL_ERROR, 'An internal error occurred'),
      { status: 500 }
    );
  }
}
