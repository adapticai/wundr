/**
 * Workspace Members API Routes
 *
 * Handles listing and adding members to a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/members - List workspace members
 * - POST /api/workspaces/:workspaceId/members - Add member to workspace
 *
 * @module app/api/workspaces/[workspaceId]/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  addWorkspaceMemberSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { AddWorkspaceMemberInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access by slug
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  // Support both workspace ID and slug for lookup
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
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

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
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
 * GET /api/workspaces/:workspaceId/members
 *
 * List all members of a workspace. Requires workspace membership or org admin.
 * Supports pagination via limit/offset query parameters.
 *
 * Query Parameters:
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Number of items to skip (default: 0)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns List of workspace members with pagination metadata
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10)),
      100
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    // Get total count for pagination metadata
    const totalCount = await prisma.workspaceMember.count({
      where: { workspaceId: actualWorkspaceId },
    });

    // Fetch paginated members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: actualWorkspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      skip: offset,
      take: limit,
    });

    // Map members to the shape expected by the useMembers hook
    const mappedMembers = members.map(m => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.avatarUrl,
      role: { id: m.role, name: m.role },
      roleId: m.role,
      status: 'active' as const,
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json({
      members: mappedMembers,
      total: totalCount,
      hasMore: offset + limit < totalCount,
      data: members,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/members
 *
 * Add a member to the workspace. Requires workspace ADMIN or org ADMIN/OWNER.
 * User must be a member of the organization.
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing workspace ID
 * @returns Created membership object
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access and permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isWorkspaceAdmin = access.workspaceMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isWorkspaceAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Workspace Admin required.',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = addWorkspaceMemberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: AddWorkspaceMemberInput = parseResult.data;

    // Check if user exists and is a member of the organization
    const targetOrgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: access.workspace.organizationId,
          userId: input.userId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!targetOrgMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User must be a member of the organization to join the workspace',
          ORG_ERROR_CODES.USER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if user is already a workspace member
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: actualWorkspaceId,
          userId: input.userId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User is already a member of this workspace',
          ORG_ERROR_CODES.ALREADY_MEMBER
        ),
        { status: 409 }
      );
    }

    // Add member
    const newMembership = await prisma.workspaceMember.create({
      data: {
        workspaceId: actualWorkspaceId,
        userId: input.userId,
        role: input.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: newMembership,
        message: 'Member added to workspace successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
