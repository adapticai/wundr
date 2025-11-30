/**
 * Saved Item Detail API Routes
 *
 * Handles operations on individual saved items.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/saved-items/:itemId - Get saved item details
 * - PATCH /api/workspaces/:workspaceSlug/saved-items/:itemId - Update saved item
 * - DELETE /api/workspaces/:workspaceSlug/saved-items/:itemId - Remove saved item
 *
 * @module app/api/workspaces/[workspaceSlug]/saved-items/[itemId]/route
 */

import { prisma } from '@neolith/database';
import { SavedItemStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and item ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; itemId: string }>;
}

/**
 * Helper to get workspace by slug and verify user membership
 */
async function getWorkspaceWithAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspaces.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspace_members.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: workspace.id,
        user_id: userId,
      },
    },
  });

  if (!membership) {
    return null;
  }

  return { workspace, membership };
}

/**
 * GET /api/workspaces/:workspaceSlug/saved-items/:itemId
 *
 * Get details of a saved item.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const { workspaceSlug, itemId } = await context.params;

    const access = await getWorkspaceWithAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    const savedItem = await prisma.saved_items.findFirst({
      where: {
        id: itemId,
        user_id: session.user.id,
        workspace_id: access.workspace.id,
      },
      include: {
        messages: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                display_name: true,
                avatar_url: true,
                is_vp: true,
              },
            },
            channels: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
        files: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    if (!savedItem) {
      return NextResponse.json(
        { error: 'Saved item not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: savedItem });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceSlug/saved-items/:itemId
 *
 * Update a saved item (status, note, dueDate).
 *
 * Body:
 * - status: IN_PROGRESS | ARCHIVED | COMPLETED (optional)
 * - note: string (optional)
 * - dueDate: string | null (ISO date, optional)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const { workspaceSlug, itemId } = await context.params;

    const access = await getWorkspaceWithAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Verify ownership
    const existing = await prisma.saved_items.findFirst({
      where: {
        id: itemId,
        user_id: session.user.id,
        workspace_id: access.workspace.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved item not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    let body: {
      status?: SavedItemStatus;
      note?: string | null;
      dueDate?: string | null;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { status, note, dueDate } = body;

    // Validate status if provided
    if (status && !['IN_PROGRESS', 'ARCHIVED', 'COMPLETED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be IN_PROGRESS, ARCHIVED, or COMPLETED.', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // Build update data
    const updateData: {
      status?: SavedItemStatus;
      note?: string | null;
      due_date?: Date | null;
      completed_at?: Date | null;
      archived_at?: Date | null;
    } = {};

    if (status !== undefined) {
      updateData.status = status;

      // Set completedAt/archivedAt timestamps based on status change
      if (status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updateData.completed_at = new Date();
      } else if (status !== 'COMPLETED') {
        updateData.completed_at = null;
      }

      if (status === 'ARCHIVED' && existing.status !== 'ARCHIVED') {
        updateData.archived_at = new Date();
      } else if (status !== 'ARCHIVED') {
        updateData.archived_at = null;
      }
    }

    if (note !== undefined) {
      updateData.note = note;
    }

    if (dueDate !== undefined) {
      updateData.due_date = dueDate ? new Date(dueDate) : null;
    }

    const savedItem = await prisma.saved_items.update({
      where: { id: itemId },
      data: updateData,
      include: {
        messages: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                display_name: true,
                avatar_url: true,
                is_vp: true,
              },
            },
            channels: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
        files: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      data: savedItem,
      message: 'Saved item updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/saved-items/:itemId
 *
 * Remove a saved item (unsave/unbookmark).
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const { workspaceSlug, itemId } = await context.params;

    const access = await getWorkspaceWithAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Verify ownership and delete
    const existing = await prisma.saved_items.findFirst({
      where: {
        id: itemId,
        user_id: session.user.id,
        workspace_id: access.workspace.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved item not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await prisma.saved_items.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      message: 'Saved item removed successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
