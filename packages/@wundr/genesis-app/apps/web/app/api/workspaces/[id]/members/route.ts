/**
 * Workspace Members API Routes
 *
 * Handles listing and adding members to a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:id/members - List workspace members
 * - POST /api/workspaces/:id/members - Add member to workspace
 *
 * @module app/api/workspaces/[id]/members/route
 */

import { prisma } from '@genesis/database';
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
  params: Promise<{ id: string }>;
}

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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
 * GET /api/workspaces/:id/members
 *
 * List all members of a workspace. Requires workspace membership or org admin.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of workspace members
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
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate workspace ID parameter
    const params = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch all members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      data: members,
      count: members.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:id/members] Error:', error);
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
 * POST /api/workspaces/:id/members
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
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate workspace ID parameter
    const params = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isWorkspaceAdmin = access.workspaceMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isWorkspaceAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Workspace Admin required.',
          ORG_ERROR_CODES.FORBIDDEN,
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
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = addWorkspaceMemberSchema.safeParse(body);
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
          ORG_ERROR_CODES.USER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if user is already a workspace member
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.id,
          userId: input.userId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        createErrorResponse(
          'User is already a member of this workspace',
          ORG_ERROR_CODES.ALREADY_MEMBER,
        ),
        { status: 409 },
      );
    }

    // Add member
    const newMembership = await prisma.workspaceMember.create({
      data: {
        workspaceId: params.id,
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
            isVP: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: newMembership, message: 'Member added to workspace successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:id/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
