/**
 * Admin User Role Management API Routes
 *
 * Handles user role updates.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceSlug/admin/users/:userId/role - Update user role
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/[userId]/role/route
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
 * PATCH /api/workspaces/:workspaceSlug/admin/users/:userId/role
 *
 * Update a user's role in the workspace. Requires admin role.
 *
 * @param request - Next.js request with role in body
 * @param context - Route context
 * @returns Updated membership
 */
export async function PATCH(
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
    const body = await request.json();
    const { role } = body;

    if (!role || !['OWNER', 'ADMIN', 'MEMBER', 'GUEST'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
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
        userId: session.user.id
      },
    });

    if (!adminMembership || !['ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
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

    // Only owners can assign owner role or change existing owners
    if (
      (role === 'OWNER' || targetMembership.role === 'OWNER') &&
      adminMembership.role !== 'OWNER'
    ) {
      return NextResponse.json(
        { error: 'Only owners can manage owner roles' },
        { status: 403 },
      );
    }

    // Update the user's role
    const updatedMembership = await prisma.workspaceMember.update({
      where: { id: targetMembership.id },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      membership: updatedMembership,
    });
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 },
    );
  }
}
