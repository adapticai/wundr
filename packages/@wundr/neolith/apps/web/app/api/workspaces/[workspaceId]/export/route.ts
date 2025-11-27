/**
 * Workspace Export API Endpoint
 *
 * Provides both synchronous and asynchronous export of workspace data.
 * Supports JSON and CSV formats with date filtering.
 *
 * GET /api/workspaces/[workspaceId]/export
 *   - Query synchronous export (small datasets)
 *   - Query params: type, format, startDate, endDate
 *
 * POST /api/workspaces/[workspaceId]/export
 *   - Request export (creates async job for large datasets)
 *   - Returns job ID for status polling
 *
 * Note: Large exports (>10k records) automatically use async processing.
 */

import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  convertToCSV,
  flattenData,
  generateExportFilename,
  getExportContentType,
  shouldUseAsyncExport,
} from '@/lib/export-utils';

/**
 * Zod schema for export request validation
 */
const exportRequestSchema = z.object({
  type: z.enum([
    'channels',
    'messages',
    'tasks',
    'files',
    'members',
    'vps',
    'workflows',
    'all'
  ]),
  format: z.enum(['json', 'csv']).default('json'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Export data structure
 */
interface ExportData {
  workspace?: unknown;
  channels?: unknown[];
  messages?: unknown[];
  tasks?: unknown[];
  members?: unknown[];
  orchestrators?: unknown[];
  workflows?: unknown[];
}

/**
 * GET - Synchronous export of workspace data
 *
 * Returns exported data directly in response or job ID if async.
 * Query params:
 *   - type: Data type to export (channels, messages, tasks, etc.)
 *   - format: Export format (json, csv)
 *   - startDate: Optional ISO datetime filter
 *   - endDate: Optional ISO datetime filter
 *
 * @returns Exported data or job reference
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const queryData = {
      type: searchParams.get('type') || 'all',
      format: searchParams.get('format') || 'json',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const validated = exportRequestSchema.parse(queryData);
    const { type, format, startDate, endDate } = validated;

    // Verify workspace access and admin permissions
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Only ADMIN and OWNER can export workspace data
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can export data' },
        { status: 403 },
      );
    }

    // Build date filter if provided
    const dateFilter = (startDate || endDate) ? {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    } : {};

    // First, check total record count to determine if async is needed
    const recordCount = await estimateRecordCount(workspaceId, type, dateFilter);

    // If dataset is large, create async job instead
    if (shouldUseAsyncExport(recordCount)) {
      const job = await prisma.exportJob.create({
        data: {
          workspaceId,
          type,
          format: format.toUpperCase() as 'JSON' | 'CSV',
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          requestedBy: session.user.id,
        },
      });

      return NextResponse.json({
        async: true,
        jobId: job.id,
        status: 'PENDING',
        estimatedRecords: recordCount,
        message: 'Export job created. Use GET /api/workspaces/{workspaceId}/export/jobs/{jobId} to check status.',
      });
    }

    // Perform synchronous export for small datasets
    const exportData = await fetchExportData(workspaceId, type, dateFilter);
    const totalRecords = countRecords(exportData);

    // Format data based on requested format
    if (format === 'csv') {
      const csvData = convertExportToCSV(exportData, type);
      const filename = generateExportFilename(workspaceId, type, 'csv');

      return new NextResponse(csvData, {
        headers: {
          'Content-Type': getExportContentType('csv'),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Total-Records': String(totalRecords),
        },
      });
    }

    // Return JSON format
    const response = {
      workspaceId,
      exportedAt: new Date().toISOString(),
      type,
      data: exportData,
      metadata: {
        totalRecords,
        format,
        dateRange: {
          from: startDate,
          to: endDate,
        },
      },
    };

    const filename = generateExportFilename(workspaceId, type, 'json');

    return new NextResponse(JSON.stringify(response, null, 2), {
      headers: {
        'Content-Type': getExportContentType('json'),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Records': String(totalRecords),
      },
    });
  } catch (error) {
    console.error('Workspace export error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to export workspace data' },
      { status: 500 },
    );
  }
}

/**
 * POST - Create export job (for backward compatibility)
 *
 * Creates an export job and returns job ID for status polling.
 * Body:
 *   - type: Data type to export
 *   - format: Export format (json, csv)
 *   - startDate: Optional ISO datetime filter
 *   - endDate: Optional ISO datetime filter
 *
 * @returns Export job details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse<{ data?: unknown, error?: string, async?: boolean, jobId?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;

    // Verify workspace access and admin permissions
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Only ADMIN and OWNER can export workspace data
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can export data' },
        { status: 403 },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const validated = exportRequestSchema.parse(body);
    const { type, format, startDate, endDate } = validated;

    // Create export job
    const job = await prisma.exportJob.create({
      data: {
        workspaceId,
        type,
        format: format.toUpperCase() as 'JSON' | 'CSV',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        requestedBy: session.user.id,
      },
    });

    return NextResponse.json({
      async: true,
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      message: 'Export job created. Use GET /api/workspaces/{workspaceId}/export/jobs/{jobId} to check status.',
    });
  } catch (error) {
    console.error('Export job creation error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create export job' },
      { status: 500 },
    );
  }
}

/**
 * Estimate total record count for export
 */
async function estimateRecordCount(
  workspaceId: string,
  type: string,
  dateFilter: Record<string, unknown>
): Promise<number> {
  let count = 0;

  if (type === 'all' || type === 'channels') {
    count += await prisma.channel.count({
      where: { workspaceId, ...dateFilter },
    });
  }

  if (type === 'all' || type === 'messages') {
    count += await prisma.message.count({
      where: { channel: { workspaceId }, ...dateFilter },
    });
  }

  if (type === 'all' || type === 'tasks') {
    count += await prisma.task.count({
      where: { workspaceId, ...dateFilter },
    });
  }

  if (type === 'all' || type === 'members') {
    count += await prisma.workspaceMember.count({
      where: { workspaceId },
    });
  }

  if (type === 'all' || type === 'vps') {
    count += await prisma.vP.count({
      where: { workspaceId, ...dateFilter },
    });
  }

  if (type === 'all' || type === 'workflows') {
    count += await prisma.workflow.count({
      where: { workspaceId, ...dateFilter },
    });
  }

  return count;
}

/**
 * Fetch export data from database
 */
async function fetchExportData(
  workspaceId: string,
  type: string,
  dateFilter: Record<string, unknown>
): Promise<ExportData> {
  const exportData: ExportData = {};
  const shouldExportAll = type === 'all';

  // Export workspace info
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  exportData.workspace = workspace;

  // Export channels
  if (shouldExportAll || type === 'channels') {
    exportData.channels = await prisma.channel.findMany({
      where: { workspaceId, ...dateFilter },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        type: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Export messages
  if (shouldExportAll || type === 'messages') {
    exportData.messages = await prisma.message.findMany({
      where: { channel: { workspaceId }, ...dateFilter },
      select: {
        id: true,
        content: true,
        type: true,
        channelId: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10000, // Limit for safety
    });
  }

  // Export tasks
  if (shouldExportAll || type === 'tasks') {
    exportData.tasks = await prisma.task.findMany({
      where: { workspaceId, ...dateFilter },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        tags: true,
        createdById: true,
        assignedToId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Export members
  if (shouldExportAll || type === 'members') {
    exportData.members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        userId: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
  }

  // Export VPs
  if (shouldExportAll || type === 'vps') {
    exportData.orchestrators = await prisma.vP.findMany({
      where: { workspaceId, ...dateFilter },
      select: {
        id: true,
        discipline: true,
        role: true,
        status: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Export workflows
  if (shouldExportAll || type === 'workflows') {
    exportData.workflows = await prisma.workflow.findMany({
      where: { workspaceId, ...dateFilter },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        trigger: true,
        actions: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return exportData;
}

/**
 * Convert export data to CSV format
 */
function convertExportToCSV(exportData: ExportData, type: string): string {
  const csvSections: string[] = [];

  if (type === 'channels' && exportData.channels) {
    csvSections.push('# Channels');
    csvSections.push(convertToCSV(flattenData(exportData.channels as Record<string, unknown>[])));
  } else if (type === 'messages' && exportData.messages) {
    csvSections.push('# Messages');
    csvSections.push(convertToCSV(flattenData(exportData.messages as Record<string, unknown>[])));
  } else if (type === 'tasks' && exportData.tasks) {
    csvSections.push('# Tasks');
    csvSections.push(convertToCSV(flattenData(exportData.tasks as Record<string, unknown>[])));
  } else if (type === 'members' && exportData.members) {
    csvSections.push('# Members');
    csvSections.push(convertToCSV(flattenData(exportData.members as Record<string, unknown>[])));
  } else if (type === 'vps' && exportData.orchestrators) {
    csvSections.push('# VPs');
    csvSections.push(convertToCSV(flattenData(exportData.orchestrators as Record<string, unknown>[])));
  } else if (type === 'workflows' && exportData.workflows) {
    csvSections.push('# Workflows');
    csvSections.push(convertToCSV(flattenData(exportData.workflows as Record<string, unknown>[])));
  } else if (type === 'all') {
    // Export all sections
    if (exportData.channels?.length) {
      csvSections.push('# Channels');
      csvSections.push(convertToCSV(flattenData(exportData.channels as Record<string, unknown>[])));
      csvSections.push('');
    }
    if (exportData.messages?.length) {
      csvSections.push('# Messages');
      csvSections.push(convertToCSV(flattenData(exportData.messages as Record<string, unknown>[])));
      csvSections.push('');
    }
    if (exportData.tasks?.length) {
      csvSections.push('# Tasks');
      csvSections.push(convertToCSV(flattenData(exportData.tasks as Record<string, unknown>[])));
      csvSections.push('');
    }
    if (exportData.members?.length) {
      csvSections.push('# Members');
      csvSections.push(convertToCSV(flattenData(exportData.members as Record<string, unknown>[])));
      csvSections.push('');
    }
    if (exportData.orchestrators?.length) {
      csvSections.push('# VPs');
      csvSections.push(convertToCSV(flattenData(exportData.orchestrators as Record<string, unknown>[])));
      csvSections.push('');
    }
    if (exportData.workflows?.length) {
      csvSections.push('# Workflows');
      csvSections.push(convertToCSV(flattenData(exportData.workflows as Record<string, unknown>[])));
    }
  }

  return csvSections.join('\n');
}

/**
 * Count total records in export data
 */
function countRecords(exportData: ExportData): number {
  let count = 0;
  if (exportData.channels) count += exportData.channels.length;
  if (exportData.messages) count += exportData.messages.length;
  if (exportData.tasks) count += exportData.tasks.length;
  if (exportData.members) count += exportData.members.length;
  if (exportData.orchestrators) count += exportData.orchestrators.length;
  if (exportData.workflows) count += exportData.workflows.length;
  return count;
}
