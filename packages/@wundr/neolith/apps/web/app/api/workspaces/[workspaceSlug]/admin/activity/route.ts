/**
 * Admin Activity Log API Routes
 *
 * Handles admin activity log retrieval for workspace admins.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/activity - Get admin activity log
 *
 * @module app/api/workspaces/[workspaceId]/admin/activity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  activityLogFiltersSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type AdminAction,
  type AdminActionType,
} from '@/lib/validations/admin';

import type { NextRequest} from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/admin/activity
 *
 * Get admin activity log with filters. Requires admin role.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace ID
 * @returns Paginated list of admin actions
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: { workspace: true },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      action: searchParams.get('action') || undefined,
      actorId: searchParams.get('actorId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    };

    // Validate filters
    const parseResult = activityLogFiltersSchema.safeParse(filters);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { action, actorId, from, to, limit, offset } = parseResult.data;

    // Try to fetch from admin_actions table
    // This table may not exist yet, so we'll handle that gracefully
    try {
      const whereConditions: string[] = [`workspace_id = '${workspaceId}'`];

      if (action) {
        whereConditions.push(`action = '${action}'`);
      }
      if (actorId) {
        whereConditions.push(`actor_id = '${actorId}'`);
      }
      if (from) {
        whereConditions.push(`created_at >= '${from}'`);
      }
      if (to) {
        whereConditions.push(`created_at <= '${to}'`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Query admin actions
      const actionsResult = await prisma.$queryRawUnsafe<Array<{
        id: string;
        action: string;
        actor_id: string;
        target_type: string | null;
        target_id: string | null;
        target_name: string | null;
        metadata: unknown;
        ip_address: string | null;
        user_agent: string | null;
        created_at: Date;
      }>>(
        `SELECT id, action, actor_id, target_type, target_id, target_name, metadata, ip_address, user_agent, created_at
         FROM admin_actions
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limit}
         OFFSET ${offset}`,
      );

      // Get total count
      const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM admin_actions WHERE ${whereClause}`,
      );
      const total = Number(countResult[0]?.count || 0);

      // Fetch actor details
      const actorIds = [...new Set(actionsResult.map(a => a.actor_id))];
      const actors = await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      });
      const actorMap = new Map(actors.map(a => [a.id, a]));

      // Format response
      const actions: AdminAction[] = actionsResult.map(a => ({
        id: a.id,
        action: a.action as AdminActionType,
        actorId: a.actor_id,
        actor: actorMap.get(a.actor_id) || { id: a.actor_id, name: null, email: null },
        targetType: a.target_type,
        targetId: a.target_id,
        targetName: a.target_name,
        metadata: (a.metadata as Record<string, unknown>) || {},
        ipAddress: a.ip_address,
        userAgent: a.user_agent,
        createdAt: a.created_at,
      }));

      return NextResponse.json({ actions, total });
    } catch {
      // admin_actions table doesn't exist yet
      // Return empty actions from workspace settings as fallback
      const settings = (membership.workspace.settings as Record<string, unknown>) || {};
      const activityLog = (settings.activityLog as AdminAction[]) || [];

      // Apply filters
      let filteredActions = activityLog;

      if (action) {
        filteredActions = filteredActions.filter(a => a.action === action);
      }
      if (actorId) {
        filteredActions = filteredActions.filter(a => a.actorId === actorId);
      }
      if (from) {
        const fromDate = new Date(from);
        filteredActions = filteredActions.filter(a => new Date(a.createdAt) >= fromDate);
      }
      if (to) {
        const toDate = new Date(to);
        filteredActions = filteredActions.filter(a => new Date(a.createdAt) <= toDate);
      }

      // Sort by date descending
      filteredActions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = filteredActions.length;
      const paginatedActions = filteredActions.slice(offset, offset + limit);

      return NextResponse.json({ actions: paginatedActions, total });
    }
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/activity] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch activity log', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
