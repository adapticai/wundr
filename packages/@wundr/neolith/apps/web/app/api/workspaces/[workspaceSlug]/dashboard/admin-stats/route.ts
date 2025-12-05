/**
 * Dashboard Admin Stats API Route
 *
 * Provides admin-specific statistics for the workspace dashboard.
 * Includes member counts, pending invites, billing status, and workspace health metrics.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/dashboard/admin-stats - Get admin statistics
 *
 * @module app/api/workspaces/[workspaceSlug]/dashboard/admin-stats/route
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
 * Admin stats response
 */
interface AdminStats {
  pendingInvites: number;
  totalMembers: number;
  securityEvents: number;
  billingStatus: 'active' | 'past_due' | 'canceled' | 'trial' | null;
  memberGrowth: {
    current: number;
    previous: number;
    percentage: number;
  };
  workspaceHealth: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  };
}

/**
 * Helper function to check workspace admin access
 */
async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });

  if (!workspace) {
    return null;
  }

  // Check organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  // Check workspace membership
  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  // User needs to be either an org owner/admin or workspace admin/owner
  const isOrgAdmin = ['OWNER', 'ADMIN'].includes(orgMembership.role);
  const isWorkspaceAdmin =
    workspaceMembership &&
    ['ADMIN', 'OWNER'].includes(workspaceMembership.role);

  if (!isOrgAdmin && !isWorkspaceAdmin) {
    return null;
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/dashboard/admin-stats
 *
 * Get admin statistics for the workspace dashboard.
 * Requires admin or owner role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug
 * @returns Admin statistics including members, invites, billing, and health
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/dashboard/admin-stats
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID from params
    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or admin access required' },
        { status: 403 },
      );
    }

    // Calculate date 30 days ago for member growth comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate date 7 days ago for active user check
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all statistics in parallel
    const [
      totalMembers,
      // Note: There's no workspace invitation model in the schema
      // Using 0 for now - this can be updated when invites are implemented
      currentMonthMembers,
      previousMonthMembers,
      recentSecurityEvents,
    ] = await Promise.all([
      // Total workspace members
      prisma.workspaceMember.count({
        where: { workspaceId },
      }),

      // Members joined in the last 30 days
      prisma.workspaceMember.count({
        where: {
          workspaceId,
          joinedAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),

      // Members joined 30-60 days ago
      prisma.workspaceMember.count({
        where: {
          workspaceId,
          joinedAt: {
            gte: new Date(
              thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000,
            ),
            lt: thirtyDaysAgo,
          },
        },
      }),

      // Count audit log entries for security events (if audit log exists)
      // For now, we'll use 0 as a placeholder
      Promise.resolve(0),
    ]);

    // Calculate member growth percentage
    const memberGrowthPercentage =
      previousMonthMembers > 0
        ? Math.round(
            ((currentMonthMembers - previousMonthMembers) /
              previousMonthMembers) *
              100,
          )
        : currentMonthMembers > 0
          ? 100
          : 0;

    // Determine workspace health
    const issues: string[] = [];
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for potential issues
    if (totalMembers === 0) {
      issues.push('No members in workspace');
      healthStatus = 'warning';
    }

    // Check for inactive workspace (no members joined recently)
    if (totalMembers > 0 && currentMonthMembers === 0) {
      issues.push('No new members in the last 30 days');
      if (healthStatus === 'healthy') {
healthStatus = 'warning';
}
    }

    // Build admin stats response
    const adminStats: AdminStats = {
      pendingInvites: 0, // Placeholder - update when invitation system is implemented
      totalMembers,
      securityEvents: recentSecurityEvents,
      billingStatus: 'active', // Placeholder - update when billing is implemented
      memberGrowth: {
        current: currentMonthMembers,
        previous: previousMonthMembers,
        percentage: memberGrowthPercentage,
      },
      workspaceHealth: {
        status: healthStatus,
        issues,
      },
    };

    return NextResponse.json({
      data: adminStats,
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/dashboard/admin-stats] Error:',
      error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 },
    );
  }
}
