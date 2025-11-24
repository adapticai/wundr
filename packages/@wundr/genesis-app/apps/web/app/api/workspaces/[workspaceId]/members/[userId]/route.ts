/**
 * Workspace Member Detail API Routes
 *
 * Handles single member operations within a workspace.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceId/members/:userId - Update member role
 * - DELETE /api/workspaces/:workspaceId/members/:userId - Remove member
 *
 * @module app/api/workspaces/[workspaceId]/members/[userId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  userIdParamSchema,
  updateWorkspaceMemberRoleSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateWorkspaceMemberRoleInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; userId: string }>;
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
 * PATCH /api/workspaces/:workspaceId/members/:userId
 *
 * Update a member's role. Requires workspace ADMIN or org ADMIN/OWNER.
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing workspace and user IDs
 * @returns Updated membership object
 */
export async function PATCH(
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

    // Validate parameters
    const params = await context.params;
    const wsParamResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!wsParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's access and permission
    const access = await checkWorkspaceAccess(params.workspaceId, session.user.id);
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

    // Get target member
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.workspaceId,
          userId: params.userId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this workspace',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
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
    const parseResult = updateWorkspaceMemberRoleSchema.safeParse(body);
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

    const input: UpdateWorkspaceMemberRoleInput = parseResult.data;

    // Update member role
    const updatedMembership = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: params.workspaceId,
          userId: params.userId,
        },
      },
      data: { role: input.role },
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

    return NextResponse.json({
      data: updatedMembership,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/members/:userId] Error:', error);
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
 * DELETE /api/workspaces/:workspaceId/members/:userId
 *
 * Remove a member from the workspace. Requires workspace ADMIN or org ADMIN/OWNER.
 * Users can remove themselves.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and user IDs
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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

    // Validate parameters
    const params = await context.params;
    const wsParamResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!wsParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's access
    const access = await checkWorkspaceAccess(params.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Users can remove themselves, or admins can remove others
    const isSelf = session.user.id === params.userId;
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isWorkspaceAdmin = access.workspaceMembership?.role === 'ADMIN';

    if (!isSelf && !isOrgAdmin && !isWorkspaceAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get target member
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: params.workspaceId,
          userId: params.userId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this workspace',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if this is the last admin
    if (targetMembership.role === 'ADMIN') {
      const adminCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: params.workspaceId,
          role: 'ADMIN',
        },
      });

      if (adminCount === 1) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot remove the last workspace admin. Promote another member first.',
            ORG_ERROR_CODES.CANNOT_LEAVE_LAST_ADMIN,
          ),
          { status: 400 },
        );
      }
    }

    // Remove member (also removes from channel memberships in workspace)
    await prisma.$transaction(async (tx) => {
      // Get all channels in this workspace
      const workspaceChannels = await tx.channel.findMany({
        where: { workspaceId: params.workspaceId },
        select: { id: true },
      });

      const channelIds = workspaceChannels.map((c) => c.id);

      // Remove from all channels in workspace
      await tx.channelMember.deleteMany({
        where: {
          channelId: { in: channelIds },
          userId: params.userId,
        },
      });

      // Remove from workspace
      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId: params.workspaceId,
            userId: params.userId,
          },
        },
      });
    });

    return NextResponse.json({
      message: 'Member removed from workspace successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/members/:userId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
