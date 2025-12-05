/**
 * Export Data API Endpoint
 *
 * GET - Export workspace data
 */

import { prisma } from '@neolith/database';
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

import type { NextRequest } from 'next/server';

const exportRequestSchema = z.object({
  type: z.enum([
    'channels',
    'messages',
    'tasks',
    'files',
    'members',
    'vps',
    'workflows',
    'all',
  ]),
  format: z.enum(['json', 'csv']).default('json'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

interface ExportData {
  workspace?: unknown;
  channels?: unknown[];
  messages?: unknown[];
  tasks?: unknown[];
  members?: unknown[];
  orchestrators?: unknown[];
  workflows?: unknown[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

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

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can export data' },
        { status: 403 },
      );
    }

    // Build date filter
    const dateFilter =
      startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {};

    // Check if async export is needed
    const recordCount = await estimateRecordCount(
      workspaceId,
      type,
      dateFilter,
    );

    if (shouldUseAsyncExport(recordCount)) {
      // For large datasets, suggest using API pagination or streaming
      return NextResponse.json({
        async: true,
        estimatedRecords: recordCount,
        message: 'Dataset is too large for synchronous export. Consider using date filters to reduce the size.',
      });
    }

    // Perform synchronous export
    const exportData = await fetchExportData(workspaceId, type, dateFilter);
    const totalRecords = countRecords(exportData);

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
    console.error('Export error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}

async function estimateRecordCount(
  workspaceId: string,
  type: string,
  dateFilter: Record<string, unknown>,
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
    count += await prisma.orchestrator.count({
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

async function fetchExportData(
  workspaceId: string,
  type: string,
  dateFilter: Record<string, unknown>,
): Promise<ExportData> {
  const exportData: ExportData = {};
  const shouldExportAll = type === 'all';

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
      take: 10000,
    });
  }

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

  if (shouldExportAll || type === 'vps') {
    exportData.orchestrators = await prisma.orchestrator.findMany({
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

function convertExportToCSV(exportData: ExportData, type: string): string {
  const csvSections: string[] = [];

  if (type === 'channels' && exportData.channels) {
    csvSections.push('# Channels');
    csvSections.push(
      convertToCSV(
        flattenData(exportData.channels as Record<string, unknown>[]),
      ),
    );
  } else if (type === 'messages' && exportData.messages) {
    csvSections.push('# Messages');
    csvSections.push(
      convertToCSV(
        flattenData(exportData.messages as Record<string, unknown>[]),
      ),
    );
  } else if (type === 'tasks' && exportData.tasks) {
    csvSections.push('# Tasks');
    csvSections.push(
      convertToCSV(flattenData(exportData.tasks as Record<string, unknown>[])),
    );
  } else if (type === 'members' && exportData.members) {
    csvSections.push('# Members');
    csvSections.push(
      convertToCSV(flattenData(exportData.members as Record<string, unknown>[])),
    );
  } else if (type === 'vps' && exportData.orchestrators) {
    csvSections.push('# VPs');
    csvSections.push(
      convertToCSV(
        flattenData(exportData.orchestrators as Record<string, unknown>[]),
      ),
    );
  } else if (type === 'workflows' && exportData.workflows) {
    csvSections.push('# Workflows');
    csvSections.push(
      convertToCSV(
        flattenData(exportData.workflows as Record<string, unknown>[]),
      ),
    );
  } else if (type === 'all') {
    if (exportData.channels?.length) {
      csvSections.push('# Channels');
      csvSections.push(
        convertToCSV(
          flattenData(exportData.channels as Record<string, unknown>[]),
        ),
      );
      csvSections.push('');
    }
    if (exportData.messages?.length) {
      csvSections.push('# Messages');
      csvSections.push(
        convertToCSV(
          flattenData(exportData.messages as Record<string, unknown>[]),
        ),
      );
      csvSections.push('');
    }
    if (exportData.tasks?.length) {
      csvSections.push('# Tasks');
      csvSections.push(
        convertToCSV(flattenData(exportData.tasks as Record<string, unknown>[])),
      );
      csvSections.push('');
    }
    if (exportData.members?.length) {
      csvSections.push('# Members');
      csvSections.push(
        convertToCSV(
          flattenData(exportData.members as Record<string, unknown>[]),
        ),
      );
      csvSections.push('');
    }
    if (exportData.orchestrators?.length) {
      csvSections.push('# VPs');
      csvSections.push(
        convertToCSV(
          flattenData(exportData.orchestrators as Record<string, unknown>[]),
        ),
      );
      csvSections.push('');
    }
    if (exportData.workflows?.length) {
      csvSections.push('# Workflows');
      csvSections.push(
        convertToCSV(
          flattenData(exportData.workflows as Record<string, unknown>[]),
        ),
      );
    }
  }

  return csvSections.join('\n');
}

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
