import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AnalyticsService } from '@genesis/core';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { period, format, metrics } = body;

    const analyticsService = new AnalyticsService({ prisma, redis });

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

function convertMetricsToCSV(metrics: Record<string, unknown>): string {
  const lines: string[] = [];

  // Header
  lines.push('Category,Metric,Value');

  // Messages
  const messages = metrics.messages as Record<string, unknown>;
  if (messages) {
    lines.push(`Messages,Total,${messages.total}`);
    lines.push(`Messages,Average Per Day,${messages.averagePerDay}`);
    lines.push(`Messages,Threads Created,${messages.threadsCreated}`);
    lines.push(`Messages,Reactions Added,${messages.reactionsAdded}`);
  }

  // Users
  const users = metrics.users as Record<string, unknown>;
  if (users) {
    lines.push(`Users,Total Members,${users.totalMembers}`);
    lines.push(`Users,Active Users,${users.activeUsers}`);
    lines.push(`Users,New Users,${users.newUsers}`);
  }

  // Channels
  const channels = metrics.channels as Record<string, unknown>;
  if (channels) {
    lines.push(`Channels,Total,${channels.total}`);
    lines.push(`Channels,Public,${channels.public}`);
    lines.push(`Channels,Private,${channels.private}`);
    lines.push(`Channels,New Channels,${channels.newChannels}`);
  }

  // Files
  const files = metrics.files as Record<string, unknown>;
  if (files) {
    lines.push(`Files,Total Uploaded,${files.totalUploaded}`);
    lines.push(`Files,Total Size (bytes),${files.totalSize}`);
  }

  // VPs
  const vp = metrics.vp as Record<string, unknown>;
  if (vp) {
    lines.push(`VPs,Total,${vp.totalVPs}`);
    lines.push(`VPs,Active,${vp.activeVPs}`);
    lines.push(`VPs,Messages Sent,${vp.messagesSent}`);
  }

  return lines.join('\n');
}
