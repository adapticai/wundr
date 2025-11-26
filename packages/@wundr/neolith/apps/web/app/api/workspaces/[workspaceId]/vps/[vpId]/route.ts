/**
 * VP Detail API Routes within Workspace Context
 *
 * Handles operations on individual Virtual Person (VP) entities within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId - Get VP details with activity and stats
 * - PATCH /api/workspaces/:workspaceId/vps/:vpId - Update VP
 * - DELETE /api/workspaces/:workspaceId/vps/:vpId - Soft delete VP
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateVPSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { UpdateVPInput } from '@/lib/validations/vp';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to check if user has access to a VP within a workspace
 * Returns the VP with access data if accessible, null otherwise
 */
async function getVPWithWorkspaceAccess(
  workspaceId: string,
  vpId: string,
  userId: string,
) {
  // First, verify workspace exists and user has access
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  // Check user's organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  // Fetch VP and verify it belongs to the workspace
  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
      OR: [
        { workspaceId }, // VP is directly in this workspace
        { workspaceId: null }, // VP is org-wide (accessible to all workspaces)
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          status: true,
          createdAt: true,
          lastActiveAt: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      disciplineRelation: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          icon: true,
        },
      },
    },
  });

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId
 *
 * Get details for a specific VP including:
 * - All VP fields and user profile
 * - Current active task (if any)
 * - Recent activity (last 10 messages)
 * - Statistics (tasks completed, avg completion time)
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
 * @returns VP details with activity and statistics
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get VP with access check
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          VP_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch current active task
    const currentTask = await prisma.task.findFirst({
      where: {
        vpId,
        status: { in: ['IN_PROGRESS', 'TODO'] },
      },
      orderBy: [
        { status: 'asc' }, // IN_PROGRESS first
        { priority: 'desc' }, // Then by priority
        { createdAt: 'asc' }, // Then oldest first
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Fetch recent activity (messages sent by VP)
    const recentActivity = await prisma.message.findMany({
      where: {
        authorId: result.vp.userId,
        channel: {
          workspaceId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Fetch task statistics
    const [completedTasks, totalTasks, completedTasksWithTime] = await Promise.all([
      // Count completed tasks
      prisma.task.count({
        where: {
          vpId,
          status: 'DONE',
        },
      }),
      // Count all tasks
      prisma.task.count({
        where: { vpId },
      }),
      // Get completed tasks with time data for average calculation
      prisma.task.findMany({
        where: {
          vpId,
          status: 'DONE',
          completedAt: { not: null },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    // Calculate average completion time in hours
    let avgCompletionTime = null;
    if (completedTasksWithTime.length > 0) {
      const totalCompletionTime = completedTasksWithTime.reduce((sum, task) => {
        if (task.completedAt) {
          const diffMs = task.completedAt.getTime() - task.createdAt.getTime();
          return sum + diffMs;
        }
        return sum;
      }, 0);
      const avgMs = totalCompletionTime / completedTasksWithTime.length;
      avgCompletionTime = Math.round((avgMs / (1000 * 60 * 60)) * 100) / 100; // Convert to hours with 2 decimals
    }

    // Build response
    const vpDetails = {
      ...result.vp,
      currentTask,
      recentActivity,
      statistics: {
        totalTasks,
        completedTasks,
        inProgressTasks: totalTasks - completedTasks,
        completionRate:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        avgCompletionTimeHours: avgCompletionTime,
      },
    };

    return NextResponse.json({ data: vpDetails });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/vps/:vpId] Error:', error);
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
 * PATCH /api/workspaces/:workspaceId/vps/:vpId
 *
 * Update an existing VP.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * Updatable fields:
 * - VP: discipline, role, capabilities, status, daemonEndpoint
 * - User: name, displayName, avatarUrl, bio
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and VP IDs
 * @returns Updated VP object
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
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

    // Validate input
    const parseResult = updateVPSchema.safeParse(body);
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

    const input: UpdateVPInput = parseResult.data;

    // Get VP with access check
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          VP_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update VP and user in a transaction
    const updatedVP = await prisma.$transaction(async (tx) => {
      // Update user profile if provided
      if (input.user) {
        await tx.user.update({
          where: { id: result.vp.user.id },
          data: {
            ...(input.user.name !== undefined && { name: input.user.name }),
            ...(input.user.displayName !== undefined && {
              displayName: input.user.displayName,
            }),
            ...(input.user.avatarUrl !== undefined && {
              avatarUrl: input.user.avatarUrl,
            }),
            ...(input.user.bio !== undefined && { bio: input.user.bio }),
          },
        });
      }

      // Update VP
      return tx.vP.update({
        where: { id: vpId },
        data: {
          ...(input.discipline !== undefined && { discipline: input.discipline }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.capabilities !== undefined && {
            capabilities: input.capabilities as unknown as Prisma.InputJsonValue,
          }),
          ...(input.daemonEndpoint !== undefined && {
            daemonEndpoint: input.daemonEndpoint,
          }),
          ...(input.status !== undefined && { status: input.status }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              status: true,
              lastActiveAt: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          disciplineRelation: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              icon: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      data: updatedVP,
      message: 'VP updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/vps/:vpId] Error:', error);
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
 * DELETE /api/workspaces/:workspaceId/vps/:vpId
 *
 * Soft delete a VP by setting status to OFFLINE.
 * For hard deletion, use the organization-level API.
 *
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get VP with access check
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          VP_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to delete this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Soft delete: Set status to OFFLINE and update user status
    await prisma.$transaction(async (tx) => {
      // Update VP status to OFFLINE
      await tx.vP.update({
        where: { id: vpId },
        data: { status: 'OFFLINE' },
      });

      // Update associated user status to INACTIVE
      await tx.user.update({
        where: { id: result.vp.user.id },
        data: { status: 'INACTIVE' },
      });
    });

    return NextResponse.json({
      message: 'VP soft deleted successfully (status set to OFFLINE)',
      deletedId: vpId,
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/vps/:vpId] Error:', error);

    // Handle foreign key constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot delete VP: it has dependent records',
          VP_ERROR_CODES.INTERNAL_ERROR,
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
