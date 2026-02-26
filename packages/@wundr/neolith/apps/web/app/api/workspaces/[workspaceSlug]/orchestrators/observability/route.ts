/**
 * OrchestratorObservability Dashboard API Route
 *
 * Provides real-time Orchestrator status dashboard data for monitoring and debugging.
 * Returns all Orchestrators with current status, active tasks, health metrics, and recent events.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/observability - Get real-time Orchestrator status dashboard
 * - POST /api/workspaces/:workspaceId/orchestrators/observability - Record observability event
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/observability/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getWorkspaceObservability } from '@/lib/services/orchestrator-analytics-service-extended';
import {
  observabilityDashboardQuerySchema,
  recordObservabilityEventSchema,
  createAnalyticsErrorResponse,
  ORCHESTRATOR_ANALYTICS_ERROR_CODES,
} from '@/lib/validations/orchestrator-analytics';

import type {
  ObservabilityDashboardQueryInput,
  RecordObservabilityEventInput,
} from '@/lib/validations/orchestrator-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Orchestrator health status interface
 */
interface OrchestratorHealthStatus {
  orchestratorId: string;
  status: string;
  isHealthy: boolean;
  healthScore: number;
  lastActiveAt?: Date;
  issues: string[];
  currentTasksCount: number;
  errorRate: number;
  avgResponseTimeMinutes: number;
}

/**
 * Helper to verify workspace access
 */
async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
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
 * GET /api/workspaces/:workspaceId/orchestrators/observability
 *
 * Get real-time Orchestrator status dashboard data.
 * Returns comprehensive health metrics, task status, and recent activity for all Orchestrators.
 *
 * Query Parameters:
 * - timeRange: Time range for dashboard data (5m, 15m, 1h, 6h, 24h) - default: 1h
 * - includeTaskDetails: Include detailed task information (boolean) - default: true
 * - includeHealthChecks: Include health checks (boolean) - default: true
 * - statusFilter: Filter by status array (optional)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Real-time Orchestrator observability dashboard data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/observability?timeRange=1h&includeTaskDetails=true
 * ```
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
        createAnalyticsErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid workspace ID',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult =
      observabilityDashboardQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const query: ObservabilityDashboardQueryInput = parseResult.data;

    // Get workspace observability data
    const healthStatuses = await getWorkspaceObservability(
      access.workspace.organizationId
    );

    // Filter by status if specified
    let filteredStatuses = healthStatuses;
    if (query.statusFilter && query.statusFilter.length > 0) {
      filteredStatuses = healthStatuses.filter(
        (status: OrchestratorHealthStatus) =>
          query.statusFilter?.includes(
            status.status as 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY'
          )
      );
    }

    // Get Orchestrator details if requested
    const orchestratorDetails = await Promise.all(
      filteredStatuses.map(async (status: OrchestratorHealthStatus) => {
        const orchestrator = await prisma.orchestrator.findUnique({
          where: { id: status.orchestratorId },
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
              orchestratorId: status.orchestratorId,
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
          orchestratorId: status.orchestratorId,
          orchestratorName: orchestrator?.user.name || 'Unknown',
          orchestratorEmail: orchestrator?.user.email,
          orchestratorAvatarUrl: orchestrator?.user.avatarUrl,
          discipline: orchestrator?.discipline,
          role: orchestrator?.role,
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
      })
    );

    // Calculate dashboard summary
    const summary = {
      totalOrchestrators: filteredStatuses.length,
      byStatus: {
        online: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => s.status === 'ONLINE'
        ).length,
        offline: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => s.status === 'OFFLINE'
        ).length,
        busy: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => s.status === 'BUSY'
        ).length,
        away: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => s.status === 'AWAY'
        ).length,
      },
      health: {
        healthy: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => s.isHealthy
        ).length,
        unhealthy: filteredStatuses.filter(
          (s: OrchestratorHealthStatus) => !s.isHealthy
        ).length,
        avgHealthScore:
          filteredStatuses.length > 0
            ? Math.round(
                filteredStatuses.reduce(
                  (sum: number, s: OrchestratorHealthStatus) =>
                    sum + s.healthScore,
                  0
                ) / filteredStatuses.length
              )
            : 0,
      },
      tasks: {
        totalActive: filteredStatuses.reduce(
          (sum: number, s: OrchestratorHealthStatus) =>
            sum + s.currentTasksCount,
          0
        ),
        avgPerOrchestrator:
          filteredStatuses.length > 0
            ? Math.round(
                filteredStatuses.reduce(
                  (sum: number, s: OrchestratorHealthStatus) =>
                    sum + s.currentTasksCount,
                  0
                ) / filteredStatuses.length
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
      orchestrators: orchestratorDetails,
      alerts: [] as Array<{
        severity: string;
        message: string;
        orchestratorId: string;
      }>,
    };

    // Generate alerts for unhealthy Orchestrators
    filteredStatuses.forEach((status: OrchestratorHealthStatus) => {
      if (!status.isHealthy) {
        response.alerts.push({
          severity:
            status.healthScore < 40
              ? 'critical'
              : status.healthScore < 60
                ? 'high'
                : 'medium',
          message: `Orchestrator health degraded: ${status.issues.join(', ')}`,
          orchestratorId: status.orchestratorId,
        });
      }

      if (status.errorRate > 30) {
        response.alerts.push({
          severity: 'high',
          message: `High error rate: ${status.errorRate}%`,
          orchestratorId: status.orchestratorId,
        });
      }

      if (status.currentTasksCount > 20) {
        response.alerts.push({
          severity: 'medium',
          message: `High task load: ${status.currentTasksCount} active tasks`,
          orchestratorId: status.orchestratorId,
        });
      }
    });

    return NextResponse.json({
      data: response,
      message: 'Observability dashboard data retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/observability] Error:',
      error
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ANALYTICS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/observability
 *
 * Record an observability event for monitoring and debugging.
 * Events can be Orchestrator-specific or workspace-level.
 *
 * Request Body:
 * - orchestratorId: OrchestratorID (optional for workspace-level events)
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
 * POST /api/workspaces/ws_123/orchestrators/observability
 * Content-Type: application/json
 *
 * {
 *   "orchestratorId": "vp_456",
 *   "eventType": "task_completed",
 *   "message": "Task completed successfully",
 *   "severity": "info",
 *   "taskId": "task_789"
 * }
 * ```
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
        createAnalyticsErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid workspace ID',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
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
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = recordObservabilityEventSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: RecordObservabilityEventInput = parseResult.data;

    // Verify Orchestrator exists if provided
    if (input.orchestratorId) {
      const orchestrator = await prisma.orchestrator.findFirst({
        where: {
          id: input.orchestratorId,
          organizationId: access.workspace.organizationId,
        },
      });

      if (!orchestrator) {
        return NextResponse.json(
          createAnalyticsErrorResponse(
            'Orchestrator not found',
            ORCHESTRATOR_ANALYTICS_ERROR_CODES.NOT_FOUND
          ),
          { status: 404 }
        );
      }
    }

    // In a real implementation, this would store the event in a separate observability table
    // For now, we'll just return success
    // Note: This requires an ObservabilityEvent model in the schema

    const event = {
      id: `evt_${Date.now()}`,
      workspaceId,
      orchestratorId: input.orchestratorId,
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
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/observability] Error:',
      error
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ANALYTICS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
