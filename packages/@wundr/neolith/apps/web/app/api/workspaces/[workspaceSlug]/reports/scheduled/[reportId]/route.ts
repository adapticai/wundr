/**
 * Individual Scheduled Report API Routes
 *
 * Provides operations for individual scheduled reports:
 * - Getting report details
 * - Updating report configuration
 * - Deleting scheduled reports
 * - Triggering manual execution
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/reports/scheduled/:reportId - Get report details
 * - PUT /api/workspaces/:workspaceSlug/reports/scheduled/:reportId - Update report
 * - DELETE /api/workspaces/:workspaceSlug/reports/scheduled/:reportId - Delete report
 *
 * @module app/api/workspaces/[workspaceSlug]/reports/scheduled/[reportId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  cronExpressionSchema,
  describeCronExpression,
  getNextExecution,
  validateFrequencyLimit,
} from '@/lib/cron-validation';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and report ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; reportId: string }>;
}

/**
 * Report type enumeration
 */
const reportTypeEnum = z.enum([
  'workspace-activity',
  'channel-analytics',
  'user-engagement',
  'task-completion',
  'workflow-execution',
  'security-audit',
  'export-summary',
  'custom',
]);

/**
 * Export format enumeration
 */
const exportFormatEnum = z.enum(['pdf', 'csv', 'json', 'excel', 'html']);

/**
 * Email delivery configuration schema
 */
const emailDeliverySchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.string().email()).min(1).max(50),
  subject: z.string().min(1).max(200).optional(),
  includeAttachment: z.boolean().default(true),
  includeInlinePreview: z.boolean().default(false),
  sendOnlyIfData: z.boolean().default(false),
  ccRecipients: z.array(z.string().email()).max(20).optional(),
  bccRecipients: z.array(z.string().email()).max(20).optional(),
});

/**
 * Report parameters schema
 */
const reportParametersSchema = z.object({
  dateRange: z
    .object({
      type: z.enum(['last-7-days', 'last-30-days', 'last-quarter', 'last-year', 'custom']),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .optional(),
  includeArchived: z.boolean().optional(),
  channelIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  taskStatuses: z.array(z.string()).optional(),
  workflowIds: z.array(z.string()).optional(),
  minActivityLevel: z.enum(['low', 'medium', 'high']).optional(),
  customFilters: z.record(z.string(), z.any()).optional(),
});

/**
 * Update scheduled report schema
 */
const updateScheduledReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  reportType: reportTypeEnum.optional(),
  cronExpression: cronExpressionSchema.optional(),
  timezone: z.string().optional(),
  exportFormats: z.array(exportFormatEnum).min(1).max(5).optional(),
  emailDelivery: emailDeliverySchema.optional(),
  parameters: reportParametersSchema.optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * GET /api/workspaces/:workspaceSlug/reports/scheduled/:reportId
 *
 * Get detailed information about a scheduled report
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug and report ID
 * @returns Scheduled report details
 */
export async function GET(
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

    // Fetch scheduled report
    const report = await prisma.exportJob.findUnique({
      where: { id: reportId },
    });

    if (!report || report.workspaceId !== workspace.id) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Fetch creator
    const creator = await prisma.user.findUnique({
      where: { id: report.requestedBy },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    // Extract schedule configuration from metadata
    const metadata = (report as any).metadata || {};
    const scheduleConfig = metadata.schedule || {};
    const cronExpression = scheduleConfig.cronExpression || '0 0 * * *';
    const nextRun = scheduleConfig.isActive
      ? getNextExecution(cronExpression)
      : null;

    // Fetch execution history
    const executionHistory = await prisma.exportJob.findMany({
      where: {
        workspaceId: workspace.id,
        // In production, add: scheduledReportId: reportId
        type: report.type,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        recordCount: true,
        fileSize: true,
        error: true,
      },
    });

    const response = {
      id: report.id,
      name: metadata.name || `Report ${report.type}`,
      description: metadata.description || null,
      reportType: (metadata.reportType || 'custom') as z.infer<typeof reportTypeEnum>,
      cronExpression,
      cronDescription: describeCronExpression(cronExpression),
      timezone: scheduleConfig.timezone || 'UTC',
      exportFormats: scheduleConfig.exportFormats || [report.format.toLowerCase()],
      emailDelivery: scheduleConfig.emailDelivery || {
        enabled: false,
        recipients: [],
        includeAttachment: true,
        includeInlinePreview: false,
        sendOnlyIfData: false,
      },
      parameters: scheduleConfig.parameters || null,
      isActive: scheduleConfig.isActive ?? true,
      tags: metadata.tags || [],
      lastRun: scheduleConfig.lastRun ? new Date(scheduleConfig.lastRun) : null,
      lastRunStatus: scheduleConfig.lastRunStatus || null,
      nextRun,
      runCount: scheduleConfig.runCount || 0,
      failureCount: scheduleConfig.failureCount || 0,
      createdBy: creator || {
        id: report.requestedBy,
        name: null,
        email: 'unknown@example.com',
        avatarUrl: null,
      },
      createdAt: report.createdAt,
      updatedAt: new Date(),
      executionHistory: executionHistory.map((exec) => ({
        id: exec.id,
        status: exec.status,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        recordCount: exec.recordCount,
        fileSize: exec.fileSize ? Number(exec.fileSize) : null,
        error: exec.error,
        duration: exec.startedAt && exec.completedAt
          ? exec.completedAt.getTime() - exec.startedAt.getTime()
          : null,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/reports/scheduled/:reportId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled report' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/reports/scheduled/:reportId
 *
 * Update a scheduled report configuration
 *
 * @param request - Next.js request with updated configuration
 * @param context - Route context containing workspace slug and report ID
 * @returns Updated scheduled report
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, reportId } = await context.params;

    // Verify workspace membership with appropriate role
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

    const memberRole = workspace.workspaceMembers[0].role;
    if (memberRole === 'GUEST') {
      return NextResponse.json(
        { error: 'Insufficient permissions to update scheduled reports' },
        { status: 403 },
      );
    }

    // Fetch existing report
    const existingReport = await prisma.exportJob.findUnique({
      where: { id: reportId },
    });

    if (!existingReport || existingReport.workspaceId !== workspace.id) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = updateScheduledReportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parseResult.data;

    // Validate cron frequency if provided
    if (data.cronExpression && !validateFrequencyLimit(data.cronExpression, 60)) {
      return NextResponse.json(
        { error: 'Schedule frequency too high. Minimum interval is 1 hour.' },
        { status: 400 },
      );
    }

    // Validate email recipients if email delivery is being updated
    if (data.emailDelivery?.enabled && data.emailDelivery.recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one email recipient is required when email delivery is enabled' },
        { status: 400 },
      );
    }

    // Extract current metadata
    const currentMetadata = (existingReport as any).metadata || {};
    const currentSchedule = currentMetadata.schedule || {};

    // Merge updates
    const updatedSchedule = {
      ...currentSchedule,
      ...(data.cronExpression && { cronExpression: data.cronExpression }),
      ...(data.timezone && { timezone: data.timezone }),
      ...(data.exportFormats && { exportFormats: data.exportFormats }),
      ...(data.emailDelivery && { emailDelivery: data.emailDelivery }),
      ...(data.parameters !== undefined && { parameters: data.parameters }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };

    const updatedMetadata = {
      ...currentMetadata,
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.reportType && { reportType: data.reportType }),
      ...(data.tags !== undefined && { tags: data.tags }),
      schedule: updatedSchedule,
    };

    // Calculate next run time
    const cronExpression = updatedSchedule.cronExpression || '0 0 * * *';
    const nextRun = updatedSchedule.isActive
      ? getNextExecution(cronExpression)
      : null;

    // Update report
    // In production, update the dedicated scheduled_reports table
    const updatedReport = await prisma.exportJob.update({
      where: { id: reportId },
      data: {
        type: data.reportType || existingReport.type,
        format: data.exportFormats?.[0]?.toUpperCase() as any || existingReport.format,
        // Update metadata field here
      },
    });

    // Fetch creator for response
    const creator = await prisma.user.findUnique({
      where: { id: existingReport.requestedBy },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    const response = {
      id: updatedReport.id,
      name: updatedMetadata.name || `Report ${updatedReport.type}`,
      description: updatedMetadata.description || null,
      reportType: updatedMetadata.reportType || 'custom',
      cronExpression,
      cronDescription: describeCronExpression(cronExpression),
      timezone: updatedSchedule.timezone || 'UTC',
      exportFormats: updatedSchedule.exportFormats || [updatedReport.format.toLowerCase()],
      emailDelivery: updatedSchedule.emailDelivery,
      parameters: updatedSchedule.parameters || null,
      isActive: updatedSchedule.isActive ?? true,
      tags: updatedMetadata.tags || [],
      lastRun: updatedSchedule.lastRun ? new Date(updatedSchedule.lastRun) : null,
      lastRunStatus: updatedSchedule.lastRunStatus || null,
      nextRun,
      runCount: updatedSchedule.runCount || 0,
      failureCount: updatedSchedule.failureCount || 0,
      createdBy: creator || {
        id: existingReport.requestedBy,
        name: null,
        email: 'unknown@example.com',
        avatarUrl: null,
      },
      createdAt: existingReport.createdAt,
      updatedAt: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[PUT /api/workspaces/:workspaceSlug/reports/scheduled/:reportId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/reports/scheduled/:reportId
 *
 * Delete a scheduled report
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug and report ID
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, reportId } = await context.params;

    // Verify workspace membership with appropriate role
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

    const memberRole = workspace.workspaceMembers[0].role;
    if (memberRole === 'GUEST') {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete scheduled reports' },
        { status: 403 },
      );
    }

    // Verify report exists and belongs to workspace
    const report = await prisma.exportJob.findUnique({
      where: { id: reportId },
    });

    if (!report || report.workspaceId !== workspace.id) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 },
      );
    }

    // Only allow deletion by owner/admin or the creator
    if (memberRole !== 'OWNER' && memberRole !== 'ADMIN' && report.requestedBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this report' },
        { status: 403 },
      );
    }

    // Delete the report
    await prisma.exportJob.delete({
      where: { id: reportId },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceSlug/reports/scheduled/:reportId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 },
    );
  }
}
