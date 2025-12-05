/**
 * Audit Logs API Routes
 *
 * Provides access to audit logs for enterprise compliance tracking.
 * Admin-only endpoint for querying audit trail.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/audit-logs - Query audit logs
 *
 * @module app/api/workspaces/[workspaceId]/admin/audit-logs/route
 */

import {
  AuditServiceImpl,
  type AuditDatabaseClient,
  type AuditRedisClient,
  type AuditCategory,
  type AuditSeverity,
  type AuditAction,
} from '@neolith/core';
import { redis } from '@neolith/core/redis';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/admin/audit-logs
 *
 * Query audit logs with filters for compliance tracking.
 * Requires admin or owner role in workspace.
 *
 * @param request - Next.js request with filter parameters
 * @param context - Route context containing workspace ID
 * @returns Paginated audit log entries
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/admin/audit-logs?severity=critical&limit=50
 * ```
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Create audit service with typed clients
    const auditService = new AuditServiceImpl({
      prisma: prisma as unknown as AuditDatabaseClient,
      redis: redis as unknown as AuditRedisClient,
    });

    const result = await auditService.query(
      {
        workspaceId,
        severities: searchParams.get('severity')?.split(',') as
          | AuditSeverity[]
          | undefined,
        categories: searchParams.get('category')?.split(',') as
          | AuditCategory[]
          | undefined,
        actions: searchParams.get('action')?.split(',') as
          | AuditAction[]
          | undefined,
        search: searchParams.get('search') || undefined,
        dateRange:
          searchParams.get('from') && searchParams.get('to')
            ? {
                start: new Date(searchParams.get('from')!),
                end: new Date(searchParams.get('to')!),
              }
            : undefined,
      },
      {
        limit: parseInt(searchParams.get('limit') || '50'),
        offset: parseInt(searchParams.get('offset') || '0'),
      },
      searchParams.get('sort')
        ? {
            field: searchParams.get('sort') as
              | 'timestamp'
              | 'severity'
              | 'actor'
              | 'action',
            direction: (searchParams.get('order') || 'desc') as 'asc' | 'desc',
          }
        : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/admin/audit-logs] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
