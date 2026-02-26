/**
 * Workspace Usage Analytics API Route
 *
 * Provides comprehensive usage analytics including:
 * - Resource usage tracking (storage, API calls, bandwidth, compute time)
 * - Feature adoption metrics
 * - Usage trends over time
 * - Cost analysis
 * - Top resource consumers
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/analytics/usage - Get usage analytics
 *
 * @module app/api/workspaces/[workspaceSlug]/analytics/usage/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
  workspaceIdParamSchema,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Analytics query parameters schema
 */
interface UsageQuery {
  startDate?: string;
  endDate?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Helper to check workspace access via organization membership
 */
async function checkWorkspaceAccess(workspaceIdOrSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }] },
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
 * Parse and validate usage query parameters
 */
function parseUsageQuery(searchParams: URLSearchParams): UsageQuery {
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const granularity =
    (searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly') ||
    'daily';

  // Validate granularity
  if (!['daily', 'weekly', 'monthly'].includes(granularity)) {
    throw new Error('Invalid granularity. Must be daily, weekly, or monthly.');
  }

  // Validate date formats if provided
  if (startDate && isNaN(Date.parse(startDate))) {
    throw new Error('Invalid startDate format. Use ISO 8601 format.');
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    throw new Error('Invalid endDate format. Use ISO 8601 format.');
  }

  // Validate date range
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error('startDate must be before or equal to endDate.');
  }

  return { startDate, endDate, granularity };
}

/**
 * Calculate date range based on query parameters
 */
function calculateDateRange(query: UsageQuery): { start: Date; end: Date } {
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
  granularity: 'daily' | 'weekly' | 'monthly'
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
 * Calculate storage usage by file type
 */
async function calculateStorageUsage(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Get all files in workspace
  const files = await prisma.file.findMany({
    where: {
      workspaceId: workspaceId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      size: true,
      mimeType: true,
    },
  });

  let documents = 0;
  let images = 0;
  let videos = 0;
  let other = 0;

  files.forEach(file => {
    const size = Number(file.size || 0);
    const mime = file.mimeType?.toLowerCase() || '';

    if (
      mime.includes('pdf') ||
      mime.includes('doc') ||
      mime.includes('text') ||
      mime.includes('spreadsheet')
    ) {
      documents += size;
    } else if (mime.includes('image')) {
      images += size;
    } else if (mime.includes('video')) {
      videos += size;
    } else {
      other += size;
    }
  });

  const total = documents + images + videos + other;
  const limit = 10 * 1024 * 1024 * 1024; // 10GB default limit
  const percentUsed = limit > 0 ? (total / limit) * 100 : 0;

  return {
    total,
    documents,
    images,
    videos,
    other,
    limit,
    percentUsed,
  };
}

/**
 * Calculate API calls metrics
 */
async function calculateApiCallsMetrics(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Count messages as API calls (simplified)
  const totalCalls = await prisma.message.count({
    where: {
      channel: {
        workspaceId: workspaceId,
      },
      createdAt: {
        gte: start,
        lte: end,
      },
      isDeleted: false,
    },
  });

  // Estimate successful vs failed (90% success rate assumed)
  const successful = Math.floor(totalCalls * 0.9);
  const failed = totalCalls - successful;

  const limit = 100000; // 100k calls default limit
  const percentUsed = limit > 0 ? (totalCalls / limit) * 100 : 0;

  return {
    total: totalCalls,
    successful,
    failed,
    limit,
    percentUsed,
  };
}

/**
 * Calculate bandwidth usage
 */
async function calculateBandwidthUsage(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Get file uploads (simplified calculation)
  const files = await prisma.file.findMany({
    where: {
      workspaceId: workspaceId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      size: true,
    },
  });

  const upload = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  // Estimate download as 3x upload
  const download = upload * 3;
  const total = upload + download;

  const limit = 100 * 1024 * 1024 * 1024; // 100GB default limit
  const percentUsed = limit > 0 ? (total / limit) * 100 : 0;

  return {
    total,
    upload,
    download,
    limit,
    percentUsed,
  };
}

/**
 * Calculate compute time usage
 */
async function calculateComputeTimeUsage(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Get workflow executions
  const workflows = await prisma.workflowExecution.findMany({
    where: {
      workspaceId: workspaceId,
      startedAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      durationMs: true,
    },
  });

  const workflowsTime = workflows.reduce(
    (sum, w) => sum + (w.durationMs || 0),
    0
  );

  // Estimate orchestrator compute time (simplified)
  const orchestratorsCount = await prisma.orchestrator.count({
    where: {
      workspaceId: workspaceId,
      status: {
        in: ['ONLINE', 'BUSY'],
      },
    },
  });

  const timeRange = end.getTime() - start.getTime();
  const orchestratorsTime = orchestratorsCount * timeRange * 0.1; // 10% active time

  const total = workflowsTime + orchestratorsTime;
  const limit = 10 * 60 * 60 * 1000; // 10 hours default limit
  const percentUsed = limit > 0 ? (total / limit) * 100 : 0;

  return {
    total,
    orchestrators: orchestratorsTime,
    workflows: workflowsTime,
    limit,
    percentUsed,
  };
}

/**
 * Calculate feature adoption metrics
 */
async function calculateFeatureAdoption(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Previous period for comparison
  const timeRange = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - timeRange);
  const prevEnd = start;

  // Orchestrators
  const totalOrchestrators = await prisma.orchestrator.count({
    where: { workspaceId },
  });

  const activeOrchestrators = await prisma.orchestrator.count({
    where: {
      workspaceId,
      status: { in: ['ONLINE', 'BUSY'] },
    },
  });

  const prevActiveOrchestrators = await prisma.orchestrator.count({
    where: {
      workspaceId,
      status: { in: ['ONLINE', 'BUSY'] },
      updatedAt: { gte: prevStart, lte: prevEnd },
    },
  });

  const orchestratorChange =
    prevActiveOrchestrators > 0
      ? ((activeOrchestrators - prevActiveOrchestrators) /
          prevActiveOrchestrators) *
        100
      : 0;

  // Workflows
  const totalWorkflows = await prisma.workflow.count({
    where: { workspaceId },
  });

  const activeWorkflows = await prisma.workflowExecution
    .groupBy({
      by: ['workflowId'],
      where: {
        workspaceId,
        startedAt: { gte: start, lte: end },
      },
    })
    .then(results => results.length);

  const prevActiveWorkflows = await prisma.workflowExecution
    .groupBy({
      by: ['workflowId'],
      where: {
        workspaceId,
        startedAt: { gte: prevStart, lte: prevEnd },
      },
    })
    .then(results => results.length);

  const workflowChange =
    prevActiveWorkflows > 0
      ? ((activeWorkflows - prevActiveWorkflows) / prevActiveWorkflows) * 100
      : 0;

  // Channels
  const totalChannels = await prisma.channel.count({
    where: { workspaceId, isArchived: false },
  });

  const activeChannels = await prisma.message
    .groupBy({
      by: ['channelId'],
      where: {
        channel: { workspaceId },
        createdAt: { gte: start, lte: end },
        isDeleted: false,
      },
    })
    .then(results => results.length);

  const prevActiveChannels = await prisma.message
    .groupBy({
      by: ['channelId'],
      where: {
        channel: { workspaceId },
        createdAt: { gte: prevStart, lte: prevEnd },
        isDeleted: false,
      },
    })
    .then(results => results.length);

  const channelChange =
    prevActiveChannels > 0
      ? ((activeChannels - prevActiveChannels) / prevActiveChannels) * 100
      : 0;

  // Integrations (simplified - count unique orchestrator types)
  const totalIntegrations = await prisma.orchestrator.count({
    where: { workspaceId },
  });

  const activeIntegrations = await prisma.orchestrator.count({
    where: {
      workspaceId,
      status: { in: ['ONLINE', 'BUSY'] },
    },
  });

  const prevActiveIntegrations = await prisma.orchestrator.count({
    where: {
      workspaceId,
      status: { in: ['ONLINE', 'BUSY'] },
      updatedAt: { gte: prevStart, lte: prevEnd },
    },
  });

  const integrationChange =
    prevActiveIntegrations > 0
      ? ((activeIntegrations - prevActiveIntegrations) /
          prevActiveIntegrations) *
        100
      : 0;

  return {
    orchestrators: {
      active: activeOrchestrators,
      total: totalOrchestrators,
      adoptionRate:
        totalOrchestrators > 0
          ? (activeOrchestrators / totalOrchestrators) * 100
          : 0,
      trend:
        orchestratorChange > 5
          ? ('up' as const)
          : orchestratorChange < -5
            ? ('down' as const)
            : ('stable' as const),
      changePercent: orchestratorChange,
    },
    workflows: {
      active: activeWorkflows,
      total: totalWorkflows,
      adoptionRate:
        totalWorkflows > 0 ? (activeWorkflows / totalWorkflows) * 100 : 0,
      trend:
        workflowChange > 5
          ? ('up' as const)
          : workflowChange < -5
            ? ('down' as const)
            : ('stable' as const),
      changePercent: workflowChange,
    },
    channels: {
      active: activeChannels,
      total: totalChannels,
      adoptionRate:
        totalChannels > 0 ? (activeChannels / totalChannels) * 100 : 0,
      trend:
        channelChange > 5
          ? ('up' as const)
          : channelChange < -5
            ? ('down' as const)
            : ('stable' as const),
      changePercent: channelChange,
    },
    integrations: {
      active: activeIntegrations,
      total: totalIntegrations,
      adoptionRate:
        totalIntegrations > 0
          ? (activeIntegrations / totalIntegrations) * 100
          : 0,
      trend:
        integrationChange > 5
          ? ('up' as const)
          : integrationChange < -5
            ? ('down' as const)
            : ('stable' as const),
      changePercent: integrationChange,
    },
  };
}

/**
 * Calculate usage trends over time
 */
async function calculateUsageTrends(
  workspaceId: string,
  start: Date,
  end: Date,
  granularity: 'daily' | 'weekly' | 'monthly'
) {
  const buckets = generateTimeBuckets(start, end, granularity);

  const daily = await Promise.all(
    buckets.map(async (bucketStart, index) => {
      const bucketEnd = buckets[index + 1] || end;

      // Storage (cumulative)
      const files = await prisma.file.findMany({
        where: {
          workspaceId,
          createdAt: { gte: start, lte: bucketEnd },
        },
        select: { size: true },
      });
      const storage = files.reduce((sum, f) => sum + Number(f.size || 0), 0);

      // API calls (in bucket)
      const apiCalls = await prisma.message.count({
        where: {
          channel: { workspaceId },
          createdAt: { gte: bucketStart, lt: bucketEnd },
          isDeleted: false,
        },
      });

      // Bandwidth (estimate from files uploaded in bucket)
      const uploadedFiles = await prisma.file.findMany({
        where: {
          workspaceId,
          createdAt: { gte: bucketStart, lt: bucketEnd },
        },
        select: { size: true },
      });
      const upload = uploadedFiles.reduce(
        (sum, f) => sum + Number(f.size || 0),
        0
      );
      const bandwidth = upload * 4; // Upload + 3x download estimate

      // Compute time (in bucket)
      const workflows = await prisma.workflowExecution.findMany({
        where: {
          workspaceId,
          startedAt: { gte: bucketStart, lt: bucketEnd },
        },
        select: { durationMs: true },
      });
      const computeTime = workflows.reduce(
        (sum, w) => sum + (w.durationMs || 0),
        0
      );

      return {
        date: bucketStart.toISOString(),
        storage,
        apiCalls,
        bandwidth,
        computeTime,
      };
    })
  );

  return { daily };
}

/**
 * Calculate cost analysis
 */
async function calculateCostAnalysis(
  storageTotal: number,
  apiCallsTotal: number,
  bandwidthTotal: number,
  computeTimeTotal: number,
  start: Date,
  end: Date
) {
  // Pricing (example rates per unit)
  const STORAGE_COST_PER_GB = 0.023; // $0.023 per GB per month
  const API_COST_PER_1K = 0.01; // $0.01 per 1000 calls
  const BANDWIDTH_COST_PER_GB = 0.09; // $0.09 per GB
  const COMPUTE_COST_PER_HOUR = 0.1; // $0.10 per hour

  const storageCost =
    (storageTotal / (1024 * 1024 * 1024)) * STORAGE_COST_PER_GB;
  const apiCallsCost = (apiCallsTotal / 1000) * API_COST_PER_1K;
  const bandwidthCost =
    (bandwidthTotal / (1024 * 1024 * 1024)) * BANDWIDTH_COST_PER_GB;
  const computeCost =
    (computeTimeTotal / (1000 * 60 * 60)) * COMPUTE_COST_PER_HOUR;

  const total = storageCost + apiCallsCost + bandwidthCost + computeCost;

  // Project to full month
  const daysInPeriod =
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const projectedMonthly =
    daysInPeriod > 0 ? (total / daysInPeriod) * 30 : total;

  // Calculate trend (simplified - compare to projected)
  const trend =
    total > projectedMonthly * 0.8
      ? ('up' as const)
      : total < projectedMonthly * 0.6
        ? ('down' as const)
        : ('stable' as const);
  const changePercent =
    projectedMonthly > 0
      ? ((total - projectedMonthly * 0.7) / (projectedMonthly * 0.7)) * 100
      : 0;

  return {
    total,
    breakdown: {
      storage: storageCost,
      apiCalls: apiCallsCost,
      bandwidth: bandwidthCost,
      compute: computeCost,
    },
    projectedMonthly,
    trend,
    changePercent,
  };
}

/**
 * Get top resource consumers
 */
async function getTopResourceConsumers(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // Top storage users
  const filesByUser = await prisma.file.groupBy({
    by: ['uploadedById'],
    where: {
      workspaceId,
      createdAt: { gte: start, lte: end },
    },
    _sum: {
      size: true,
    },
    orderBy: {
      _sum: {
        size: 'desc',
      },
    },
    take: 5,
  });

  const byStorage = await Promise.all(
    filesByUser.map(async item => {
      const user = await prisma.user.findUnique({
        where: { id: item.uploadedById || '' },
        select: { name: true, displayName: true },
      });

      return {
        id: item.uploadedById || 'unknown',
        name: user?.displayName || user?.name || 'Unknown User',
        value: item._sum.size || 0,
        type: 'user' as const,
      };
    })
  );

  // Top API callers (by message count)
  const messagesByUser = await prisma.message.groupBy({
    by: ['authorId'],
    where: {
      channel: { workspaceId },
      createdAt: { gte: start, lte: end },
      isDeleted: false,
    },
    _count: true,
    orderBy: {
      _count: {
        authorId: 'desc',
      },
    },
    take: 5,
  });

  const byApiCalls = await Promise.all(
    messagesByUser.map(async item => {
      const user = await prisma.user.findUnique({
        where: { id: item.authorId },
        select: { name: true, displayName: true },
      });

      return {
        id: item.authorId,
        name: user?.displayName || user?.name || 'Unknown User',
        value: item._count,
        type: 'user' as const,
      };
    })
  );

  // Top compute time users (by workflow execution)
  const workflowsByWorkflow = await prisma.workflowExecution.groupBy({
    by: ['workflowId'],
    where: {
      workspaceId,
      startedAt: { gte: start, lte: end },
    },
    _sum: {
      durationMs: true,
    },
    orderBy: {
      _sum: {
        durationMs: 'desc',
      },
    },
    take: 5,
  });

  const byComputeTime = await Promise.all(
    workflowsByWorkflow.map(async item => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: item.workflowId },
        select: { name: true },
      });

      return {
        id: item.workflowId,
        name: workflow?.name || 'Unknown Workflow',
        value: item._sum?.durationMs || 0,
        type: 'workflow' as const,
      };
    })
  );

  return {
    byStorage,
    byApiCalls,
    byComputeTime,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/analytics/usage
 *
 * Get comprehensive workspace usage analytics data.
 *
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - granularity: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns Usage analytics data
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
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    let query: UsageQuery;
    try {
      query = parseUsageQuery(searchParams);
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          error instanceof Error ? error.message : 'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Calculate date range
    const { start, end } = calculateDateRange(query);

    // Fetch all metrics in parallel
    const [
      resourceUsageStorage,
      resourceUsageApiCalls,
      resourceUsageBandwidth,
      resourceUsageComputeTime,
      featureAdoption,
      usageTrends,
      topResourceConsumers,
    ] = await Promise.all([
      calculateStorageUsage(workspaceId, start, end),
      calculateApiCallsMetrics(workspaceId, start, end),
      calculateBandwidthUsage(workspaceId, start, end),
      calculateComputeTimeUsage(workspaceId, start, end),
      calculateFeatureAdoption(workspaceId, start, end),
      calculateUsageTrends(
        workspaceId,
        start,
        end,
        query.granularity || 'daily'
      ),
      getTopResourceConsumers(workspaceId, start, end),
    ]);

    // Calculate cost analysis
    const costAnalysis = await calculateCostAnalysis(
      resourceUsageStorage.total,
      resourceUsageApiCalls.total,
      resourceUsageBandwidth.total,
      resourceUsageComputeTime.total,
      start,
      end
    );

    // Build response
    const response = {
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      resourceUsage: {
        storage: resourceUsageStorage,
        apiCalls: resourceUsageApiCalls,
        bandwidth: resourceUsageBandwidth,
        computeTime: resourceUsageComputeTime,
      },
      featureAdoption,
      usageTrends,
      costAnalysis,
      topResourceConsumers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/analytics/usage] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred while fetching usage analytics',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
