/**
 * Admin Users Bulk Actions API Routes
 *
 * Handles bulk operations on multiple users.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/users/bulk - Perform bulk actions
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/bulk/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/users/bulk
 *
 * Perform bulk actions on users. Requires admin role.
 *
 * @param request - Next.js request with action and userIds
 * @param context - Route context
 * @returns Success response with affected count
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();
    const { userIds, action, role } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'No user IDs provided' },
        { status: 400 },
      );
    }

    if (!action || !['suspend', 'activate', 'remove', 'changeRole'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 },
      );
    }

    // Find workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
    });

    if (!adminMembership || !['ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
      );
    }

    // Ensure the current user is not in the list
    const filteredUserIds = userIds.filter(id => id !== session.user.id);

    if (filteredUserIds.length === 0) {
      return NextResponse.json(
        { error: 'Cannot perform bulk action on yourself' },
        { status: 400 },
      );
    }

    let affectedCount = 0;

    switch (action) {
      case 'suspend':
        const suspendResult = await prisma.user.updateMany({
          where: {
            id: { in: filteredUserIds },
          },
          data: { status: 'SUSPENDED' },
        });
        affectedCount = suspendResult.count;
        break;

      case 'activate':
        const activateResult = await prisma.user.updateMany({
          where: {
            id: { in: filteredUserIds },
          },
          data: { status: 'ACTIVE' },
        });
        affectedCount = activateResult.count;
        break;

      case 'remove':
        const deleteResult = await prisma.workspaceMember.deleteMany({
          where: {
            workspaceId: workspace.id,
            userId: { in: filteredUserIds },
            // Prevent removing owners unless current user is owner
            ...(adminMembership.role !== 'OWNER' && {
              role: { not: 'OWNER' },
            }),
          },
        });
        affectedCount = deleteResult.count;
        break;

      case 'changeRole':
        if (!role || !['OWNER', 'ADMIN', 'MEMBER', 'GUEST'].includes(role)) {
          return NextResponse.json(
            { error: 'Invalid role for bulk change' },
            { status: 400 },
          );
        }

        // Only owners can bulk change to/from owner role
        if ((role === 'OWNER' || adminMembership.role !== 'OWNER')) {
          // If not owner, only change non-owner roles
          const roleResult = await prisma.workspaceMember.updateMany({
            where: {
              workspaceId: workspace.id,
              userId: { in: filteredUserIds },
              role: { not: 'OWNER' },
            },
            data: { role },
          });
          affectedCount = roleResult.count;
        } else {
          // Owner can change any role
          const roleResult = await prisma.workspaceMember.updateMany({
            where: {
              workspaceId: workspace.id,
              userId: { in: filteredUserIds },
            },
            data: { role },
          });
          affectedCount = roleResult.count;
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 },
        );
    }

    return NextResponse.json({
      success: true,
      action,
      affectedCount,
      message: `Successfully performed ${action} on ${affectedCount} user(s)`,
    });
  } catch (error) {
    console.error('Failed to perform bulk action:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 },
    );
  }
}
