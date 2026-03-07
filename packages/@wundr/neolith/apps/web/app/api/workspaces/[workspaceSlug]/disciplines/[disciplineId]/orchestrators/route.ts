/**
 * Discipline Orchestrators API Routes
 *
 * Manages the orchestrators assigned to a specific discipline.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators
 *     List orchestrators assigned to this discipline
 * - POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators
 *     Assign an existing orchestrator to this discipline
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/[disciplineId]/orchestrators/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  assignOrchestratorSchema,
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';

import type { AssignOrchestratorInput } from '@/lib/validations/discipline';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug and disciplineId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; disciplineId: string }>;
}

/**
 * Helper: resolve workspace, verify org membership, and verify the discipline
 * belongs to the workspace's organization.
 */
async function resolveDisciplineAccess(
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
    select: { id: true, name: true, organizationId: true },
  });

  if (!discipline) return null;

  return { workspace, orgMembership, discipline };
}

/**
 * GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators
 *
 * List all orchestrators assigned to this discipline.
 * Returns orchestrator details including user profile and task statistics.
 */
export async function GET(
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

    const access = await resolveDisciplineAccess(
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

    // Parse optional pagination params
    const page = Math.max(
      1,
      parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
    );
    const limit = Math.min(
      100,
      Math.max(
        1,
        parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10)
      )
    );
    const statusFilter = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');

    const where: Prisma.orchestratorWhereInput = {
      disciplineId,
      ...(statusFilter && {
        status: statusFilter as 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY',
      }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { role: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [orchestrators, totalCount] = await Promise.all([
      prisma.orchestrator.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
              createdAt: true,
            },
          },
          _count: {
            select: { tasks: true },
          },
        },
      }),
      prisma.orchestrator.count({ where }),
    ]);

    // Fetch active task counts in parallel
    const orchestratorIds = orchestrators.map(o => o.id);
    const [completedCounts, activeCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: { orchestratorId: { in: orchestratorIds }, status: 'DONE' },
        _count: { id: true },
      }),
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        _count: { id: true },
      }),
    ]);

    const completedMap = new Map(
      completedCounts.map(r => [r.orchestratorId, r._count.id])
    );
    const activeMap = new Map(
      activeCounts.map(r => [r.orchestratorId, r._count.id])
    );

    const enriched = orchestrators.map(o => ({
      id: o.id,
      discipline: o.discipline,
      role: o.role,
      status: o.status,
      capabilities: o.capabilities,
      daemonEndpoint: o.daemonEndpoint,
      workspaceId: o.workspaceId,
      organizationId: o.organizationId,
      disciplineId: o.disciplineId,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      user: o.user,
      statistics: {
        totalTasks: o._count.tasks,
        tasksCompleted: completedMap.get(o.id) ?? 0,
        activeTasks: activeMap.get(o.id) ?? 0,
      },
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: enriched,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      discipline: {
        id: access.discipline.id,
        name: access.discipline.name,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators] Error:',
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
 * POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators
 *
 * Assign an existing orchestrator to this discipline.
 * The orchestrator must belong to the same organization.
 * Requires ADMIN or OWNER role.
 *
 * Request Body:
 * - orchestratorId: ID of the orchestrator to assign
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
          'Authentication required',
          DISCIPLINE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug, disciplineId } = params;

    const access = await resolveDisciplineAccess(
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

    const parseResult = assignOrchestratorSchema.safeParse(body);
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

    const input: AssignOrchestratorInput = parseResult.data;

    // Verify the orchestrator exists and belongs to the same organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: input.orchestratorId,
        organizationId: access.workspace.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found in this organization',
          DISCIPLINE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if already assigned to this discipline
    if (orchestrator.disciplineId === disciplineId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator is already assigned to this discipline',
          DISCIPLINE_ERROR_CODES.ORCHESTRATOR_ALREADY_ASSIGNED
        ),
        { status: 409 }
      );
    }

    // Assign the orchestrator to this discipline
    const updated = await prisma.orchestrator.update({
      where: { id: input.orchestratorId },
      data: { disciplineId },
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
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: updated.id,
          discipline: updated.discipline,
          role: updated.role,
          status: updated.status,
          capabilities: updated.capabilities,
          daemonEndpoint: updated.daemonEndpoint,
          workspaceId: updated.workspaceId,
          organizationId: updated.organizationId,
          disciplineId: updated.disciplineId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          user: updated.user,
          statistics: {
            totalTasks: updated._count.tasks,
            tasksCompleted: 0,
            activeTasks: 0,
          },
        },
        message: 'Orchestrator assigned to discipline successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/disciplines/:disciplineId/orchestrators] Error:',
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
