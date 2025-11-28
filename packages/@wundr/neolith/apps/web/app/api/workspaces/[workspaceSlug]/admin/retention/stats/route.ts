/**
 * Retention Statistics API Routes
 *
 * Provides statistics about data retention status and storage usage
 * for enterprise compliance monitoring.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/retention/stats - Get retention stats
 *
 * @module app/api/workspaces/[workspaceId]/admin/retention/stats/route
 */

import {
  RetentionService,
  type RetentionServiceConfig,
  type RetentionRedisClient,
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
 * GET /api/workspaces/:workspaceId/admin/retention/stats
 *
 * Get retention statistics for the workspace including storage usage,
 * item counts, and pending deletions.
 * Requires admin or owner role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID
 * @returns Retention statistics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/admin/retention/stats
 * ```
 */
export async function GET(
  _request: Request,
  context: RouteContext,
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

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const retentionService = new RetentionService({
      prisma: prisma as unknown as RetentionServiceConfig['prisma'],
      redis: redis as unknown as RetentionRedisClient,
    });

    const stats = await retentionService.getStats(workspaceId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/retention/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
