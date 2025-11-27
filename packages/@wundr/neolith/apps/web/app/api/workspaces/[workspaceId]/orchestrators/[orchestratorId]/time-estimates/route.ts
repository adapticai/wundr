/**
 * OrchestratorTime Estimates API Routes
 *
 * Handles recording and analyzing Orchestrator's time estimation accuracy
 * by tracking estimated vs actual time for completed tasks.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates - Get time estimation history
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates - Record time estimate data
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/time-estimates/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse, ORCHESTRATOR_ERROR_CODES } from '@/lib/validations/orchestrator';
import {
  getTimeEstimatesSchema,
  recordTimeEstimateSchema,
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
async function checkOrchestratorAccess(workspaceId: string, orchestratorId: string, userId: string) {
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

  const orchestrator = await prisma.orchestrator.findFirst({
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
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates
 *
 * Get Orchestrator's time estimation history and accuracy metrics.
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Time estimation history and accuracy metrics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/time-estimates?limit=20&includeMetrics=true
 *
 * Response:
 * {
 *   "data": {
 *     "estimates": [
 *       {
 *         "taskId": "task_123",
 *         "taskTitle": "Implement auth",
 *         "estimatedHours": 8,
 *         "actualHours": 10,
 *         "accuracy": 80,
 *         "variance": 2,
 *         "completedAt": "2024-11-26T15:00:00Z"
 *       }
 *     ],
 *     "metrics": {
 *       "totalEstimates": 45,
 *       "averageAccuracy": 85.2,
 *       "averageVariance": 1.5,
 *       "overestimateRate": 30,
 *       "underestimateRate": 50,
 *       "perfectEstimateRate": 20
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

    const result = await checkOrchestratorAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = getTimeEstimatesSchema.safeParse({
      limit: searchParams.get('limit'),
      includeMetrics: searchParams.get('includeMetrics'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
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

    const { limit, includeMetrics, fromDate, toDate } = queryResult.data;

    // Build where clause for date filtering
    const whereClause: Record<string, unknown> = {
      orchestratorId: orchestratorId,
      status: 'DONE',
      completedAt: { not: null },
      metadata: {
        path: ['timeTracking'],
        not: null,
      },
    };

    if (fromDate) {
      whereClause.completedAt = {
        ...((whereClause.completedAt as Record<string, unknown>) || {}),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      whereClause.completedAt = {
        ...((whereClause.completedAt as Record<string, unknown>) || {}),
        lte: new Date(toDate),
      };
    }

    // Fetch tasks with time tracking data
    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        estimatedHours: true,
        completedAt: true,
        metadata: true,
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    // Process time estimates
    const estimates = tasks
      .map((task) => {
        const metadata = task.metadata as Record<string, unknown>;
        const timeTracking = metadata.timeTracking as
          | { actualHours?: number; notes?: string }
          | undefined;

        if (!timeTracking?.actualHours || !task.estimatedHours) {
          return null;
        }

        const estimatedHours = task.estimatedHours;
        const actualHours = timeTracking.actualHours;
        const variance = actualHours - estimatedHours;
        const accuracy = Math.round(
          (1 - Math.abs(variance) / Math.max(estimatedHours, actualHours)) * 100,
        );

        return {
          taskId: task.id,
          taskTitle: task.title,
          estimatedHours,
          actualHours,
          accuracy,
          variance,
          completedAt: task.completedAt,
          notes: timeTracking.notes,
        };
      })
      .filter((estimate): estimate is NonNullable<typeof estimate> => estimate !== null);

    // Calculate metrics if requested
    let metrics = null;
    if (includeMetrics && estimates.length > 0) {
      const totalEstimates = estimates.length;
      const averageAccuracy =
        estimates.reduce((sum, e) => sum + e.accuracy, 0) / totalEstimates;
      const averageVariance =
        estimates.reduce((sum, e) => sum + Math.abs(e.variance), 0) / totalEstimates;

      const overestimates = estimates.filter((e) => e.variance < 0).length;
      const underestimates = estimates.filter((e) => e.variance > 0).length;
      const perfectEstimates = estimates.filter((e) => e.variance === 0).length;

      metrics = {
        totalEstimates,
        averageAccuracy: Math.round(averageAccuracy * 100) / 100,
        averageVariance: Math.round(averageVariance * 100) / 100,
        overestimateRate: Math.round((overestimates / totalEstimates) * 100),
        underestimateRate: Math.round((underestimates / totalEstimates) * 100),
        perfectEstimateRate: Math.round((perfectEstimates / totalEstimates) * 100),
      };
    }

    return NextResponse.json({
      data: {
        estimates,
        ...(metrics && { metrics }),
      },
      count: estimates.length,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates
 *
 * Record actual time vs estimated for a completed task.
 * This helps track Orchestrator's estimation accuracy over time.
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request with time estimate data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Success confirmation
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/orchestrators/orch_456/time-estimates
 * Content-Type: application/json
 *
 * {
 *   "taskId": "task_789",
 *   "estimatedHours": 8,
 *   "actualHours": 10,
 *   "completedAt": "2024-11-27T15:00:00Z",
 *   "notes": "Required additional debugging time"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "taskId": "task_789",
 *     "accuracy": 80,
 *     "variance": 2
 *   },
 *   "message": "Time estimate recorded successfully"
 * }
 * ```
 */
export async function POST(
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

    const parseResult = recordTimeEstimateSchema.safeParse(body);
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

    const result = await checkOrchestratorAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const { taskId, estimatedHours, actualHours, completedAt, notes } = parseResult.data;

    // Verify task exists and belongs to this Orchestrator
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        orchestratorId: orchestratorId,
        workspaceId,
      },
      select: {
        id: true,
        metadata: true,
        estimatedHours: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found or does not belong to this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.TASK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Calculate accuracy metrics
    const variance = actualHours - estimatedHours;
    const accuracy = Math.round(
      (1 - Math.abs(variance) / Math.max(estimatedHours, actualHours)) * 100,
    );

    // Update task metadata with time tracking info
    const currentMetadata = (task.metadata as Record<string, unknown>) || {};

    await prisma.task.update({
      where: { id: taskId },
      data: {
        estimatedHours: Math.round(estimatedHours),
        metadata: {
          ...currentMetadata,
          timeTracking: {
            estimatedHours,
            actualHours,
            variance,
            accuracy,
            recordedAt: new Date().toISOString(),
            notes,
          },
        },
        ...(completedAt && { completedAt: new Date(completedAt) }),
      },
    });

    return NextResponse.json(
      {
        data: {
          taskId,
          estimatedHours,
          actualHours,
          accuracy,
          variance,
        },
        message: 'Time estimate recorded successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/time-estimates] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
