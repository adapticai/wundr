/**
 * OrchestratorStatus API Routes
 *
 * Handles getting and updating Orchestrator operational status.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status - Get current Orchestrator status
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status - Update Orchestrator status
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, ORCHESTRATOR_ERROR_CODES, orchestratorStatusEnum } from '@/lib/validations/orchestrator';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Schema for updating Orchestrator status
 */
const updateStatusSchema = z.object({
  /** New Orchestrator status */
  status: orchestratorStatusEnum,
  /** Optional reason or note for the status update */
  reason: z.string().max(500).optional(),
});

type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 */
async function checkOrchestratorAccess(workspaceId: string, orchestratorId: string, userId: string) {
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
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status
 *
 * Get current Orchestrator status including:
 * - Status (ONLINE, OFFLINE, BUSY, AWAY)
 * - Current task (if any)
 * - Last activity timestamp
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator status information
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/status
 *
 * Response:
 * {
 *   "data": {
 *     "status": "BUSY",
 *     "currentTask": {
 *       "id": "task_789",
 *       "title": "Implement authentication",
 *       "status": "IN_PROGRESS",
 *       "priority": "HIGH"
 *     },
 *     "lastActiveAt": "2024-11-26T12:30:00Z"
 *   }
 * }
 * ```
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

    // Check access
    const result = await checkOrchestratorAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Get Orchestrator with user's lastActiveAt
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            lastActiveAt: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Fetch current active task
    const currentTask = await prisma.task.findFirst({
      where: {
        orchestratorId: orchestratorId,
        status: 'IN_PROGRESS',
      },
      orderBy: [
        { priority: 'desc' }, // Highest priority first
        { createdAt: 'asc' }, // Then oldest first
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: {
        status: orchestrator.status,
        currentTask: currentTask || null,
        lastActiveAt: orchestrator.user.lastActiveAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status
 *
 * Update Orchestrator status.
 * Requires authentication and workspace access.
 * VPs can update their own status, or admins/owners can update any Orchestrator status.
 *
 * @param request - Next.js request with status update data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Updated Orchestrator status
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/orchestrators/orch_456/status
 * Content-Type: application/json
 *
 * {
 *   "status": "BUSY",
 *   "reason": "Working on critical task"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "status": "BUSY",
 *     "lastActiveAt": "2024-11-26T12:35:00Z"
 *   },
 *   "message": "Orchestrator status updated successfully"
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
    const parseResult = updateStatusSchema.safeParse(body);
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

    const input: UpdateStatusInput = parseResult.data;

    // Check access
    const result = await checkOrchestratorAccess(workspaceId, orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if user is the Orchestrator or has admin/owner access
    const isOrchestratorUser = session.user.id === result.orchestrator.userId;
    const hasAdminAccess = result.role === 'OWNER' || result.role === 'ADMIN';

    if (!isOrchestratorUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update Orchestrator status',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update Orchestrator status and user's lastActiveAt in a transaction
    const now = new Date();
    const updatedOrchestrator = await prisma.$transaction(async (tx) => {
      // Update Orchestrator status
      const orchestrator = await tx.orchestrator.update({
        where: { id: orchestratorId },
        data: { status: input.status },
        select: {
          id: true,
          status: true,
          userId: true,
        },
      });

      // Update user's lastActiveAt timestamp
      await tx.user.update({
        where: { id: orchestrator.userId },
        data: { lastActiveAt: now },
      });

      return orchestrator;
    });

    return NextResponse.json({
      data: {
        status: updatedOrchestrator.status,
        lastActiveAt: now,
      },
      message: 'Orchestrator status updated successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/status] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
