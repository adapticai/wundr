/**
 * OrchestratorCapacity API Routes
 *
 * Handles Orchestrator capacity and workload management including
 * max concurrent tasks, energy budget, and utilization metrics.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity - Get Orchestrator capacity and utilization
 * - PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity - Update Orchestrator capacity limits
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/capacity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getCapacity, updateCapacity } from '@/lib/services/orchestrator-scheduling-service';
import { createErrorResponse, ORCHESTRATOR_ERROR_CODES } from '@/lib/validations/orchestrator';
import {
  getCapacitySchema,
  updateCapacitySchema,
} from '@/lib/validations/orchestrator-scheduling';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 */
async function checkVPAccess(workspaceId: string, orchestratorId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
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
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  const orchestrator = await prisma.vP.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    select: { id: true, userId: true },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity
 *
 * Get Orchestrator's current capacity/workload including:
 * - Max concurrent tasks
 * - Energy budget and current energy level
 * - Active tasks count
 * - Queued tasks count
 * - Utilization percentage
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator capacity configuration and utilization metrics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/capacity?includeMetrics=true
 *
 * Response:
 * {
 *   "data": {
 *     "config": {
 *       "maxConcurrentTasks": 5,
 *       "energyBudget": 100,
 *       "currentEnergy": 75,
 *       "maxQueueSize": 50
 *     },
 *     "utilization": {
 *       "activeTasks": 3,
 *       "queuedTasks": 12,
 *       "utilizationPercentage": 60,
 *       "energyUsed": 25,
 *       "energyRemaining": 75
 *     }
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = getCapacitySchema.safeParse({
      includeMetrics: searchParams.get('includeMetrics'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const capacity = await getCapacity(orchestratorId);

    // Return default capacity if none configured
    if (!capacity) {
      return NextResponse.json({
        data: {
          config: {
            maxConcurrentTasks: 5,
            energyBudget: 100,
            currentEnergy: 100,
            maxQueueSize: 50,
          },
          utilization: {
            activeTasks: 0,
            queuedTasks: 0,
            utilizationPercentage: 0,
            energyUsed: 0,
            energyRemaining: 100,
          },
        },
        message: 'Using default capacity configuration',
      });
    }

    return NextResponse.json({ data: capacity });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity
 *
 * Update Orchestrator's capacity limits.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request with capacity update data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Updated capacity configuration
 *
 * @example
 * ```
 * PATCH /api/workspaces/ws_123/orchestrators/orch_456/capacity
 * Content-Type: application/json
 *
 * {
 *   "maxConcurrentTasks": 10,
 *   "energyBudget": 150,
 *   "maxQueueSize": 75
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "maxConcurrentTasks": 10,
 *     "energyBudget": 150,
 *     "currentEnergy": 150,
 *     "maxQueueSize": 75
 *   },
 *   "message": "Capacity updated successfully"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = updateCapacitySchema.safeParse(body);
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

    const result = await checkVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update Orchestrator capacity',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const updatedCapacity = await updateCapacity(orchestratorId, parseResult.data);

    return NextResponse.json({
      data: updatedCapacity,
      message: 'Capacity updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/capacity] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
