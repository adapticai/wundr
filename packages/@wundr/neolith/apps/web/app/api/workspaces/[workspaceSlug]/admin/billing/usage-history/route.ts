/**
 * Usage History API Routes
 *
 * Handles historical usage data for analytics and visualization.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/billing/usage-history - Get usage history
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/billing/usage-history/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createAdminErrorResponse, ADMIN_ERROR_CODES } from '@/lib/validations/admin';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

interface UsageHistory {
  date: string;
  members: number;
  storage: number;
  apiCalls: number;
  cost: number;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/billing/usage-history
 *
 * Get usage history for the last 30 days. Requires admin role.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
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
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // In production, this would fetch actual historical data from a metrics table
    // For now, generate mock data for the last 30 days
    const history: UsageHistory[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate realistic-looking mock data with growth trends
      const dayProgress = (29 - i) / 29;
      const members = Math.floor(5 + dayProgress * 15 + Math.random() * 3);
      const storage = Math.floor(10 + dayProgress * 40 + Math.random() * 5);
      const apiCalls = Math.floor(5000 + dayProgress * 15000 + Math.random() * 2000);
      const cost = Math.floor(29 + dayProgress * 10 + Math.random() * 5);

      history.push({
        date: date.toISOString(),
        members,
        storage,
        apiCalls,
        cost,
      });
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug]/admin/billing/usage-history] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch usage history', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
