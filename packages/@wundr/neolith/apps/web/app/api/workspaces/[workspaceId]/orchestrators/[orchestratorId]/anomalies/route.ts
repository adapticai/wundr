/**
 * OrchestratorAnomaly Detection API Route
 *
 * Detects Orchestrator performance anomalies and underperformance patterns.
 * Identifies issues like low completion rates, high response times, and error rates.
 * Provides actionable suggestions for improvement.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/anomalies - Detect Orchestrator performance anomalies
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/anomalies/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { detectAnomalies } from '@/lib/services/orchestrator-analytics-service-extended';
import {
  anomalyDetectionQuerySchema,
  createAnalyticsErrorResponse,
  ORCHESTRATOR_ANALYTICS_ERROR_CODES,
} from '@/lib/validations/orchestrator-analytics';

import type { AnomalyDetectionQueryInput } from '@/lib/validations/orchestrator-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
}

/**
 * Helper to verify workspace and Orchestrator access
 */
async function verifyVPAccess(workspaceId: string, orchestratorId: string, userId: string) {
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
  });

  if (!orgMembership) {
    return null;
  }

  const orchestrator = await prisma.vP.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { workspace, orchestrator };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/anomalies
 *
 * Detect Orchestrator performance anomalies using statistical analysis.
 * Returns list of detected anomalies with severity levels and suggested actions.
 *
 * Query Parameters:
 * - threshold: Standard deviation threshold for detection (1-5) - default: 2
 * - timeWindow: Time window for analysis (24h, 7d, 30d) - default: 7d
 * - minSeverity: Minimum severity to include (low, medium, high, critical) - default: low
 * - includeResolved: Include resolved anomalies (boolean) - default: false
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Detected anomalies with details and suggestions
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/anomalies?threshold=2&timeWindow=7d
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
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    // Validate IDs
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = anomalyDetectionQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query: AnomalyDetectionQueryInput = parseResult.data;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (query.timeWindow) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    // Detect anomalies
    const anomalies = await detectAnomalies(orchestratorId, query.threshold, startDate, endDate);

    // Filter by minimum severity
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const minSeverityLevel = severityOrder[query.minSeverity];

    const filteredAnomalies = anomalies.filter(
      (anomaly) => severityOrder[anomaly.severity] >= minSeverityLevel,
    );

    // Group anomalies by severity
    const anomaliesBySeverity = filteredAnomalies.reduce(
      (acc, anomaly) => {
        if (!acc[anomaly.severity]) {
          acc[anomaly.severity] = [];
        }
        acc[anomaly.severity].push(anomaly);
        return acc;
      },
      {} as Record<string, typeof filteredAnomalies>,
    );

    // Calculate overall health score
    let healthScore = 100;
    filteredAnomalies.forEach((anomaly) => {
      switch (anomaly.severity) {
        case 'critical':
          healthScore -= 25;
          break;
        case 'high':
          healthScore -= 15;
          break;
        case 'medium':
          healthScore -= 10;
          break;
        case 'low':
          healthScore -= 5;
          break;
      }
    });
    healthScore = Math.max(0, healthScore);

    // Build response
    const response = {
      orchestratorId,
      vpName: access.orchestrator.user.name,
      timeWindow: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: query.timeWindow,
      },
      detection: {
        threshold: query.threshold,
        minSeverity: query.minSeverity,
        totalAnomalies: filteredAnomalies.length,
        byType: Object.entries(
          filteredAnomalies.reduce(
            (acc, a) => {
              acc[a.anomalyType] = (acc[a.anomalyType] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        ).map(([type, count]) => ({ type, count })),
        bySeverity: {
          critical: anomaliesBySeverity.critical?.length || 0,
          high: anomaliesBySeverity.high?.length || 0,
          medium: anomaliesBySeverity.medium?.length || 0,
          low: anomaliesBySeverity.low?.length || 0,
        },
      },
      healthScore,
      healthStatus:
        healthScore >= 80
          ? 'healthy'
          : healthScore >= 60
            ? 'warning'
            : healthScore >= 40
              ? 'degraded'
              : 'critical',
      anomalies: filteredAnomalies.map((anomaly) => ({
        type: anomaly.anomalyType,
        severity: anomaly.severity,
        description: anomaly.description,
        metric: anomaly.metric,
        expected: Math.round(anomaly.expectedValue * 100) / 100,
        actual: Math.round(anomaly.actualValue * 100) / 100,
        deviation: Math.round(anomaly.deviation * 100) / 100,
        detectedAt: anomaly.detectedAt.toISOString(),
        suggestedAction: anomaly.suggestedAction,
      })),
      recommendations: [] as string[],
    };

    // Add overall recommendations
    if (response.healthScore < 60) {
      response.recommendations.push(
        'Immediate attention required - multiple performance issues detected',
      );
    }

    if (anomaliesBySeverity.critical && anomaliesBySeverity.critical.length > 0) {
      response.recommendations.push(
        'Critical issues detected - prioritize resolution of high-severity anomalies',
      );
    }

    const lowCompletionAnomaly = filteredAnomalies.find(
      (a) => a.anomalyType === 'low_completion_rate',
    );
    if (lowCompletionAnomaly) {
      response.recommendations.push(
        'Consider workload adjustment or additional training to improve completion rate',
      );
    }

    const highResponseTimeAnomaly = filteredAnomalies.find(
      (a) => a.anomalyType === 'high_response_time',
    );
    if (highResponseTimeAnomaly) {
      response.recommendations.push(
        'Review task complexity and consider breaking down large tasks',
      );
    }

    if (filteredAnomalies.length === 0) {
      response.recommendations.push('No significant anomalies detected - Orchestrator performing normally');
    }

    return NextResponse.json({
      data: response,
      message: 'Anomaly detection completed successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/anomalies] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
