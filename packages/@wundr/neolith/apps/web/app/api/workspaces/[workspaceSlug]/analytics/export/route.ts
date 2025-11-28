import {
  AnalyticsServiceImpl,
  redis,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
  type UsageMetrics,
} from '@neolith/core';
import { prisma, type Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/**
 * Export analytics data in various formats
 * GET - Export analytics with streaming support for large datasets
 * Query params:
 *   - format: 'csv' | 'json' (default: 'json')
 *   - from: ISO date string (start date)
 *   - to: ISO date string (end date)
 *   - metrics: comma-separated list of metrics to include (e.g., 'messages,users,channels')
 *   - stream: 'true' | 'false' (default: 'false') - enable streaming for large datasets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const format = (searchParams.get('format') || 'json') as 'csv' | 'json';
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const metricsParam = searchParams.get('metrics');
    const useStreaming = searchParams.get('stream') === 'true';

    // Parse metrics filter
    const metricsFilter = metricsParam?.split(',').filter(Boolean);

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    // Determine date range
    const endDate = toDate ? new Date(toDate) : new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 },
      );
    }

    // Get metrics data
    const metricsData = await analyticsService.getMetrics({
      workspaceId,
      period: 'custom',
      startDate,
      endDate,
      metrics: metricsFilter,
    });

    // Filter metrics if specified
    const filteredMetrics = filterMetrics(metricsData, metricsFilter);

    // Handle streaming for large datasets
    if (useStreaming && format === 'csv') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const csv = convertMetricsToCSV(filteredMetrics, startDate, endDate);
            controller.enqueue(encoder.encode(csv));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="analytics-${workspaceId}-${formatDateForFilename(startDate)}-to-${formatDateForFilename(endDate)}.csv"`,
          'Transfer-Encoding': 'chunked',
        },
      });
    }

    // For CSV format, convert to CSV string
    if (format === 'csv') {
      const csv = convertMetricsToCSV(filteredMetrics, startDate, endDate);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="analytics-${workspaceId}-${formatDateForFilename(startDate)}-to-${formatDateForFilename(endDate)}.csv"`,
        },
      });
    }

    // Default to JSON
    return NextResponse.json({
      workspaceId,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      metrics: filteredMetrics,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Create scheduled export configuration
 * POST - Set up recurring analytics exports
 * Body:
 *   - frequency: 'daily' | 'weekly' | 'monthly'
 *   - format: 'csv' | 'json'
 *   - metrics: string[] - metrics to include
 *   - recipients: string[] - email addresses to send exports to
 *   - enabled: boolean
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { frequency, format, metrics, recipients, enabled } = body;

    // Validate input
    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be: daily, weekly, or monthly' },
        { status: 400 },
      );
    }

    if (!format || !['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be: csv or json' },
        { status: 400 },
      );
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients must be a non-empty array of email addresses' },
        { status: 400 },
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email addresses: ${invalidEmails.join(', ')}` },
        { status: 400 },
      );
    }

    // Store scheduled export configuration in workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const currentSettings = workspace.settings as Record<string, unknown> || {};
    const scheduledExports = (currentSettings.scheduledExports as Record<string, unknown>[]) || [];

    // Create new scheduled export configuration
    const exportConfig = {
      id: `export_${Date.now()}`,
      frequency,
      format,
      metrics: metrics || ['messages', 'users', 'channels', 'files', 'vp'],
      recipients,
      enabled: enabled !== false,
      createdBy: session.user.id,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      nextRunAt: calculateNextRun(frequency),
    };

    // Update workspace settings
    const updatedSettings = {
      ...currentSettings,
      scheduledExports: [...scheduledExports, exportConfig],
    };

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      message: 'Scheduled export created successfully',
      export: exportConfig,
    }, { status: 201 });
  } catch (error) {
    console.error('Scheduled export creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create scheduled export',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Filter metrics based on requested categories
 */
function filterMetrics(
  metrics: UsageMetrics,
  filter?: string[],
): Partial<UsageMetrics> {
  if (!filter || filter.length === 0) {
    return metrics;
  }

  const filtered: Partial<UsageMetrics> = {};

  if (filter.includes('messages') && metrics.messages) {
    filtered.messages = metrics.messages;
  }
  if (filter.includes('users') && metrics.users) {
    filtered.users = metrics.users;
  }
  if (filter.includes('channels') && metrics.channels) {
    filtered.channels = metrics.channels;
  }
  if (filter.includes('files') && metrics.files) {
    filtered.files = metrics.files;
  }
  if (filter.includes('vp') && metrics.orchestrator) {
    filtered.orchestrator = metrics.orchestrator;
  }

  return filtered;
}

/**
 * Convert metrics to CSV format with enhanced metadata
 */
function convertMetricsToCSV(
  metrics: Partial<UsageMetrics>,
  startDate?: Date,
  endDate?: Date,
): string {
  const lines: string[] = [];

  // Add metadata header
  if (startDate && endDate) {
    lines.push('# Analytics Export');
    lines.push(`# Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('');
  }

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

  // Orchestrators
  if (metrics.orchestrator) {
    lines.push(`Orchestrators,Total,${metrics.orchestrator.totalOrchestrators}`);
    lines.push(`Orchestrators,Active,${metrics.orchestrator.activeOrchestrators}`);
    lines.push(`Orchestrators,Messages Sent,${metrics.orchestrator.messagesSent}`);
  }

  return lines.join('\n');
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();

  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      break;
  }

  return now.toISOString();
}
