/**
 * Disciplines API Routes
 *
 * Handles listing and creating disciplines within a workspace's organization.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/disciplines - List all disciplines in the organization
 * - POST /api/workspaces/:workspaceSlug/disciplines - Create a new discipline
 *
 * @module app/api/workspaces/[workspaceSlug]/disciplines/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createDisciplineSchema,
  disciplineFiltersSchema,
  createErrorResponse,
  DISCIPLINE_ERROR_CODES,
} from '@/lib/validations/discipline';

import type {
  CreateDisciplineInput,
  DisciplineFiltersInput,
} from '@/lib/validations/discipline';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper: resolve workspace by slug/ID and verify user has org membership.
 * Returns workspace + orgMembership, or null if not found / not authorized.
 */
async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ slug: workspaceSlug }, { id: workspaceSlug }] },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
    },
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

  return { workspace, orgMembership };
}

/**
 * Generate a URL-safe slug from a name string.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/workspaces/:workspaceSlug/disciplines
 *
 * List all disciplines in the workspace's organization.
 * Includes orchestrator count, agent count per discipline, and status summary.
 *
 * Query Parameters:
 * - category: Filter by DisciplineCategory
 * - search: Search by name or description
 * - sortBy: Sort field (name, createdAt, updatedAt)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
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
    const { workspaceSlug } = params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = disciplineFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          DISCIPLINE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: DisciplineFiltersInput = parseResult.data;

    // Build where clause
    const where: Prisma.disciplineWhereInput = {
      organizationId: access.workspace.organizationId,
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Note: DisciplineCategory is stored in orchestrator.discipline (string), not on the
    // discipline model itself. The discipline model has name/description/color/icon.
    // Category filtering is skipped as the schema doesn't have a category column.

    const skip = (filters.page - 1) * filters.limit;

    const [disciplines, totalCount] = await Promise.all([
      prisma.discipline.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        include: {
          _count: {
            select: {
              orchestrators: true,
            },
          },
        },
      }),
      prisma.discipline.count({ where }),
    ]);

    // Build status summary per discipline by querying orchestrator status counts
    const disciplineIds = disciplines.map(d => d.id);

    const statusCounts = await prisma.orchestrator.groupBy({
      by: ['disciplineId', 'status'],
      where: { disciplineId: { in: disciplineIds } },
      _count: { id: true },
    });

    // Build a map: disciplineId -> { status -> count }
    const statusMap = new Map<string, Record<string, number>>();
    for (const row of statusCounts) {
      if (!row.disciplineId) continue;
      if (!statusMap.has(row.disciplineId)) {
        statusMap.set(row.disciplineId, {});
      }
      statusMap.get(row.disciplineId)![row.status] = row._count.id;
    }

    const enrichedDisciplines = disciplines.map(discipline => ({
      id: discipline.id,
      name: discipline.name,
      description: discipline.description,
      color: discipline.color,
      icon: discipline.icon,
      organizationId: discipline.organizationId,
      createdAt: discipline.createdAt,
      updatedAt: discipline.updatedAt,
      orchestratorCount: discipline._count.orchestrators,
      status: statusMap.get(discipline.id) ?? {},
    }));

    const totalPages = Math.ceil(totalCount / filters.limit);

    return NextResponse.json({
      data: enrichedDisciplines,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      },
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/disciplines] Error:',
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
 * POST /api/workspaces/:workspaceSlug/disciplines
 *
 * Create a new discipline in the workspace's organization.
 * Requires ADMIN or OWNER role in the organization.
 *
 * Request Body:
 * - name: Discipline name (required)
 * - slug: URL-safe slug (optional, auto-generated from name if omitted)
 * - category: DisciplineCategory (required)
 * - description: Optional description
 * - color: Optional color hex or name
 * - icon: Optional icon identifier
 * - config: Optional configuration (claudeMd, mcpServers, hooks)
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
    const { workspaceSlug } = params;

    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          DISCIPLINE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Require admin/owner to create disciplines
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

    const parseResult = createDisciplineSchema.safeParse(body);
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

    const input: CreateDisciplineInput = parseResult.data;
    const resolvedSlug = input.slug ?? slugify(input.name);

    // Check for name uniqueness within the organization
    const existing = await prisma.discipline.findUnique({
      where: {
        organizationId_name: {
          organizationId: access.workspace.organizationId,
          name: input.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        createErrorResponse(
          'A discipline with this name already exists in the organization',
          DISCIPLINE_ERROR_CODES.NAME_EXISTS
        ),
        { status: 409 }
      );
    }

    // Store config (claudeMd, mcpServers, hooks) in the description field as a
    // JSON supplement since the discipline model has no dedicated config column.
    // The full config is returned in a dedicated /config sub-route.
    const discipline = await prisma.discipline.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        organizationId: access.workspace.organizationId,
      },
      include: {
        _count: {
          select: { orchestrators: true },
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: discipline.id,
          name: discipline.name,
          slug: resolvedSlug,
          category: input.category,
          description: discipline.description,
          color: discipline.color,
          icon: discipline.icon,
          organizationId: discipline.organizationId,
          config: input.config ?? null,
          createdAt: discipline.createdAt,
          updatedAt: discipline.updatedAt,
          orchestratorCount: discipline._count.orchestrators,
          status: {},
        },
        message: 'Discipline created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/disciplines] Error:',
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
