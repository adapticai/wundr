/**
 * Workspace-Scoped VP API Routes
 *
 * Handles listing and creating Virtual Person (VP) entities within a workspace context.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps - List VPs for a workspace
 * - POST /api/workspaces/:workspaceId/vps - Create a new VP in a workspace
 *
 * @module app/api/workspaces/[workspaceId]/vps/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createVPSchema,
  vpFiltersSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { CreateVPInput, VPFiltersInput } from '@/lib/validations/vp';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
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
 * GET /api/workspaces/:workspaceId/vps
 *
 * List VPs for a specific workspace with optional filtering, pagination, and sorting.
 * Includes VP statistics (tasks completed, active tasks).
 * Requires authentication and workspace access.
 *
 * Query Parameters:
 * - status: Filter by VP status (ONLINE, OFFLINE, BUSY, AWAY)
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
 * @returns Paginated list of VPs with statistics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps?status=ONLINE&sortBy=lastActiveAt&limit=10
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = vpFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: VPFiltersInput = parseResult.data;

    // Extract cursor parameter for cursor-based pagination
    const cursor = request.nextUrl.searchParams.get('cursor');

    // Build where clause - filter VPs by workspace's organization
    const where: Prisma.vPWhereInput = {
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
    const orderBy: Prisma.vPOrderByWithRelationInput = { [filters.sortBy]: filters.sortOrder };

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

    // Fetch VPs and total count in parallel
    const [vps, totalCount] = await Promise.all([
      prisma.vP.findMany({
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
      prisma.vP.count({ where }),
    ]);

    // Enhance VPs with task statistics
    const vpIds = vps.map((vp) => vp.id);

    // Fetch task statistics for all VPs in parallel
    const [completedTaskCounts, activeTaskCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ['vpId'],
        where: {
          vpId: { in: vpIds },
          status: 'DONE',
        },
        _count: {
          id: true,
        },
      }),
      prisma.task.groupBy({
        by: ['vpId'],
        where: {
          vpId: { in: vpIds },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Create lookup maps for O(1) access
    const completedTaskMap = new Map(
      completedTaskCounts.map((item) => [item.vpId, item._count.id]),
    );
    const activeTaskMap = new Map(
      activeTaskCounts.map((item) => [item.vpId, item._count.id]),
    );

    // Enhance VP data with statistics
    const enhancedVPs = vps.map((vp) => ({
      ...vp,
      statistics: {
        totalTasks: vp._count.tasks,
        tasksCompleted: completedTaskMap.get(vp.id) ?? 0,
        activeTasks: activeTaskMap.get(vp.id) ?? 0,
      },
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = cursor ? vps.length === filters.limit : filters.page < totalPages;
    const hasPreviousPage = cursor ? !!cursor : filters.page > 1;
    const nextCursor = hasNextPage && vps.length > 0 ? vps[vps.length - 1].id : null;

    return NextResponse.json({
      data: enhancedVPs,
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
    console.error('[GET /api/workspaces/:workspaceId/vps] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps
 *
 * Create a new VP within a workspace context.
 * Requires authentication and admin/owner role in the organization.
 * The VP will be created with the workspace's organization.
 *
 * Request Body:
 * - discipline: VP discipline/department (e.g., "Engineering")
 * - role: VP role (e.g., "Senior Backend Engineer")
 * - capabilities: Optional array of VP capabilities
 * - daemonEndpoint: Optional daemon endpoint URL
 * - status: Initial status (default: OFFLINE)
 * - user: User profile information (name, email, avatar, bio)
 *
 * @param request - Next.js request with VP creation data
 * @param context - Route context containing workspace ID
 * @returns Created VP object with statistics
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID format
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for admin/owner role in organization
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Organization admin/owner required.',
          VP_ERROR_CODES.FORBIDDEN,
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
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Ensure body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse('Request body must be an object', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createVPSchema.safeParse({
      ...body,
      organizationId: access.workspace.organizationId,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateVPInput = parseResult.data;

    // Check for duplicate email if user data provided
    if (input.user?.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: input.user.email },
      });

      if (existingUser) {
        return NextResponse.json(
          createErrorResponse(
            'A user with this email already exists',
            VP_ERROR_CODES.DUPLICATE_EMAIL,
          ),
          { status: 409 },
        );
      }
    }

    // Create VP with associated user in a transaction
    const vp = await prisma.$transaction(async (tx) => {
      // Create user for the VP
      const user = await tx.user.create({
        data: {
          email: input.user?.email ?? `vp-${Date.now()}@neolith.local`,
          name: input.user?.name ?? `${input.role} VP`,
          displayName: input.user?.displayName,
          avatarUrl: input.user?.avatarUrl,
          bio: input.user?.bio,
          isVP: true,
          status: 'ACTIVE',
        },
      });

      // Create the VP
      const newVP = await tx.vP.create({
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

      return newVP;
    });

    // Add statistics to response
    const enhancedVP = {
      ...vp,
      statistics: {
        totalTasks: 0,
        tasksCompleted: 0,
        activeTasks: 0,
      },
    };

    return NextResponse.json(
      {
        data: enhancedVP,
        message: 'VP created successfully',
        workspace: {
          id: access.workspace.id,
          name: access.workspace.name,
          organizationId: access.workspace.organizationId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'A VP with these details already exists',
          VP_ERROR_CODES.DUPLICATE_EMAIL,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
