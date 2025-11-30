/**
 * Saved Items API Routes
 *
 * Handles listing and creating saved items (bookmarks) for the "Later" feature.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/saved-items - List user's saved items
 * - POST /api/workspaces/:workspaceSlug/saved-items - Save an item for later
 *
 * @module app/api/workspaces/[workspaceSlug]/saved-items/route
 */

import { prisma } from '@neolith/database';
import { Prisma, SavedItemStatus, SavedItemType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
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
 * GET /api/workspaces/:workspaceSlug/saved-items
 *
 * List saved items for the authenticated user.
 *
 * Query parameters:
 * - status: IN_PROGRESS | ARCHIVED | COMPLETED (default: all)
 * - type: MESSAGE | FILE (default: all)
 * - page: number (default: 1)
 * - limit: number (default: 50)
 */
export async function GET(
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

    const { workspaceSlug } = await context.params;

    const access = await getWorkspaceWithAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as SavedItemStatus | null;
    const itemType = searchParams.get('type') as SavedItemType | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.saved_itemsWhereInput = {
      user_id: session.user.id,
      workspace_id: access.workspace.id,
      ...(status && { status }),
      ...(itemType && { item_type: itemType }),
    };

    const [items, totalCount] = await Promise.all([
      prisma.saved_items.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
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
      }),
      prisma.saved_items.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/saved-items] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/saved-items
 *
 * Save an item (message or file) for later.
 *
 * Body:
 * - type: MESSAGE | FILE (required)
 * - messageId: string (required if type is MESSAGE)
 * - fileId: string (required if type is FILE)
 * - note: string (optional)
 * - dueDate: string (ISO date, optional)
 */
export async function POST(
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

    const { workspaceSlug } = await context.params;

    const access = await getWorkspaceWithAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    let body: {
      type: SavedItemType;
      messageId?: string;
      fileId?: string;
      note?: string;
      dueDate?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { type, messageId, fileId, note, dueDate } = body;

    if (!type || !['MESSAGE', 'FILE'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be MESSAGE or FILE.', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    if (type === 'MESSAGE' && !messageId) {
      return NextResponse.json(
        { error: 'messageId is required for MESSAGE type', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    if (type === 'FILE' && !fileId) {
      return NextResponse.json(
        { error: 'fileId is required for FILE type', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // Verify the message/file exists and user has access
    if (type === 'MESSAGE' && messageId) {
      const message = await prisma.messages.findFirst({
        where: { id: messageId },
        include: {
          channels: {
            include: {
              channel_members: {
                where: { user_id: session.user.id, left_at: null },
              },
            },
          },
        },
      });

      if (!message || message.channels.channel_members.length === 0) {
        return NextResponse.json(
          { error: 'Message not found or access denied', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      // Check if already saved
      const existing = await prisma.saved_items.findUnique({
        where: {
          user_id_message_id: {
            user_id: session.user.id,
            message_id: messageId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Message already saved', code: 'ALREADY_EXISTS', data: existing },
          { status: 409 },
        );
      }
    }

    if (type === 'FILE' && fileId) {
      const file = await prisma.files.findFirst({
        where: {
          id: fileId,
          workspace_id: access.workspace.id,
        },
      });

      if (!file) {
        return NextResponse.json(
          { error: 'File not found', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      // Check if already saved
      const existing = await prisma.saved_items.findUnique({
        where: {
          user_id_file_id: {
            user_id: session.user.id,
            file_id: fileId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'File already saved', code: 'ALREADY_EXISTS', data: existing },
          { status: 409 },
        );
      }
    }

    const savedItem = await prisma.saved_items.create({
      data: {
        id: nanoid(),
        item_type: type,
        status: 'IN_PROGRESS',
        note: note || null,
        due_date: dueDate ? new Date(dueDate) : null,
        message_id: type === 'MESSAGE' ? messageId : null,
        file_id: type === 'FILE' ? fileId : null,
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

    return NextResponse.json(
      { data: savedItem, message: 'Item saved successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/saved-items] Error:', error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Item already saved', code: 'ALREADY_EXISTS' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
