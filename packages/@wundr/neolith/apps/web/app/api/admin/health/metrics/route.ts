/**
 * Health Dashboard - Metrics API
 *
 * GET /api/admin/health/metrics - Time series metrics for dashboard charts
 *
 * Query Parameters:
 * - timeRange: Time range for metrics (1h, 24h, 7d, 30d) - default: 24h
 * - orchestratorId: Optional filter by specific orchestrator
 *
 * Returns:
 * - Session count over time
 * - Token usage over time
 * - Latency percentiles (p50, p95, p99)
 * - Error count over time
 *
 * @module app/api/admin/health/metrics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

interface TimeSeriesMetric {
  timestamp: string;
  value: number;
}

interface LatencyMetrics {
  p50: TimeSeriesMetric[];
  p95: TimeSeriesMetric[];
  p99: TimeSeriesMetric[];
}

interface MetricsChartData {
  sessions: TimeSeriesMetric[];
  tokens: TimeSeriesMetric[];
  latency: LatencyMetrics;
  errors: TimeSeriesMetric[];
}

type TimeRange = '1h' | '24h' | '7d' | '30d';

/**
 * Calculate time window and interval based on time range
 */
function getTimeConfig(timeRange: TimeRange): {
  startTime: Date;
  intervalMinutes: number;
  dataPoints: number;
} {
  const now = new Date();
  const configs = {
    '1h': { hours: 1, intervalMinutes: 5, dataPoints: 12 },
    '24h': { hours: 24, intervalMinutes: 60, dataPoints: 24 },
    '7d': { hours: 24 * 7, intervalMinutes: 360, dataPoints: 28 },
    '30d': { hours: 24 * 30, intervalMinutes: 1440, dataPoints: 30 },
  };

  const config = configs[timeRange];
  const startTime = new Date(now.getTime() - config.hours * 60 * 60 * 1000);

  return {
    startTime,
    intervalMinutes: config.intervalMinutes,
    dataPoints: config.dataPoints,
  };
}

/**
 * Group data into time buckets
 */
function groupByTimeBuckets<T extends { createdAt: Date }>(
  data: T[],
  startTime: Date,
  intervalMinutes: number,
  dataPoints: number,
  valueExtractor: (items: T[]) => number
): TimeSeriesMetric[] {
  const intervalMs = intervalMinutes * 60 * 1000;
  const buckets: Map<number, T[]> = new Map();

  // Initialize all buckets
  for (let i = 0; i < dataPoints; i++) {
    const bucketTime = startTime.getTime() + i * intervalMs;
    buckets.set(bucketTime, []);
  }

  // Assign data to buckets
  data.forEach(item => {
    const itemTime = item.createdAt.getTime();
    const bucketIndex = Math.floor(
      (itemTime - startTime.getTime()) / intervalMs
    );
    const bucketTime = startTime.getTime() + bucketIndex * intervalMs;

    if (buckets.has(bucketTime)) {
      buckets.get(bucketTime)!.push(item);
    }
  });

  // Convert to time series
  return Array.from(buckets.entries())
    .map(([timestamp, items]) => ({
      timestamp: new Date(timestamp).toISOString(),
      value: valueExtractor(items),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Calculate percentile from sorted array
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * GET /api/admin/health/metrics
 *
 * Returns time series metrics for dashboard visualization.
 * Data is aggregated into time buckets based on the requested time range.
 *
 * Requires admin authentication.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user and check admin role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin in any organization
    const adminMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('timeRange') || '24h') as TimeRange;
    const orchestratorId = searchParams.get('orchestratorId');

    // Validate time range
    if (!['1h', '24h', '7d', '30d'].includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid timeRange. Must be one of: 1h, 24h, 7d, 30d' },
        { status: 400 }
      );
    }

    // Get time configuration
    const { startTime, intervalMinutes, dataPoints } = getTimeConfig(timeRange);

    // Build base where clause
    const baseWhere = {
      createdAt: { gte: startTime },
      ...(orchestratorId && { orchestratorId }),
    };

    // Fetch all data in parallel
    const [sessionManagers, tokenUsageRecords, auditLogs] = await Promise.all([
      // Session data
      prisma.sessionManager.findMany({
        where: {
          createdAt: { gte: startTime },
          ...(orchestratorId && { orchestratorId }),
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
        },
      }),

      // Token usage data
      prisma.tokenUsage.findMany({
        where: baseWhere,
        select: {
          createdAt: true,
          totalTokens: true,
        },
      }),

      // Audit logs for errors
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: startTime },
          ...(orchestratorId && {
            actorId: orchestratorId,
            actorType: 'orchestrator',
          }),
        },
        select: {
          createdAt: true,
          severity: true,
          metadata: true,
        },
      }),
    ]);

    // Group sessions by time buckets (count active sessions)
    const sessions = groupByTimeBuckets(
      sessionManagers,
      startTime,
      intervalMinutes,
      dataPoints,
      items => items.filter(s => s.status === 'ACTIVE').length
    );

    // Group token usage by time buckets (sum tokens)
    const tokens = groupByTimeBuckets(
      tokenUsageRecords,
      startTime,
      intervalMinutes,
      dataPoints,
      items => items.reduce((sum, item) => sum + item.totalTokens, 0)
    );

    // Group errors by time buckets
    const errors = groupByTimeBuckets(
      auditLogs,
      startTime,
      intervalMinutes,
      dataPoints,
      items =>
        items.filter(log => ['error', 'critical'].includes(log.severity)).length
    );

    // Calculate latency metrics (extract from audit log metadata if available)
    // For now, return placeholder data as response time tracking is not yet implemented
    const latency: LatencyMetrics = {
      p50: Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(
          startTime.getTime() + i * intervalMinutes * 60 * 1000
        ).toISOString(),
        value: 0,
      })),
      p95: Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(
          startTime.getTime() + i * intervalMinutes * 60 * 1000
        ).toISOString(),
        value: 0,
      })),
      p99: Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(
          startTime.getTime() + i * intervalMinutes * 60 * 1000
        ).toISOString(),
        value: 0,
      })),
    };

    // TODO: Implement actual latency tracking in audit logs
    // Extract response times from audit log metadata and calculate percentiles

    const metricsData: MetricsChartData = {
      sessions,
      tokens,
      latency,
      errors,
    };

    return NextResponse.json({ data: metricsData });
  } catch (error) {
    console.error('[GET /api/admin/health/metrics] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
