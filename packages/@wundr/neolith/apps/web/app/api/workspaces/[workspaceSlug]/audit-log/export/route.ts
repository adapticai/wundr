/**
 * Audit Log Export API Routes
 *
 * Handles export of audit logs to CSV format for compliance reporting.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/audit-log/export - Export audit logs
 *
 * @module app/api/workspaces/[workspaceSlug]/audit-log/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Convert an array of objects to CSV format
 */
function arrayToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV header row
  const headerRow = headers.map(h => `"${h}"`).join(',');

  // Create data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];

      // Handle different types
      if (value === null || value === undefined) {
        return '""';
      }
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * GET /api/workspaces/:workspaceSlug/audit-log/export
 *
 * Export audit log entries to CSV format.
 * Requires authenticated user with admin/owner workspace access.
 *
 * Query Parameters:
 * - format: Export format (default: 'csv')
 * - search: Search term for actions
 * - category: Filter by category
 * - severity: Filter by severity
 * - actorType: Filter by actor type
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace slug
 * @returns CSV file download
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Verify workspace access - must be admin or owner
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspace: { slug: workspaceSlug },
        userId: session.user.id,
      },
      include: {
        workspace: { select: { id: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Only allow admin/owner to export audit logs
    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        {
          error: 'Only admins and owners can export audit logs',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const actorType = searchParams.get('actorType') || undefined;
    const startDateStr = searchParams.get('startDate') || undefined;
    const endDateStr = searchParams.get('endDate') || undefined;

    // Validate date parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }
    }

    // Build where clause (same logic as GET endpoint)
    const where: {
      action?: { contains: string; mode: 'insensitive' };
      actorType?: string;
      severity?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (search) {
      where.action = { contains: search, mode: 'insensitive' };
    }

    if (category && category !== 'all') {
      const categoryPatterns: Record<string, string[]> = {
        user_management: ['user', 'member', 'role', 'invite'],
        settings: ['settings', 'config', 'workspace'],
        security: ['security', 'auth', 'permission', 'login'],
        data: ['data', 'export', 'delete', 'backup'],
      };

      const patterns = categoryPatterns[category];
      if (patterns) {
        where.action = { contains: patterns[0], mode: 'insensitive' };
      }
    }

    if (actorType && actorType !== 'all') {
      where.actorType = actorType;
    }

    if (severity && severity !== 'all') {
      where.severity = severity;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Fetch all matching logs (no pagination for export)
    // Limit to 10,000 records to prevent memory issues
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        id: true,
        createdAt: true,
        action: true,
        actorId: true,
        actorType: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ip: true,
        userAgent: true,
        severity: true,
      },
    });

    // Fetch actor details
    const userActorIds = logs
      .filter(log => log.actorType === 'user' || log.actorType === 'orchestrator')
      .map(log => log.actorId);

    const uniqueActorIds = [...new Set(userActorIds)];

    const actors = await prisma.user.findMany({
      where: { id: { in: uniqueActorIds } },
      select: { id: true, name: true, email: true },
    });

    const actorMap = new Map(actors.map(actor => [actor.id, actor]));

    // Transform to CSV-friendly format
    const csvData = logs.map(log => {
      const actor = actorMap.get(log.actorId);

      return {
        Timestamp: log.createdAt.toISOString(),
        Action: log.action,
        'Actor ID': log.actorId,
        'Actor Name': actor?.name || 'Unknown',
        'Actor Email': actor?.email || 'N/A',
        'Actor Type': log.actorType,
        'Resource Type': log.resourceType,
        'Resource ID': log.resourceId || 'N/A',
        Severity: log.severity,
        'IP Address': log.ip || 'N/A',
        'User Agent': log.userAgent || 'N/A',
        Metadata: log.metadata ? JSON.stringify(log.metadata) : 'N/A',
      };
    });

    // Convert to CSV
    const csv = arrayToCSV(csvData);

    // Return as downloadable file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/audit-log/export] Error:',
      error,
    );
    return NextResponse.json(
      { error: 'Failed to export audit log', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
