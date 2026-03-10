/**
 * Orchestrator-Specific Charter API Routes
 *
 * Handles reading and updating the active charter for a specific orchestrator,
 * identified by slug or ID within a workspace context.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter
 *     Get the active charter for an orchestrator
 * - PUT /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter
 *     Update the orchestrator's charter (creates new version)
 *
 * @module app/api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/charter/route
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
 * Route context with workspace slug and orchestrator slug parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Schema for updating an orchestrator's charter
 */
const updateOrchestratorCharterSchema = z.object({
  charterData: z
    .record(z.unknown())
    .refine(data => data['tier'] === 1 || data['tier'] === 2, {
      message:
        'charterData must include tier field set to 1 (orchestrator) or 2 (session-manager)',
    }),
  charterId: z.string().optional(),
  changeLog: z.string().min(1).max(1000).optional(),
});

/**
 * Resolve workspace from slug/ID and verify user membership
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
 * Resolve an orchestrator by slug (user slug) or ID within an organization.
 * Orchestrators are resolved via their associated user's slug-like name or directly by ID.
 */
async function resolveOrchestrator(
  orchestratorId: string,
  organizationId: string
) {
  // First try by direct ID
  const byId = await prisma.orchestrator.findFirst({
    where: {
      id: orchestratorId,
      organizationId,
    },
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
  });

  if (byId) {
    return byId;
  }

  // Then try to resolve by the user's name (slug-style match)
  // Orchestrators can be referenced by the user's display name or email prefix
  const byUserSlug = await prisma.orchestrator.findFirst({
    where: {
      organizationId,
      user: {
        OR: [
          // Match slug-style: name with hyphens replaced by spaces (case insensitive)
          {
            name: {
              equals: orchestratorId.replace(/-/g, ' '),
              mode: 'insensitive',
            },
          },
          // Match email prefix (before @)
          {
            email: {
              startsWith: orchestratorId,
              mode: 'insensitive',
            },
          },
        ],
      },
    },
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
  });

  return byUserSlug ?? null;
}

/**
 * GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter
 *
 * Get the active charter for an orchestrator. Returns the latest active version
 * of the charter for this orchestrator, along with version history metadata.
 *
 * The orchestratorId can be either the orchestrator's database ID or a
 * slug-style reference derived from the orchestrator's name.
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

    const { workspaceSlug, orchestratorId } = await context.params;

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

    const orchestrator = await resolveOrchestrator(
      orchestratorId,
      access.workspace.organizationId
    );

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found'
        ),
        { status: 404 }
      );
    }

    // Fetch the active charter version for this orchestrator
    const [activeVersion, totalVersionCount] = await Promise.all([
      prisma.charterVersion.findFirst({
        where: {
          orchestratorId: orchestrator.id,
          isActive: true,
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
        },
      }),
      prisma.charterVersion.count({
        where: { orchestratorId: orchestrator.id },
      }),
    ]);

    if (!activeVersion) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.NO_ACTIVE_VERSION,
          'No active charter found for this orchestrator'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...activeVersion,
        totalVersions: totalVersionCount,
        orchestrator: {
          id: orchestrator.id,
          discipline: orchestrator.discipline,
          role: orchestrator.role,
          user: orchestrator.user,
        },
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter] Error:',
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
 * PUT /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter
 *
 * Update the active charter for an orchestrator by creating a new version.
 * Deactivates the current active version and creates a new one with an
 * incremented version number. If no charter exists, creates version 1.
 * Requires ADMIN or OWNER role in the organization.
 *
 * Request Body:
 * - charterData: Updated charter JSON (must include tier field: 1 or 2)
 * - charterId: Optional stable charter ID (uses existing or generates new)
 * - changeLog: Optional description of what changed
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

    const { workspaceSlug, orchestratorId } = await context.params;

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

    // Require ADMIN or OWNER to update orchestrator charters
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Organization Admin or Owner role required to update orchestrator charters.'
        ),
        { status: 403 }
      );
    }

    const orchestrator = await resolveOrchestrator(
      orchestratorId,
      access.workspace.organizationId
    );

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          'Orchestrator not found'
        ),
        { status: 404 }
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

    const parseResult = updateOrchestratorCharterSchema.safeParse(body);
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

    // Find existing charter for this orchestrator to determine charterId and next version
    const existingLatest = await prisma.charterVersion.findFirst({
      where: { orchestratorId: orchestrator.id },
      orderBy: { version: 'desc' },
      select: { charterId: true, version: true },
    });

    // Determine charterId: use provided, or inherit from existing, or generate
    const charterId =
      input.charterId ??
      existingLatest?.charterId ??
      `charter-${orchestrator.id}-${Date.now()}`;

    const nextVersion = (existingLatest?.version ?? 0) + 1;
    const changeLog =
      input.changeLog ?? `Version ${nextVersion}: Charter updated`;

    // Create new version in a Prisma transaction
    const newVersion = await prisma.$transaction(async tx => {
      // Deactivate any existing active versions for this orchestrator
      if (existingLatest) {
        await tx.charterVersion.updateMany({
          where: {
            orchestratorId: orchestrator.id,
            charterId,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      // Create the new active version
      return tx.charterVersion.create({
        data: {
          charterId,
          orchestratorId: orchestrator.id,
          version: nextVersion,
          charterData: input.charterData as unknown as Prisma.InputJsonValue,
          changeLog,
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
      data: {
        ...newVersion,
        orchestrator: {
          id: orchestrator.id,
          discipline: orchestrator.discipline,
          role: orchestrator.role,
          user: orchestrator.user,
        },
      },
      message: `Orchestrator charter updated. Version ${nextVersion} is now active.`,
      isNewCharter: existingLatest === null,
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/orchestrators/:orchestratorId/charter] Error:',
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
