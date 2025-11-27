/**
 * Workspace Analytics API Routes
 *
 * Provides comprehensive analytics data for workspace activity including:
 * - Time-series message volume
 * - Orchestrator activity metrics
 * - Task completion trends
 * - Workflow execution statistics
 * - Channel engagement metrics
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/analytics - Get workspace analytics
 *
 * @module app/api/workspaces/[workspaceId]/analytics/route
 */

import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
  workspaceIdParamSchema,
} from '@/lib/validations/organization';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Analytics query parameters schema
 */
interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Time series data point
 */
interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

/**
 * Analytics response structure
 */
interface AnalyticsResponse {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
    granularity: string;
  };
  summary: {
    totalMessages: number;
    totalChannels: number;
    totalMembers: number;
    totalOrchestrators: number;
    totalTasks: number;
    totalWorkflows: number;
    activeOrchestrators: number;
    completedTasks: number;
    successfulWorkflows: number;
  };
  timeSeries: {
    messageVolume: TimeSeriesDataPoint[];
    taskCompletion: TimeSeriesDataPoint[];
    workflowExecution: TimeSeriesDataPoint[];
  };
  orchestratorActivity: Array<{
    orchestratorId: string;
    orchestratorName: string;
    messageCount: number;
    taskCount: number;
    completedTasks: number;
    status: string;
  }>;
  channelEngagement: Array<{
    channelId: string;
    channelName: string;
    messageCount: number;
    memberCount: number;
    type: string;
  }>;
  taskMetrics: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageCompletionHours?: number;
  };
  workflowMetrics: {
    byStatus: Record<string, number>;
    successRate: number;
    averageDurationMs?: number;
  };
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

  return { workspace, orgMembership };
}

/**
 * Parse and validate analytics query parameters
 */
function parseAnalyticsQuery(searchParams: URLSearchParams): AnalyticsQuery {
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const granularity = (searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly') || 'daily';

  // Validate granularity
  if (!['daily', 'weekly', 'monthly'].includes(granularity)) {
    throw new Error('Invalid granularity. Must be daily, weekly, or monthly.');
  }

  return { startDate, endDate, granularity };
}

/**
 * Calculate date range based on query parameters
 */
function calculateDateRange(query: AnalyticsQuery): { start: Date; end: Date } {
  const end = query.endDate ? new Date(query.endDate) : new Date();

  let start: Date;
  if (query.startDate) {
    start = new Date(query.startDate);
  } else {
    // Default to 30 days ago
    start = new Date(end);
    start.setDate(start.getDate() - 30);
  }

  return { start, end };
}

/**
 * Generate time series buckets based on granularity
 */
function generateTimeBuckets(
  start: Date,
  end: Date,
  granularity: 'daily' | 'weekly' | 'monthly',
): Date[] {
  const buckets: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    buckets.push(new Date(current));

    switch (granularity) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return buckets;
}

/**
 * GET /api/workspaces/:workspaceId/analytics
 *
 * Get comprehensive workspace analytics data.
 *
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - granularity: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns Workspace analytics data
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
    const paramResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    let query: AnalyticsQuery;
    try {
      query = parseAnalyticsQuery(searchParams);
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          error instanceof Error ? error.message : 'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Calculate date range
    const { start, end } = calculateDateRange(query);

    // Fetch summary metrics in parallel
    const [
      totalMessages,
      totalChannels,
      totalMembers,
      totalOrchestrators,
      totalTasks,
      totalWorkflows,
      activeOrchestrators,
      completedTasks,
      successfulWorkflows,
    ] = await Promise.all([
      // Total messages in workspace
      prisma.message.count({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          createdAt: {
            gte: start,
            lte: end,
          },
          isDeleted: false,
        },
      }),
      // Total channels
      prisma.channel.count({
        where: {
          workspaceId: params.workspaceId,
          isArchived: false,
        },
      }),
      // Total members
      prisma.workspaceMember.count({
        where: {
          workspaceId: params.workspaceId,
        },
      }),
      // Total Orchestrators
      prisma.orchestrator.count({
        where: {
          workspaceId: params.workspaceId,
        },
      }),
      // Total tasks
      prisma.task.count({
        where: {
          workspaceId: params.workspaceId,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      // Total workflows
      prisma.workflow.count({
        where: {
          workspaceId: params.workspaceId,
        },
      }),
      // Active Orchestrators (ONLINE or BUSY)
      prisma.orchestrator.count({
        where: {
          workspaceId: params.workspaceId,
          status: {
            in: ['ONLINE', 'BUSY'],
          },
        },
      }),
      // Completed tasks
      prisma.task.count({
        where: {
          workspaceId: params.workspaceId,
          status: 'DONE',
          completedAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      // Successful workflows
      prisma.workflowExecution.count({
        where: {
          workspaceId: params.workspaceId,
          status: 'COMPLETED',
          startedAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    // Generate time buckets
    const timeBuckets = generateTimeBuckets(start, end, query.granularity || 'daily');

    // Fetch time series data for messages
    const messageTimeSeries = await Promise.all(
      timeBuckets.map(async (bucketStart, index) => {
        const bucketEnd = timeBuckets[index + 1] || end;
        const count = await prisma.message.count({
          where: {
            channel: {
              workspaceId: params.workspaceId,
            },
            createdAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
            isDeleted: false,
          },
        });
        return {
          timestamp: bucketStart.toISOString(),
          value: count,
        };
      }),
    );

    // Fetch time series data for task completion
    const taskTimeSeries = await Promise.all(
      timeBuckets.map(async (bucketStart, index) => {
        const bucketEnd = timeBuckets[index + 1] || end;
        const count = await prisma.task.count({
          where: {
            workspaceId: params.workspaceId,
            status: 'DONE',
            completedAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
          },
        });
        return {
          timestamp: bucketStart.toISOString(),
          value: count,
        };
      }),
    );

    // Fetch time series data for workflow execution
    const workflowTimeSeries = await Promise.all(
      timeBuckets.map(async (bucketStart, index) => {
        const bucketEnd = timeBuckets[index + 1] || end;
        const count = await prisma.workflowExecution.count({
          where: {
            workspaceId: params.workspaceId,
            status: 'COMPLETED',
            startedAt: {
              gte: bucketStart,
              lt: bucketEnd,
            },
          },
        });
        return {
          timestamp: bucketStart.toISOString(),
          value: count,
        };
      }),
    );

    // Fetch Orchestrator activity metrics
    const orchestrators = await prisma.orchestrator.findMany({
      where: {
        workspaceId: params.workspaceId,
      },
      include: {
        user: {
          select: {
            name: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            tasks: {
              where: {
                createdAt: {
                  gte: start,
                  lte: end,
                },
              },
            },
          },
        },
      },
    });

    const orchestratorActivity = await Promise.all(
      orchestrators.map(async (orchestrator) => {
        const [messageCount, completedTaskCount] = await Promise.all([
          prisma.message.count({
            where: {
              authorId: orchestrator.userId,
              channel: {
                workspaceId: params.workspaceId,
              },
              createdAt: {
                gte: start,
                lte: end,
              },
              isDeleted: false,
            },
          }),
          prisma.task.count({
            where: {
              orchestratorId: orchestrator.id,
              status: 'DONE',
              completedAt: {
                gte: start,
                lte: end,
              },
            },
          }),
        ]);

        return {
          orchestratorId: orchestrator.id,
          orchestratorName: orchestrator.user.displayName || orchestrator.user.name || 'Unknown Orchestrator',
          messageCount,
          taskCount: orchestrator._count.tasks,
          completedTasks: completedTaskCount,
          status: orchestrator.status,
        };
      }),
    );

    // Fetch channel engagement metrics
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: params.workspaceId,
        isArchived: false,
      },
      include: {
        _count: {
          select: {
            messages: {
              where: {
                createdAt: {
                  gte: start,
                  lte: end,
                },
                isDeleted: false,
              },
            },
            channelMembers: true,
          },
        },
      },
    });

    const channelEngagement = channels.map((channel) => ({
      channelId: channel.id,
      channelName: channel.name,
      messageCount: channel._count.messages,
      memberCount: channel._count.channelMembers,
      type: channel.type,
    }));

    // Fetch task metrics
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      where: {
        workspaceId: params.workspaceId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: true,
    });

    const tasksByPriority = await prisma.task.groupBy({
      by: ['priority'],
      where: {
        workspaceId: params.workspaceId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _count: true,
    });

    const completedTasksWithDuration = await prisma.task.findMany({
      where: {
        workspaceId: params.workspaceId,
        status: 'DONE',
        completedAt: {
          gte: start,
          lte: end,
        },
        estimatedHours: {
          not: null,
        },
      },
      select: {
        estimatedHours: true,
        createdAt: true,
        completedAt: true,
      },
    });

    let averageCompletionHours: number | undefined;
    if (completedTasksWithDuration.length > 0) {
      const totalHours = completedTasksWithDuration.reduce((sum, task) => {
        if (task.completedAt && task.createdAt) {
          const hours = (task.completedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      averageCompletionHours = totalHours / completedTasksWithDuration.length;
    }

    // Fetch workflow metrics
    const workflowsByStatus = await prisma.workflowExecution.groupBy({
      by: ['status'],
      where: {
        workspaceId: params.workspaceId,
        startedAt: {
          gte: start,
          lte: end,
        },
      },
      _count: true,
    });

    const completedworkflowExecutions = await prisma.workflowExecution.findMany({
      where: {
        workspaceId: params.workspaceId,
        status: 'COMPLETED',
        startedAt: {
          gte: start,
          lte: end,
        },
        durationMs: {
          not: null,
        },
      },
      select: {
        durationMs: true,
      },
    });

    let averageDurationMs: number | undefined;
    if (completedworkflowExecutions.length > 0) {
      const totalDuration = completedworkflowExecutions.reduce(
        (sum, exec) => sum + (exec.durationMs || 0),
        0,
      );
      averageDurationMs = totalDuration / completedworkflowExecutions.length;
    }

    const totalworkflowExecutions = workflowsByStatus.reduce((sum, group) => sum + group._count, 0);
    const successRate = totalworkflowExecutions > 0
      ? (successfulWorkflows / totalworkflowExecutions) * 100
      : 0;

    // Build response
    const response: AnalyticsResponse = {
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
        granularity: query.granularity || 'daily',
      },
      summary: {
        totalMessages,
        totalChannels,
        totalMembers,
        totalOrchestrators,
        totalTasks,
        totalWorkflows,
        activeOrchestrators,
        completedTasks,
        successfulWorkflows,
      },
      timeSeries: {
        messageVolume: messageTimeSeries,
        taskCompletion: taskTimeSeries,
        workflowExecution: workflowTimeSeries,
      },
      orchestratorActivity: orchestratorActivity.sort((a, b) => b.messageCount - a.messageCount),
      channelEngagement: channelEngagement.sort((a, b) => b.messageCount - a.messageCount),
      taskMetrics: {
        byStatus: Object.fromEntries(
          tasksByStatus.map((group) => [group.status, group._count]),
        ),
        byPriority: Object.fromEntries(
          tasksByPriority.map((group) => [group.priority, group._count]),
        ),
        ...(averageCompletionHours !== undefined && { averageCompletionHours }),
      },
      workflowMetrics: {
        byStatus: Object.fromEntries(
          workflowsByStatus.map((group) => [group.status, group._count]),
        ),
        successRate: Math.round(successRate * 100) / 100,
        ...(averageDurationMs !== undefined && { averageDurationMs }),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/analytics] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred while fetching analytics',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
