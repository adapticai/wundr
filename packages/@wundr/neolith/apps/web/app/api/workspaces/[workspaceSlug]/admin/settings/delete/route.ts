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
 * DELETE /api/workspaces/[workspaceSlug]/admin/settings/delete
 * Delete a workspace and all its data
 *
 * This is a destructive operation that:
 * - Deletes all channels, messages, and files
 * - Removes all workspace members
 * - Deletes the workspace itself
 *
 * Only workspace owners can delete workspaces
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Find the workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      include: {
        workspaceMembers: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Check if user is an owner
    const member = workspace.workspaceMembers[0];
    if (!member || member.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only workspace owners can delete workspaces' },
        { status: 403 }
      );
    }

    // Delete workspace (cascade will handle related data)
    // Prisma schema should have proper cascade delete configured
    await prisma.workspace.delete({
      where: { id: workspace.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Workspace deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
