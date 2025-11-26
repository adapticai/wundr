/**
 * Workspace Export API Endpoint
 *
 * Provides synchronous export of workspace data.
 * Returns exported data directly in response.
 *
 * POST /api/workspaces/[workspaceId]/export
 *   - Initiates workspace data export
 *   - Returns exported data directly
 *
 * Note: For large exports, consider implementing a background job system.
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Zod schema for export request validation
 */
const exportRequestSchema = z.object({
  dataTypes: z.array(z.enum([
    'channels',
    'messages',
    'tasks',
    'files',
    'members',
    'vps',
    'workflows',
    'all'
  ])).min(1),
  format: z.enum(['json', 'csv']).default('json'),
  includeMetadata: z.boolean().default(true),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Export response structure
 */
interface ExportResponse {
  workspaceId: string;
  exportedAt: string;
  dataTypes: string[];
  data: {
    workspace?: unknown;
    channels?: unknown[];
    messages?: unknown[];
    tasks?: unknown[];
    members?: unknown[];
    vps?: unknown[];
    workflows?: unknown[];
  };
  metadata: {
    totalRecords: number;
    format: string;
  };
}

/**
 * POST - Export workspace data
 *
 * Exports workspace data synchronously and returns it directly.
 * For large datasets, consider implementing background job processing.
 *
 * Body:
 *   - dataTypes: Array of data types to export
 *   - format: Export format (json, csv)
 *   - includeMetadata: Include metadata in export
 *   - dateRange: Optional date range filter
 *
 * @returns Exported workspace data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse<{ data: ExportResponse } | { error: string }>> {
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
    const { dataTypes, format, includeMetadata, dateRange } = validated;

    // Build date filter if provided
    const dateFilter = dateRange ? {
      createdAt: {
        ...(dateRange.from ? { gte: new Date(dateRange.from) } : {}),
        ...(dateRange.to ? { lte: new Date(dateRange.to) } : {}),
      },
    } : {};

    // Determine what to export
    const shouldExportAll = dataTypes.includes('all');
    const exportData: ExportResponse['data'] = {};
    let totalRecords = 0;

    // Export workspace info if metadata is included
    if (includeMetadata) {
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
    }

    // Export channels
    if (shouldExportAll || dataTypes.includes('channels')) {
      const channels = await prisma.channel.findMany({
        where: {
          workspaceId,
          ...dateFilter,
        },
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
      exportData.channels = channels;
      totalRecords += channels.length;
    }

    // Export messages
    if (shouldExportAll || dataTypes.includes('messages')) {
      const messages = await prisma.message.findMany({
        where: {
          channel: { workspaceId },
          ...dateFilter,
        },
        select: {
          id: true,
          content: true,
          type: true,
          channelId: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 10000, // Limit to prevent huge exports
      });
      exportData.messages = messages;
      totalRecords += messages.length;
    }

    // Export tasks
    if (shouldExportAll || dataTypes.includes('tasks')) {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId,
          ...dateFilter,
        },
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
      exportData.tasks = tasks;
      totalRecords += tasks.length;
    }

    // Export members
    if (shouldExportAll || dataTypes.includes('members')) {
      const members = await prisma.workspaceMember.findMany({
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
      exportData.members = members;
      totalRecords += members.length;
    }

    // Export VPs
    if (shouldExportAll || dataTypes.includes('vps')) {
      const vps = await prisma.vP.findMany({
        where: {
          workspaceId,
          ...dateFilter,
        },
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
      exportData.vps = vps;
      totalRecords += vps.length;
    }

    // Export workflows
    if (shouldExportAll || dataTypes.includes('workflows')) {
      const workflows = await prisma.workflow.findMany({
        where: {
          workspaceId,
          ...dateFilter,
        },
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
      exportData.workflows = workflows;
      totalRecords += workflows.length;
    }

    const response: ExportResponse = {
      workspaceId,
      exportedAt: new Date().toISOString(),
      dataTypes: dataTypes,
      data: exportData,
      metadata: {
        totalRecords,
        format,
      },
    };

    return NextResponse.json({ data: response });
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

