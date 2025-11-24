/**
 * Audit Logs Export API Routes
 *
 * Handles export requests for audit logs in various formats.
 * Supports CSV, JSON, and PDF exports for compliance reporting.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/audit-logs/export - Request export
 * - GET /api/workspaces/:workspaceId/admin/audit-logs/export - Get export status
 *
 * @module app/api/workspaces/[workspaceId]/admin/audit-logs/export/route
 */

import { AuditServiceImpl, type AuditDatabaseClient, type AuditRedisClient } from '@genesis/core';
import { redis } from '@genesis/core/redis';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest} from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/admin/audit-logs/export
 *
 * Request an export of audit logs. Creates a background job
 * that processes the export and provides a download URL.
 *
 * @param request - Next.js request with export parameters
 * @param context - Route context containing workspace ID
 * @returns Export job information
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/admin/audit-logs/export
 * { "format": "csv", "filters": { "dateRange": { ... } } }
 * ```
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

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const auditService = new AuditServiceImpl({
      prisma: prisma as unknown as AuditDatabaseClient,
      redis: redis as unknown as AuditRedisClient,
    });

    const exportResult = await auditService.requestExport(
      workspaceId,
      session.user.id,
      body.filters || { workspaceId },
      body.format || 'csv',
    );

    return NextResponse.json(exportResult);
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/admin/audit-logs/export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create export' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/workspaces/:workspaceId/admin/audit-logs/export
 *
 * Get the status of an export job.
 *
 * @param request - Next.js request with export ID
 * @param context - Route context containing workspace ID
 * @returns Export status information
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/admin/audit-logs/export?id=export_123
 * ```
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

    const { workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const exportId = searchParams.get('id');

    if (!exportId) {
      return NextResponse.json({ error: 'Export ID required' }, { status: 400 });
    }

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auditService = new AuditServiceImpl({
      prisma: prisma as unknown as AuditDatabaseClient,
      redis: redis as unknown as AuditRedisClient,
    });

    const exportStatus = await auditService.getExport(exportId);

    if (!exportStatus) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    return NextResponse.json(exportStatus);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/audit-logs/export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get export status' },
      { status: 500 },
    );
  }
}
