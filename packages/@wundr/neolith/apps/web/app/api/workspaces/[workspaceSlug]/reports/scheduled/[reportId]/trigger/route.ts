/**
 * Scheduled Report Manual Trigger API
 *
 * Provides endpoint to manually trigger a scheduled report execution
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/reports/scheduled/:reportId/trigger - Trigger report
 *
 * @module app/api/workspaces/[workspaceSlug]/reports/scheduled/[reportId]/trigger/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and report ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; reportId: string }>;
}

/**
 * POST /api/workspaces/:workspaceSlug/reports/scheduled/:reportId/trigger
 *
 * Manually trigger execution of a scheduled report
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug and report ID
 * @returns Execution job details
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, reportId } = await context.params;

    // Verify workspace membership
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      include: {
        workspaceMembers: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Verify report exists and belongs to workspace
    const scheduledReport = await prisma.exportJob.findUnique({
      where: { id: reportId },
    });

    if (!scheduledReport || scheduledReport.workspaceId !== workspace.id) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Check for concurrent executions
    const runningExecutions = await prisma.exportJob.count({
      where: {
        workspaceId: workspace.id,
        type: scheduledReport.type,
        status: 'PROCESSING',
      },
    });

    if (runningExecutions > 0) {
      return NextResponse.json(
        { error: 'A report of this type is already running. Please wait for it to complete.' },
        { status: 409 },
      );
    }

    // Extract schedule configuration
    const metadata = (scheduledReport as any).metadata || {};
    const scheduleConfig = metadata.schedule || {};

    // Create a new execution job
    const executionJob = await prisma.exportJob.create({
      data: {
        workspaceId: workspace.id,
        type: scheduledReport.type,
        format: scheduledReport.format,
        status: 'PENDING',
        requestedBy: session.user.id,
        progress: 0,
        // In production, add: scheduledReportId: reportId
        // In production, add: triggeredManually: true
      },
    });

    // Update scheduled report run count
    // In production, update the scheduled_reports table:
    // await prisma.scheduledReport.update({
    //   where: { id: reportId },
    //   data: {
    //     runCount: { increment: 1 },
    //     lastRun: new Date(),
    //   },
    // });

    // Here you would typically trigger a background job processor
    // For example, using Bull Queue, AWS SQS, or a similar job queue
    // Example:
    // await reportQueue.add('generate-report', {
    //   executionJobId: executionJob.id,
    //   scheduledReportId: reportId,
    //   parameters: scheduleConfig.parameters,
    //   emailDelivery: scheduleConfig.emailDelivery,
    // });

    return NextResponse.json({
      success: true,
      message: 'Report generation triggered successfully',
      executionJob: {
        id: executionJob.id,
        status: executionJob.status,
        progress: executionJob.progress,
        createdAt: executionJob.createdAt,
      },
    }, { status: 202 }); // 202 Accepted - request accepted for processing
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/reports/scheduled/:reportId/trigger] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger report execution' },
      { status: 500 },
    );
  }
}
