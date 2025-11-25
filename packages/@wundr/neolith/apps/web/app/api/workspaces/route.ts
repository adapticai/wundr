/**
 * Workspace API Routes
 *
 * Handles listing and creating workspaces.
 *
 * Routes:
 * - GET /api/workspaces - List workspaces by organization
 * - POST /api/workspaces - Create a new workspace
 *
 * @module app/api/workspaces/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createWorkspaceSchema,
  workspaceFiltersSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { CreateWorkspaceInput, WorkspaceFiltersInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * GET /api/workspaces
 *
 * List workspaces the authenticated user has access to.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of workspaces
 *
 * @example
 * ```
 * GET /api/workspaces?organizationId=org_123&page=1&limit=20
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = workspaceFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: WorkspaceFiltersInput = parseResult.data;

    // Get organizations the user is a member of
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

    // Check authorization for specific organization filter
    if (filters.organizationId && !accessibleOrgIds.includes(filters.organizationId)) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this organization',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Build where clause
    const where: Prisma.WorkspaceWhereInput = {
      organizationId: filters.organizationId
        ? filters.organizationId
        : { in: accessibleOrgIds },
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy
    const orderBy: Prisma.WorkspaceOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch workspaces and total count in parallel
    const [workspaces, totalCount] = await Promise.all([
      prisma.workspace.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              members: true,
              channels: true,
            },
          },
        },
      }),
      prisma.workspace.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    return NextResponse.json({
      data: workspaces,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces
 *
 * Create a new workspace. Requires ADMIN or OWNER role in the organization.
 *
 * @param request - Next.js request with workspace data
 * @returns Created workspace object
 *
 * @example
 * ```
 * POST /api/workspaces
 * Content-Type: application/json
 *
 * {
 *   "name": "Engineering",
 *   "slug": "engineering",
 *   "organizationId": "org_123",
 *   "description": "Engineering team workspace"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createWorkspaceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateWorkspaceInput = parseResult.data;

    // Check organization membership and permission
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Organization not found or access denied',
          ORG_ERROR_CODES.ORG_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if slug already exists in the organization
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        organizationId: input.organizationId,
        slug: input.slug,
      },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        createErrorResponse(
          'A workspace with this slug already exists in the organization',
          ORG_ERROR_CODES.WORKSPACE_SLUG_EXISTS,
        ),
        { status: 409 },
      );
    }

    // Create workspace with creator as admin
    const workspace = await prisma.$transaction(async (tx) => {
      // Create the workspace
      const newWorkspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          avatarUrl: input.iconUrl,
          settings: input.settings as Prisma.InputJsonValue,
          organizationId: input.organizationId,
        },
      });

      // Add creator as workspace admin
      await tx.workspaceMember.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: session.user.id,
          role: 'ADMIN',
        },
      });

      // Create default #general channel
      const generalChannel = await tx.channel.create({
        data: {
          name: 'general',
          slug: 'general',
          type: 'PUBLIC',
          description: 'General discussion for the workspace',
          workspaceId: newWorkspace.id,
        },
      });

      // Add creator to #general channel
      await tx.channelMember.create({
        data: {
          channelId: generalChannel.id,
          userId: session.user.id,
          role: 'ADMIN',
        },
      });

      // Return workspace with counts
      return tx.workspace.findUnique({
        where: { id: newWorkspace.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              members: true,
              channels: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      { data: workspace, message: 'Workspace created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces] Error:', error);

    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'A workspace with this slug already exists',
          ORG_ERROR_CODES.WORKSPACE_SLUG_EXISTS,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
