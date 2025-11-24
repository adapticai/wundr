import {
  AnalyticsServiceImpl,
  redis,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
  type UsageMetrics,
} from '@genesis/core';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { getServerSession } from '@/lib/auth';

import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { period, format, metrics } = body;

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    // Get metrics data
    const metricsData = await analyticsService.getMetrics({
      workspaceId,
      period: period || 'month',
      metrics,
    });

    // For CSV format, convert to CSV string
    if (format === 'csv') {
      const csv = convertMetricsToCSV(metricsData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${workspaceId}-${Date.now()}.csv"`,
        },
      });
    }

    // Default to JSON
    return NextResponse.json(metricsData);
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 });
  }
}

function convertMetricsToCSV(metrics: UsageMetrics): string {
  const lines: string[] = [];

  // Header
  lines.push('Category,Metric,Value');

  // Messages
  if (metrics.messages) {
    lines.push(`Messages,Total,${metrics.messages.total}`);
    lines.push(`Messages,Average Per Day,${metrics.messages.averagePerDay}`);
    lines.push(`Messages,Threads Created,${metrics.messages.threadsCreated}`);
    lines.push(`Messages,Reactions Added,${metrics.messages.reactionsAdded}`);
  }

  // Users
  if (metrics.users) {
    lines.push(`Users,Total Members,${metrics.users.totalMembers}`);
    lines.push(`Users,Active Users,${metrics.users.activeUsers}`);
    lines.push(`Users,New Users,${metrics.users.newUsers}`);
  }

  // Channels
  if (metrics.channels) {
    lines.push(`Channels,Total,${metrics.channels.total}`);
    lines.push(`Channels,Public,${metrics.channels.public}`);
    lines.push(`Channels,Private,${metrics.channels.private}`);
    lines.push(`Channels,New Channels,${metrics.channels.newChannels}`);
  }

  // Files
  if (metrics.files) {
    lines.push(`Files,Total Uploaded,${metrics.files.totalUploaded}`);
    lines.push(`Files,Total Size (bytes),${metrics.files.totalSize}`);
  }

  // VPs
  if (metrics.vp) {
    lines.push(`VPs,Total,${metrics.vp.totalVPs}`);
    lines.push(`VPs,Active,${metrics.vp.activeVPs}`);
    lines.push(`VPs,Messages Sent,${metrics.vp.messagesSent}`);
  }

  return lines.join('\n');
}
