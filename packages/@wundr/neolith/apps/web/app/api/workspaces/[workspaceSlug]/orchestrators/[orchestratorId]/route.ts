/**
 * OrchestratorDetail API Routes within Workspace Context
 *
 * Handles operations on individual Orchestrator entities within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId - Get Orchestrator details with activity and stats
 * - PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId - Update Orchestrator
 * - DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId - Soft delete Orchestrator
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateOrchestratorSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { UpdateOrchestratorInput } from '@/lib/validations/orchestrator';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 * Returns the Orchestrator with access data if accessible, null otherwise
 */
async function getOrchestratorWithWorkspaceAccess(
  workspaceId: string,
  orchestratorId: string,
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

  // Fetch Orchestrator and verify it belongs to the workspace
  const orchestrator = await prisma.orchestrator.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
      OR: [
        { workspaceId }, // Orchestrator is directly in this workspace
        { workspaceId: null }, // Orchestrator is org-wide (accessible to all workspaces)
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
          isOrchestrator: true,
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
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId
 *
 * Get details for a specific Orchestrator including:
 * - All Orchestrator fields and user profile
 * - Current active task (if any)
 * - Recent activity (last 10 messages)
 * - Statistics (tasks completed, avg completion time)
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator details with activity and statistics
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with access check
    const result = await getOrchestratorWithWorkspaceAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Fetch current active task
    const currentTask = await prisma.task.findFirst({
      where: {
        orchestratorId: orchestratorId,
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

    // Fetch recent activity (messages sent by Orchestrator)
    const recentActivity = await prisma.message.findMany({
      where: {
        authorId: result.orchestrator.userId,
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
          orchestratorId: orchestratorId,
          status: 'DONE',
        },
      }),
      // Count all tasks
      prisma.task.count({
        where: { orchestratorId: orchestratorId },
      }),
      // Get completed tasks with time data for average calculation
      prisma.task.findMany({
        where: {
          orchestratorId: orchestratorId,
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
    const orchestratorDetails = {
      ...result.orchestrator,
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

    return NextResponse.json({ data: orchestratorDetails });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId] Error:', error);
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
 * PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId
 *
 * Update an existing Orchestrator.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * Updatable fields:
 * - Orchestrator: discipline, role, capabilities, status, daemonEndpoint
 * - User: name, displayName, avatarUrl, bio
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Updated Orchestrator object
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
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

    // Validate input
    const parseResult = updateOrchestratorSchema.safeParse(body);
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

    const input: UpdateOrchestratorInput = parseResult.data;

    // Get Orchestrator with access check
    const result = await getOrchestratorWithWorkspaceAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update Orchestrator and user in a transaction
    const updatedOrchestrator = await prisma.$transaction(async (tx) => {
      // Update user profile if provided
      if (input.user) {
        await tx.user.update({
          where: { id: result.orchestrator.user.id },
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

      // Update Orchestrator
      return tx.orchestrator.update({
        where: { id: orchestratorId },
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
          disciplineRef: {
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
      data: updatedOrchestrator,
      message: 'Orchestrator updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId] Error:', error);
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
 * DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId
 *
 * Soft delete a Orchestrator by setting status to OFFLINE.
 * For hard deletion, use the organization-level API.
 *
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with access check
    const result = await getOrchestratorWithWorkspaceAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to delete this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Soft delete: Set status to OFFLINE and update user status
    await prisma.$transaction(async (tx) => {
      // Update Orchestrator status to OFFLINE
      await tx.orchestrator.update({
        where: { id: orchestratorId },
        data: { status: 'OFFLINE' },
      });

      // Update associated user status to INACTIVE
      await tx.user.update({
        where: { id: result.orchestrator.user.id },
        data: { status: 'INACTIVE' },
      });
    });

    return NextResponse.json({
      message: 'Orchestrator soft deleted successfully (status set to OFFLINE)',
      deletedId: orchestratorId,
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId] Error:', error);

    // Handle foreign key constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot delete Orchestrator: it has dependent records',
          ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
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
