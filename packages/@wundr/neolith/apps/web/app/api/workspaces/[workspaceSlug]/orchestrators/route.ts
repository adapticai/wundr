/**
 * Workspace-Scoped OrchestratorAPI Routes
 *
 * Handles listing and creating Orchestrator entities within a workspace context.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators - List Orchestrators for a workspace
 * - POST /api/workspaces/:workspaceId/orchestrators - Create a new Orchestrator in a workspace
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createOrchestratorSchema,
  orchestratorFiltersSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { CreateOrchestratorInput, OrchestratorFiltersInput } from '@/lib/validations/orchestrator';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper function to check workspace access and return membership info
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  // Check organization membership
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

  // Check workspace membership
  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators
 *
 * List Orchestrators for a specific workspace with optional filtering, pagination, and sorting.
 * Includes Orchestrator statistics (tasks completed, active tasks).
 * Requires authentication and workspace access.
 *
 * Query Parameters:
 * - status: Filter by Orchestrator status (ONLINE, OFFLINE, BUSY, AWAY)
 * - discipline: Filter by discipline
 * - search: Search by name, email, role, or discipline
 * - sortBy: Sort field (name, createdAt, lastActiveAt, status)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Pagination page (default 1)
 * - limit: Items per page (default 20, max 100)
 * - cursor: Cursor-based pagination ID (optional, takes precedence over page)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Paginated list of Orchestrators with statistics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators?status=ONLINE&sortBy=lastActiveAt&limit=10
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = orchestratorFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: OrchestratorFiltersInput = parseResult.data;

    // Extract cursor parameter for cursor-based pagination
    const cursor = request.nextUrl.searchParams.get('cursor');

    // Build where clause - filter Orchestrators by workspace's organization
    const where: Prisma.orchestratorWhereInput = {
      organizationId: access.workspace.organizationId,
      ...(filters.discipline && { discipline: filters.discipline }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { user: { name: { contains: filters.search, mode: 'insensitive' } } },
          { user: { email: { contains: filters.search, mode: 'insensitive' } } },
          { role: { contains: filters.search, mode: 'insensitive' } },
          { discipline: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Build orderBy based on sortBy field
    // Map sortBy to the correct field
    // The schema only allows: 'createdAt', 'updatedAt', 'discipline', 'role', 'status'
    const orderBy: Prisma.orchestratorOrderByWithRelationInput = { [filters.sortBy]: filters.sortOrder };

    // Determine pagination approach
    let skip: number | undefined;
    let take: number;
    let cursorConfig: { cursor: { id: string }; skip: 1 } | undefined;

    if (cursor) {
      // Cursor-based pagination
      cursorConfig = { cursor: { id: cursor }, skip: 1 };
      take = filters.limit;
    } else {
      // Offset-based pagination
      skip = (filters.page - 1) * filters.limit;
      take = filters.limit;
    }

    // Fetch Orchestrators and total count in parallel
    const [orchestrators, totalCount] = await Promise.all([
      prisma.orchestrator.findMany({
        where,
        ...(cursorConfig ? cursorConfig : { skip }),
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              lastActiveAt: true,
              createdAt: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          disciplineRef: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              icon: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      }),
      prisma.orchestrator.count({ where }),
    ]);

    // Enhance Orchestrators with task statistics
    const orchestratorIds = orchestrators.map((orchestrator) => orchestrator.id);

    // Fetch task statistics for all Orchestrators in parallel
    const [completedTaskCounts, activeTaskCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          status: 'DONE',
        },
        _count: {
          id: true,
        },
      }),
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Create lookup maps for O(1) access
    const completedTaskMap = new Map(
      completedTaskCounts.map((item) => [item.orchestratorId, item._count.id]),
    );
    const activeTaskMap = new Map(
      activeTaskCounts.map((item) => [item.orchestratorId, item._count.id]),
    );

    // Enhance Orchestrator data with statistics
    const enhancedOrchestrators = orchestrators.map((orchestrator) => ({
      ...orchestrator,
      statistics: {
        totalTasks: orchestrator._count.tasks,
        tasksCompleted: completedTaskMap.get(orchestrator.id) ?? 0,
        activeTasks: activeTaskMap.get(orchestrator.id) ?? 0,
      },
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = cursor ? orchestrators.length === filters.limit : filters.page < totalPages;
    const hasPreviousPage = cursor ? !!cursor : filters.page > 1;
    const nextCursor = hasNextPage && orchestrators.length > 0 ? orchestrators[orchestrators.length - 1].id : null;

    return NextResponse.json({
      data: enhancedOrchestrators,
      pagination: {
        page: cursor ? undefined : filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        ...(cursor && { cursor }),
        ...(nextCursor && { nextCursor }),
      },
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators
 *
 * Create a new Orchestrator within a workspace context.
 * Requires authentication and admin/owner role in the organization.
 * The Orchestrator will be created with the workspace's organization.
 *
 * Request Body:
 * - discipline: Orchestrator discipline/department (e.g., "Engineering")
 * - role: Orchestrator role (e.g., "Senior Backend Engineer")
 * - capabilities: Optional array of Orchestrator capabilities
 * - daemonEndpoint: Optional daemon endpoint URL
 * - status: Initial status (default: OFFLINE)
 * - user: User profile information (name, email, avatar, bio)
 *
 * @param request - Next.js request with Orchestrator creation data
 * @param context - Route context containing workspace ID
 * @returns Created Orchestrator object with statistics
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/orchestrators
 * Content-Type: application/json
 *
 * {
 *   "discipline": "Engineering",
 *   "role": "Senior Backend Engineer",
 *   "capabilities": [
 *     { "name": "code-review", "enabled": true }
 *   ],
 *   "status": "OFFLINE",
 *   "user": {
 *     "name": "Backend Bot",
 *     "email": "backend-bot@workspace.ai",
 *     "avatarUrl": "https://example.com/avatar.png",
 *     "bio": "Specialized in backend development"
 *   }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for admin/owner role in organization
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin/owner required.',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Ensure body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse('Request body must be an object', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createOrchestratorSchema.safeParse({
      ...body,
      organizationId: access.workspace.organizationId,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateOrchestratorInput = parseResult.data;

    // Check for duplicate email if user data provided
    if (input.user?.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: input.user.email },
      });

      if (existingUser) {
        return NextResponse.json(
          createErrorResponse(
            'A user with this email already exists',
            ORCHESTRATOR_ERROR_CODES.DUPLICATE_EMAIL,
          ),
          { status: 409 },
        );
      }
    }

    // Create Orchestrator with associated user in a transaction
    const orchestrator = await prisma.$transaction(async (tx) => {
      // Create user for the Orchestrator
      const user = await tx.user.create({
        data: {
          email: input.user?.email ?? `orchestrator-${Date.now()}@neolith.local`,
          name: input.user?.name ?? `${input.role} Orchestrator`,
          displayName: input.user?.displayName,
          avatarUrl: input.user?.avatarUrl,
          bio: input.user?.bio,
          isOrchestrator: true,
          status: 'ACTIVE',
        },
      });

      // Create the Orchestrator
      const newOrchestrator = await tx.orchestrator.create({
        data: {
          discipline: input.discipline,
          role: input.role,
          capabilities: input.capabilities as unknown as Prisma.InputJsonValue,
          daemonEndpoint: input.daemonEndpoint,
          status: input.status,
          userId: user.id,
          organizationId: access.workspace.organizationId,
          workspaceId: workspaceId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              lastActiveAt: true,
              createdAt: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          disciplineRef: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              icon: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      });

      return newOrchestrator;
    });

    // Add statistics to response
    const enhancedOrchestrator = {
      ...orchestrator,
      statistics: {
        totalTasks: 0,
        tasksCompleted: 0,
        activeTasks: 0,
      },
    };

    return NextResponse.json(
      {
        data: enhancedOrchestrator,
        message: 'Orchestrator created successfully',
        workspace: {
          id: access.workspace.id,
          name: access.workspace.name,
          organizationId: access.workspace.organizationId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'An Orchestrator with these details already exists',
          ORCHESTRATOR_ERROR_CODES.DUPLICATE_EMAIL,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
