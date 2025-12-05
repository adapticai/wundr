/**
 * Admin User Activate API Routes
 *
 * Handles user activation.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/users/:userId/activate - Activate user
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/[userId]/activate/route
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
 * POST /api/workspaces/:workspaceSlug/admin/users/:userId/activate
 *
 * Activate a suspended user. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns Success response
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

    // Update user status to active
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Failed to activate user:', error);
    return NextResponse.json(
      { error: 'Failed to activate user' },
      { status: 500 },
    );
  }
}
