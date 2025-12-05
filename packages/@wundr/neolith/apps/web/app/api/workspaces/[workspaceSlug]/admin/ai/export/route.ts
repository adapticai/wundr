/**
 * AI Usage Export API Route
 *
 * Exports AI usage reports in CSV or JSON format.
 * Includes detailed usage data, costs, and user breakdowns.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/ai/export?format=csv
 * - GET /api/workspaces/:workspaceSlug/admin/ai/export?format=json
 *
 * Authorization: Requires ADMIN or OWNER role
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/ai/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace admin access
 */
async function checkAdminAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    select: { id: true, slug: true, name: true },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace.id,
      userId,
    },
    select: { role: true },
  });

  if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
    return null;
  }

  return workspace;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers
      .map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/ai/export
 *
 * Export AI usage data
 *
 * @param request - Request with format query param
 * @param context - Route context with workspace slug
 * @returns CSV or JSON file
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // 2. Get workspace slug and format
    const { workspaceSlug } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid format. Must be csv or json',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // 3. Check admin access
    const workspace = await checkAdminAccess(workspaceSlug, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // 4. Get all token usage for workspace
    const orchestrators = await prisma.orchestrator.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, userId: true },
    });

    const orchestratorIds = orchestrators.map(o => o.id);
    const userIds = [
      ...new Set(orchestrators.map(o => o.userId).filter(Boolean)),
    ];

    // Get user details separately
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const tokenUsage = await prisma.tokenUsage.findMany({
      where: { orchestratorId: { in: orchestratorIds } },
      orderBy: { createdAt: 'desc' },
    });

    // 5. Format data for export
    const exportData = tokenUsage.map(usage => {
      const orchestrator = orchestrators.find(
        o => o.id === usage.orchestratorId
      );
      const user = orchestrator?.userId
        ? userMap.get(orchestrator.userId)
        : null;
      return {
        date: usage.createdAt.toISOString(),
        orchestrator: `Orchestrator ${usage.orchestratorId.slice(0, 8)}`,
        user: user?.name || user?.email || 'Unknown',
        userEmail: user?.email || 'unknown@example.com',
        model: usage.model,
        sessionId: usage.sessionId || '',
        taskType: usage.taskType || '',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cost: Number(usage.cost || 0),
      };
    });

    // 6. Add summary data
    const summary = {
      workspace: workspace.name,
      exportDate: new Date().toISOString(),
      totalRecords: exportData.length,
      totalTokens: exportData.reduce((sum, d) => sum + d.totalTokens, 0),
      totalCost: exportData.reduce((sum, d) => sum + d.cost, 0),
      dateRange: {
        from: exportData[exportData.length - 1]?.date || '',
        to: exportData[0]?.date || '',
      },
    };

    // 7. Return in requested format
    if (format === 'json') {
      return NextResponse.json(
        {
          summary,
          data: exportData,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="ai-usage-${workspace.slug}-${new Date().toISOString().split('T')[0]}.json"`,
          },
        }
      );
    } else {
      // CSV format
      const csv = convertToCSV(exportData);
      const summaryCSV = [
        '# AI Usage Report',
        `# Workspace: ${workspace.name}`,
        `# Export Date: ${summary.exportDate}`,
        `# Total Records: ${summary.totalRecords}`,
        `# Total Tokens: ${summary.totalTokens}`,
        `# Total Cost: $${summary.totalCost.toFixed(2)}`,
        `# Date Range: ${summary.dateRange.from} to ${summary.dateRange.to}`,
        '',
        csv,
      ].join('\n');

      return new NextResponse(summaryCSV, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-usage-${workspace.slug}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/ai/export] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
