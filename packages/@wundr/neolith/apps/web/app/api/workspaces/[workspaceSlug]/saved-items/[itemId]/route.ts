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
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { SavedItemStatus } from '@neolith/database';
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
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: userId,
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

    const savedItem = await prisma.savedItem.findFirst({
      where: {
        id: itemId,
        userId: session.user.id,
        workspaceId: access.workspace.id,
      },
      include: {
        message: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                isOrchestrator: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
        file: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
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

    // Convert BigInt fields to numbers for JSON serialization
    const serializedItem = {
      ...savedItem,
      file: savedItem.file
        ? {
            ...savedItem.file,
            size: Number(savedItem.file.size),
          }
        : null,
    };

    return NextResponse.json({ data: serializedItem });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:',
      error,
    );
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
    const existing = await prisma.savedItem.findFirst({
      where: {
        id: itemId,
        userId: session.user.id,
        workspaceId: access.workspace.id,
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
        {
          error: 'Invalid status. Must be IN_PROGRESS, ARCHIVED, or COMPLETED.',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    // Build update data
    const updateData: {
      status?: SavedItemStatus;
      note?: string | null;
      dueDate?: Date | null;
      completedAt?: Date | null;
      archivedAt?: Date | null;
    } = {};

    if (status !== undefined) {
      updateData.status = status;

      // Set completedAt/archivedAt timestamps based on status change
      if (status === 'COMPLETED' && existing.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (status !== 'COMPLETED') {
        updateData.completedAt = null;
      }

      if (status === 'ARCHIVED' && existing.status !== 'ARCHIVED') {
        updateData.archivedAt = new Date();
      } else if (status !== 'ARCHIVED') {
        updateData.archivedAt = null;
      }
    }

    if (note !== undefined) {
      updateData.note = note;
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    const savedItem = await prisma.savedItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        message: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                isOrchestrator: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
        file: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Convert BigInt fields to numbers for JSON serialization
    const serializedItem = {
      ...savedItem,
      file: savedItem.file
        ? {
            ...savedItem.file,
            size: Number(savedItem.file.size),
          }
        : null,
    };

    return NextResponse.json({
      data: serializedItem,
      message: 'Saved item updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:',
      error,
    );
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
    const existing = await prisma.savedItem.findFirst({
      where: {
        id: itemId,
        userId: session.user.id,
        workspaceId: access.workspace.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved item not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await prisma.savedItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      message: 'Saved item removed successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceSlug/saved-items/:itemId] Error:',
      error,
    );
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
