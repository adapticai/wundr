/**
 * Workspace-Scoped Charter Detail API Routes
 *
 * Handles single charter operations within a workspace context.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/charters/:charterId - Get charter with latest version
 * - PUT /api/workspaces/:workspaceSlug/charters/:charterId - Update charter (creates new version)
 * - DELETE /api/workspaces/:workspaceSlug/charters/:charterId - Archive charter (soft delete)
 *
 * @module app/api/workspaces/[workspaceSlug]/charters/[charterId]/route
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
 * Route context with workspace slug and charter ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; charterId: string }>;
}

/**
 * Schema for updating a charter (creates a new version)
 */
const updateCharterBodySchema = z.object({
  charterData: z
    .record(z.unknown())
    .refine(data => data['tier'] === 1 || data['tier'] === 2, {
      message:
        'charterData must have tier field set to 1 (orchestrator) or 2 (session-manager)',
    }),
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
 * Helper to find the latest active version of a charter within an org
 */
async function findCharterLatestVersion(
  charterId: string,
  organizationId: string
) {
  return prisma.charterVersion.findFirst({
    where: {
      charterId,
      orchestrator: { organizationId },
    },
    orderBy: { version: 'desc' },
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
}

/**
 * GET /api/workspaces/:workspaceSlug/charters/:charterId
 *
 * Get charter details with the latest version content.
 * Also returns the total number of versions for this charter.
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

    const { workspaceSlug, charterId } = await context.params;

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

    const [latestVersion, versionCount] = await Promise.all([
      findCharterLatestVersion(charterId, access.workspace.organizationId),
      prisma.charterVersion.count({
        where: {
          charterId,
          orchestrator: { organizationId: access.workspace.organizationId },
        },
      }),
    ]);

    if (!latestVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...latestVersion,
        totalVersions: versionCount,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/charters/:charterId] Error:',
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
 * PUT /api/workspaces/:workspaceSlug/charters/:charterId
 *
 * Update a charter by creating a new version. The previous version is
 * deactivated and a new version with incremented version number is created.
 * Requires ADMIN or OWNER role in the organization.
 *
 * Request Body:
 * - charterData: Updated charter JSON (must include tier field: 1 or 2)
 * - changeLog: Optional description of what changed in this version
 */
export async function PUT(
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

    const { workspaceSlug, charterId } = await context.params;

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

    // Require ADMIN or OWNER to update charters
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Organization Admin or Owner role required to update charters.'
        ),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON body'
        ),
        { status: 400 }
      );
    }

    const parseResult = updateCharterBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Find the existing charter to get orchestratorId and current version
    const existingVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId,
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      orderBy: { version: 'desc' },
      select: {
        orchestratorId: true,
        version: true,
        isActive: true,
      },
    });

    if (!existingVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found'
        ),
        { status: 404 }
      );
    }

    const nextVersion = existingVersion.version + 1;

    // Create new version in a transaction: deactivate current, create new
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate all active versions for this charter
      await tx.charterVersion.updateMany({
        where: {
          charterId,
          orchestratorId: existingVersion.orchestratorId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new active version
      return tx.charterVersion.create({
        data: {
          charterId,
          orchestratorId: existingVersion.orchestratorId,
          version: nextVersion,
          charterData: input.charterData as unknown as Prisma.InputJsonValue,
          changeLog:
            input.changeLog ?? `Version ${nextVersion}: Charter updated`,
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

    return NextResponse.json({
      data: newVersion,
      message: 'Charter updated successfully. New version created.',
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/charters/:charterId] Error:',
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

/**
 * DELETE /api/workspaces/:workspaceSlug/charters/:charterId
 *
 * Archive a charter (soft delete). Deactivates all versions of the charter
 * by setting isActive to false. Does not remove records from the database.
 * Requires ADMIN or OWNER role in the organization.
 */
export async function DELETE(
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

    const { workspaceSlug, charterId } = await context.params;

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

    // Only OWNER or ADMIN can archive charters
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Organization Admin or Owner role required to archive charters.'
        ),
        { status: 403 }
      );
    }

    // Verify the charter exists within this org
    const existingVersion = await prisma.charterVersion.findFirst({
      where: {
        charterId,
        orchestrator: { organizationId: access.workspace.organizationId },
      },
      select: { orchestratorId: true },
    });

    if (!existingVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found'
        ),
        { status: 404 }
      );
    }

    // Soft delete: deactivate all versions
    const { count } = await prisma.charterVersion.updateMany({
      where: {
        charterId,
        orchestratorId: existingVersion.orchestratorId,
      },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: `Charter archived successfully. ${count} version(s) deactivated.`,
      charterId,
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceSlug/charters/:charterId] Error:',
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
