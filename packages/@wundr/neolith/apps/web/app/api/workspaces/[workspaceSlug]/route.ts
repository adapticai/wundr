/**
 * Workspace Detail API Routes
 *
 * Handles single workspace operations.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId - Get workspace details
 * - PATCH /api/workspaces/:workspaceId - Update workspace
 * - DELETE /api/workspaces/:workspaceId - Delete workspace
 *
 * @module app/api/workspaces/[workspaceId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  updateWorkspaceSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateWorkspaceInput } from '@/lib/validations/organization';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access via organization membership
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: true,
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
 * GET /api/workspaces/:workspaceId
 *
 * Get workspace details. Requires organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns Workspace details
 */
export async function GET(
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

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch workspace with details
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
        _count: {
          select: {
            workspaceMembers: true,
            channels: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: workspace,
      membership: access.workspaceMembership
        ? {
            role: access.workspaceMembership.role,
            joinedAt: access.workspaceMembership.joinedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId] Error:', error);
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
 * PATCH /api/workspaces/:workspaceId
 *
 * Update workspace. Requires workspace ADMIN role or org ADMIN/OWNER.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace ID
 * @returns Updated workspace
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

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check permission: org admin/owner or workspace admin
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
    const parseResult = updateWorkspaceSchema.safeParse(body);
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

    const input: UpdateWorkspaceInput = parseResult.data;

    // Update workspace
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.iconUrl !== undefined && { iconUrl: input.iconUrl }),
        ...(input.settings && { settings: input.settings as Prisma.InputJsonValue }),
      },
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
            workspaceMembers: true,
            channels: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: workspace,
      message: 'Workspace updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId] Error:', error);
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
 * DELETE /api/workspaces/:workspaceId
 *
 * Delete workspace. Requires org ADMIN/OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
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

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Only org admin/owner can delete workspaces
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Only organization administrators can delete workspaces',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete workspace (cascades to channels, members, etc.)
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return NextResponse.json({
      message: 'Workspace deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
