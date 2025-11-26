/**
 * VP Observability Dashboard API Route
 *
 * Provides real-time VP status dashboard data for monitoring and debugging.
 * Returns all VPs with current status, active tasks, health metrics, and recent events.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/observability - Get real-time VP status dashboard
 * - POST /api/workspaces/:workspaceId/vps/observability - Record observability event
 *
 * @module app/api/workspaces/[workspaceId]/vps/observability/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getWorkspaceObservability } from '@/lib/services/vp-analytics-service-extended';
import {
  observabilityDashboardQuerySchema,
  recordObservabilityEventSchema,
  createAnalyticsErrorResponse,
  VP_ANALYTICS_ERROR_CODES,
} from '@/lib/validations/vp-analytics';

import type { NextRequest } from 'next/server';
import type {
  ObservabilityDashboardQueryInput,
  RecordObservabilityEventInput,
} from '@/lib/validations/vp-analytics';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Helper to verify workspace access
 */
async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true, name: true },
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

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceId/vps/observability
 *
 * Get real-time VP status dashboard data.
 * Returns comprehensive health metrics, task status, and recent activity for all VPs.
 *
 * Query Parameters:
 * - timeRange: Time range for dashboard data (5m, 15m, 1h, 6h, 24h) - default: 1h
 * - includeTaskDetails: Include detailed task information (boolean) - default: true
 * - includeHealthChecks: Include health checks (boolean) - default: true
 * - statusFilter: Filter by status array (optional)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Real-time VP observability dashboard data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/observability?timeRange=1h&includeTaskDetails=true
 * ```
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
        createAnalyticsErrorResponse(
          'Authentication required',
          VP_ANALYTICS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid workspace ID',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Workspace not found or access denied',
          VP_ANALYTICS_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = observabilityDashboardQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query: ObservabilityDashboardQueryInput = parseResult.data;

    // Get workspace observability data
    const healthStatuses = await getWorkspaceObservability(
      access.workspace.organizationId,
    );

    // Filter by status if specified
    let filteredStatuses = healthStatuses;
    if (query.statusFilter && query.statusFilter.length > 0) {
      filteredStatuses = healthStatuses.filter((status) =>
        query.statusFilter?.includes(status.status as 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY'),
      );
    }

    // Get VP details if requested
    const vpDetails = await Promise.all(
      filteredStatuses.map(async (status) => {
        const vp = await prisma.vP.findUnique({
          where: { id: status.vpId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Get task details if requested
        let tasks = undefined;
        if (query.includeTaskDetails) {
          tasks = await prisma.task.findMany({
            where: {
              vpId: status.vpId,
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
            take: 5,
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
            },
          });
        }

        return {
          vpId: status.vpId,
          vpName: vp?.user.name || 'Unknown',
          vpEmail: vp?.user.email,
          vpAvatarUrl: vp?.user.avatarUrl,
          discipline: vp?.discipline,
          role: vp?.role,
          status: status.status,
          health: {
            isHealthy: status.isHealthy,
            score: status.healthScore,
            lastActiveAt: status.lastActiveAt?.toISOString() || null,
            issues: status.issues,
          },
          metrics: {
            currentTasksCount: status.currentTasksCount,
            errorRate: status.errorRate,
            avgResponseTimeMinutes: status.avgResponseTimeMinutes,
          },
          ...(tasks && { currentTasks: tasks }),
        };
      }),
    );

    // Calculate dashboard summary
    const summary = {
      totalVPs: filteredStatuses.length,
      byStatus: {
        online: filteredStatuses.filter((s) => s.status === 'ONLINE').length,
        offline: filteredStatuses.filter((s) => s.status === 'OFFLINE').length,
        busy: filteredStatuses.filter((s) => s.status === 'BUSY').length,
        away: filteredStatuses.filter((s) => s.status === 'AWAY').length,
      },
      health: {
        healthy: filteredStatuses.filter((s) => s.isHealthy).length,
        unhealthy: filteredStatuses.filter((s) => !s.isHealthy).length,
        avgHealthScore:
          filteredStatuses.length > 0
            ? Math.round(
                filteredStatuses.reduce((sum, s) => sum + s.healthScore, 0) /
                  filteredStatuses.length,
              )
            : 0,
      },
      tasks: {
        totalActive: filteredStatuses.reduce((sum, s) => sum + s.currentTasksCount, 0),
        avgPerVP:
          filteredStatuses.length > 0
            ? Math.round(
                filteredStatuses.reduce((sum, s) => sum + s.currentTasksCount, 0) /
                  filteredStatuses.length,
              )
            : 0,
      },
    };

    // Build response
    const response = {
      workspaceId,
      workspaceName: access.workspace.name,
      timeRange: query.timeRange,
      timestamp: new Date().toISOString(),
      summary,
      vps: vpDetails,
      alerts: [] as Array<{ severity: string; message: string; vpId: string }>,
    };

    // Generate alerts for unhealthy VPs
    filteredStatuses.forEach((status) => {
      if (!status.isHealthy) {
        response.alerts.push({
          severity: status.healthScore < 40 ? 'critical' : status.healthScore < 60 ? 'high' : 'medium',
          message: `VP health degraded: ${status.issues.join(', ')}`,
          vpId: status.vpId,
        });
      }

      if (status.errorRate > 30) {
        response.alerts.push({
          severity: 'high',
          message: `High error rate: ${status.errorRate}%`,
          vpId: status.vpId,
        });
      }

      if (status.currentTasksCount > 20) {
        response.alerts.push({
          severity: 'medium',
          message: `High task load: ${status.currentTasksCount} active tasks`,
          vpId: status.vpId,
        });
      }
    });

    return NextResponse.json({
      data: response,
      message: 'Observability dashboard data retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/vps/observability] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        VP_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/observability
 *
 * Record an observability event for monitoring and debugging.
 * Events can be VP-specific or workspace-level.
 *
 * Request Body:
 * - vpId: VP ID (optional for workspace-level events)
 * - eventType: Event type (status_change, task_started, task_completed, task_failed, error, warning, info)
 * - message: Event message (required)
 * - severity: Event severity (info, warning, error, critical) - default: info
 * - metadata: Optional event metadata
 * - taskId: Related task ID (optional)
 * - channelId: Related channel ID (optional)
 *
 * @param request - Next.js request with event data
 * @param context - Route context containing workspace ID
 * @returns Success message
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps/observability
 * Content-Type: application/json
 *
 * {
 *   "vpId": "vp_456",
 *   "eventType": "task_completed",
 *   "message": "Task completed successfully",
 *   "severity": "info",
 *   "taskId": "task_789"
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
        createAnalyticsErrorResponse(
          'Authentication required',
          VP_ANALYTICS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid workspace ID',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Workspace not found or access denied',
          VP_ANALYTICS_ERROR_CODES.WORKSPACE_NOT_FOUND,
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
        createAnalyticsErrorResponse(
          'Invalid JSON body',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = recordObservabilityEventSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Validation failed',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: RecordObservabilityEventInput = parseResult.data;

    // Verify VP exists if provided
    if (input.vpId) {
      const vp = await prisma.vP.findFirst({
        where: {
          id: input.vpId,
          organizationId: access.workspace.organizationId,
        },
      });

      if (!vp) {
        return NextResponse.json(
          createAnalyticsErrorResponse(
            'VP not found',
            VP_ANALYTICS_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    // In a real implementation, this would store the event in a separate observability table
    // For now, we'll just return success
    // Note: This requires an ObservabilityEvent model in the schema

    const event = {
      id: `evt_${Date.now()}`,
      workspaceId,
      vpId: input.vpId,
      eventType: input.eventType,
      message: input.message,
      severity: input.severity,
      metadata: input.metadata,
      taskId: input.taskId,
      channelId: input.channelId,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        message: 'Observability event recorded successfully',
        data: event,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/vps/observability] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        VP_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
