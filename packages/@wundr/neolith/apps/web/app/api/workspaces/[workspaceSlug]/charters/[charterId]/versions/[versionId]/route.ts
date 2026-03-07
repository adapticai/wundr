/**
 * Workspace-Scoped Charter Version Detail API Routes
 *
 * Handles operations on a specific charter version.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId
 *     Get specific version content
 * - POST /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId
 *     Rollback to this version (creates new version with this content)
 *
 * @module app/api/workspaces/[workspaceSlug]/charters/[charterId]/versions/[versionId]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug, charter ID, and version ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    charterId: string;
    versionId: string;
  }>;
}

/**
 * Schema for rollback request body
 */
const rollbackRequestSchema = z.object({
  changeLog: z.string().min(1).max(1000).optional(),
});

/**
 * Helper to resolve workspace from slug and verify user membership
 */
async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    include: { organization: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId
 *
 * Get the content of a specific charter version by its record ID.
 * Returns full charter data along with creator info and orchestrator context.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug, charterId, versionId } = await context.params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Workspace not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Fetch the specific version, verified against charterId and org
    const version = await prisma.charterVersion.findFirst({
      where: {
        id: versionId,
        charterId,
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      select: {
        id: true,
        charterId: true,
        orchestratorId: true,
        version: true,
        charterData: true,
        changeLog: true,
        isActive: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
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
            discipline: true,
            role: true,
            organizationId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    // Get total version count for context
    const totalVersions = await prisma.charterVersion.count({
      where: { charterId, orchestratorId: version.orchestratorId },
    });

    return NextResponse.json({
      data: {
        ...version,
        totalVersions,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId
 *
 * Rollback to this version. Creates a new charter version using the content
 * of the target version, incrementing the version number. The new version
 * becomes the active version. The original target version is preserved unchanged.
 * Requires ADMIN or OWNER role in the organization.
 *
 * Request Body:
 * - changeLog: Optional description of the rollback reason
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug, charterId, versionId } = await context.params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Workspace not found or access denied'
        ),
        { status: 403 }
      );
    }

    // Require ADMIN or OWNER to perform rollbacks
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Organization Admin or Owner role required to rollback charter versions.'
        ),
        { status: 403 }
      );
    }

    // Parse optional request body
    let changeLog: string | undefined;
    try {
      const body = await request.json();
      const parseResult = rollbackRequestSchema.safeParse(body);
      if (parseResult.success) {
        changeLog = parseResult.data.changeLog;
      }
    } catch {
      // Body is optional for rollback; proceed without changeLog
    }

    // Find the target version to rollback to
    const targetVersion = await prisma.charterVersion.findFirst({
      where: {
        id: versionId,
        charterId,
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      select: {
        id: true,
        charterId: true,
        orchestratorId: true,
        version: true,
        charterData: true,
      },
    });

    if (!targetVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VERSION_NOT_FOUND,
          'Charter version not found'
        ),
        { status: 404 }
      );
    }

    // Get current max version for this charter
    const maxVersionRecord = await prisma.charterVersion.findFirst({
      where: {
        charterId,
        orchestratorId: targetVersion.orchestratorId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (maxVersionRecord?.version ?? 0) + 1;
    const rollbackChangeLog =
      changeLog ??
      `Version ${nextVersion}: Rollback to version ${targetVersion.version}`;

    // Create new version with the target version's data in a transaction
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate all currently active versions
      await tx.charterVersion.updateMany({
        where: {
          charterId,
          orchestratorId: targetVersion.orchestratorId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new version with the rolled-back content
      return tx.charterVersion.create({
        data: {
          charterId,
          orchestratorId: targetVersion.orchestratorId,
          version: nextVersion,
          charterData:
            targetVersion.charterData as unknown as Prisma.InputJsonValue,
          changeLog: rollbackChangeLog,
          createdBy: session.user.id,
          isActive: true,
        },
        select: {
          id: true,
          charterId: true,
          orchestratorId: true,
          version: true,
          charterData: true,
          changeLog: true,
          isActive: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
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
              discipline: true,
              role: true,
              organizationId: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        data: newVersion,
        message: `Charter rolled back to version ${targetVersion.version}. New version ${nextVersion} created.`,
        rolledBackFromVersion: targetVersion.version,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/charters/:charterId/versions/:versionId] Error:',
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.DUPLICATE_VERSION,
          'A charter version with this number already exists'
        ),
        { status: 409 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}
