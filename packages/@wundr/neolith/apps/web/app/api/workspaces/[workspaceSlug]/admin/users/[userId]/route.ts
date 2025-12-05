/**
 * Admin User Management API Routes
 *
 * Handles individual user management operations.
 *
 * Routes:
 * - DELETE /api/workspaces/:workspaceSlug/admin/users/:userId - Remove user
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/[userId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}

/**
 * DELETE /api/workspaces/:workspaceSlug/admin/users/:userId
 *
 * Remove a user from the workspace. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns Success response
 */
export async function DELETE(
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

    const { workspaceSlug, userId } = await context.params;

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

    // Check if trying to remove self
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the workspace' },
        { status: 400 },
      );
    }

    // Find the user's membership
    const targetMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'User not found in workspace' },
        { status: 404 },
      );
    }

    // Prevent non-owners from removing owners
    if (targetMembership.role === 'OWNER' && adminMembership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can remove other owners' },
        { status: 403 },
      );
    }

    // Remove the user from the workspace
    await prisma.workspaceMember.delete({
      where: { id: targetMembership.id },
    });

    return NextResponse.json({
      success: true,
      message: 'User removed from workspace',
    });
  } catch (error) {
    console.error('Failed to remove user:', error);
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 },
    );
  }
}
