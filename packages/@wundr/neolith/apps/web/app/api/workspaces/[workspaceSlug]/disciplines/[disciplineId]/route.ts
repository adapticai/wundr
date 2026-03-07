/**
 * Discipline Detail API Routes
 *
 * Handles operations on individual disciplines within a workspace's organization.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *     Get discipline details with related orchestrators and agents
 * - PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *     Update discipline fields
 * - DELETE /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *     Remove discipline (blocked if active orchestrators are assigned)
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/[disciplineId]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateDisciplineSchema,
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';

import type { UpdateDisciplineInput } from '@/lib/validations/discipline';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug and disciplineId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; disciplineId: string }>;
}

/**
 * Helper: resolve workspace access and load the discipline, verifying it belongs
 * to the workspace's organization.
 */
async function getDisciplineWithAccess(
  workspaceSlug: string,
  disciplineId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ slug: workspaceSlug }, { id: workspaceSlug }] },
    select: { id: true, name: true, organizationId: true },
  });

  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) return null;

  const discipline = await prisma.discipline.findFirst({
    where: {
      id: disciplineId,
      organizationId: workspace.organizationId,
    },
  });

  if (!discipline) return null;

  return { workspace, orgMembership, discipline };
}

/**
 * GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *
 * Returns full discipline details including assigned orchestrators and their agents.
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
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await getDisciplineWithAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Fetch the discipline with related orchestrators (and their users) included
    const discipline = await prisma.discipline.findUnique({
      where: { id: disciplineId },
      include: {
        orchestrators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                status: true,
                lastActiveAt: true,
              },
            },
            _count: {
              select: { tasks: true },
            },
          },
        },
      },
    });

    if (!discipline) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Fetch agents for the workspace to associate with the discipline
    // (agents are workspace-scoped; discipline association is by name convention)
    const orchestratorStatuses = await prisma.orchestrator.groupBy({
      by: ['status'],
      where: { disciplineId },
      _count: { id: true },
    });

    const statusSummary = Object.fromEntries(
      orchestratorStatuses.map(r => [r.status, r._count.id])
    );

    return NextResponse.json({
      data: {
        id: discipline.id,
        name: discipline.name,
        description: discipline.description,
        color: discipline.color,
        icon: discipline.icon,
        organizationId: discipline.organizationId,
        createdAt: discipline.createdAt,
        updatedAt: discipline.updatedAt,
        orchestrators: discipline.orchestrators.map(o => ({
          id: o.id,
          discipline: o.discipline,
          role: o.role,
          status: o.status,
          capabilities: o.capabilities,
          daemonEndpoint: o.daemonEndpoint,
          workspaceId: o.workspaceId,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          user: o.user,
          taskCount: o._count.tasks,
        })),
        orchestratorCount: discipline.orchestrators.length,
        statusSummary,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *
 * Update an existing discipline. Requires ADMIN or OWNER role.
 *
 * Request Body (all fields optional):
 * - name, category, description, color, icon, config
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
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await getDisciplineWithAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin or owner role required.',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = updateDisciplineSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateDisciplineInput = parseResult.data;

    // If renaming, check uniqueness within the organization
    if (input.name && input.name !== access.discipline.name) {
      const nameConflict = await prisma.discipline.findUnique({
        where: {
          organizationId_name: {
            organizationId: access.workspace.organizationId,
            name: input.name,
          },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          createErrorResponse(
            'A discipline with this name already exists in the organization',
            DISCIPLINE_ERROR_CODES.NAME_EXISTS
          ),
          { status: 409 }
        );
      }
    }

    const updated = await prisma.discipline.update({
      where: { id: disciplineId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
      include: {
        _count: { select: { orchestrators: true } },
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        category: input.category ?? null,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        organizationId: updated.organizationId,
        config: input.config ?? null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        orchestratorCount: updated._count.orchestrators,
      },
      message: 'Discipline updated successfully',
    });
  } catch (error) {
    console.error(
      '[PUT /api/workspaces/:workspaceSlug/disciplines/:disciplineId] Error:',
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'A discipline with this name already exists in the organization',
          DISCIPLINE_ERROR_CODES.NAME_EXISTS
        ),
        { status: 409 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/disciplines/:disciplineId
 *
 * Remove a discipline from the organization.
 * Blocked if any orchestrators with ONLINE or BUSY status are assigned to it.
 * Requires ADMIN or OWNER role.
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
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await getDisciplineWithAccess(
      workspaceSlug,
      disciplineId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Discipline not found or access denied',
          DISCIPLINE_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin or owner role required.',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Block deletion if there are active orchestrators
    const activeOrchestratorCount = await prisma.orchestrator.count({
      where: {
        disciplineId,
        status: { in: ['ONLINE', 'BUSY'] },
      },
    });

    if (activeOrchestratorCount > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Cannot delete discipline: ${activeOrchestratorCount} active orchestrator(s) are still assigned. Reassign or deactivate them first.`,
          DISCIPLINE_ERROR_CODES.HAS_ACTIVE_ORCHESTRATORS,
          { activeOrchestratorCount }
        ),
        { status: 409 }
      );
    }

    // Unlink orchestrators before deletion (set disciplineId to null)
    await prisma.orchestrator.updateMany({
      where: { disciplineId },
      data: { disciplineId: null },
    });

    await prisma.discipline.delete({ where: { id: disciplineId } });

    return NextResponse.json({
      message: 'Discipline deleted successfully',
      id: disciplineId,
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceSlug/disciplines/:disciplineId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        DISCIPLINE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
