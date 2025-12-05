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

import { prisma, Prisma } from '@neolith/database';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { generateFileUrl } from '@/lib/validations/upload';

import type { SavedItemStatus, SavedItemType } from '@neolith/database';
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
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10)),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.savedItemWhereInput = {
      userId: session.user.id,
      workspaceId: access.workspace.id,
      ...(status && { status }),
      ...(itemType && { itemType }),
    };

    const [items, totalCount] = await Promise.all([
      prisma.savedItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.savedItem.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Convert BigInt fields to numbers for JSON serialization and add file URLs
    const serializedItems = items.map(item => ({
      ...item,
      file: item.file
        ? {
            ...item.file,
            size: Number(item.file.size),
            url: generateFileUrl(item.file.s3Key, item.file.s3Bucket),
          }
        : null,
    }));

    return NextResponse.json({
      data: serializedItems,
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
    console.error(
      '[GET /api/workspaces/:workspaceSlug/saved-items] Error:',
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An internal error occurred';
    return NextResponse.json(
      { error: errorMessage, code: 'INTERNAL_ERROR', details: String(error) },
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
        {
          error: 'Invalid type. Must be MESSAGE or FILE.',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      );
    }

    if (type === 'MESSAGE' && !messageId) {
      return NextResponse.json(
        {
          error: 'messageId is required for MESSAGE type',
          code: 'VALIDATION_ERROR',
        },
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
      const message = await prisma.message.findFirst({
        where: { id: messageId },
        include: {
          channel: {
            include: {
              channelMembers: {
                where: { userId: session.user.id, leftAt: null },
              },
            },
          },
        },
      });

      if (!message || message.channel.channelMembers.length === 0) {
        return NextResponse.json(
          { error: 'Message not found or access denied', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      // Check if already saved
      const existing = await prisma.savedItem.findUnique({
        where: {
          userId_messageId: {
            userId: session.user.id,
            messageId: messageId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: 'Message already saved',
            code: 'ALREADY_EXISTS',
            data: existing,
          },
          { status: 409 },
        );
      }
    }

    if (type === 'FILE' && fileId) {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          workspaceId: access.workspace.id,
        },
      });

      if (!file) {
        return NextResponse.json(
          { error: 'File not found', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      // Check if already saved
      const existing = await prisma.savedItem.findUnique({
        where: {
          userId_fileId: {
            userId: session.user.id,
            fileId: fileId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: 'File already saved',
            code: 'ALREADY_EXISTS',
            data: existing,
          },
          { status: 409 },
        );
      }
    }

    const savedItem = await prisma.savedItem.create({
      data: {
        id: nanoid(),
        itemType: type,
        status: 'IN_PROGRESS',
        note: note || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        messageId: type === 'MESSAGE' ? messageId : null,
        fileId: type === 'FILE' ? fileId : null,
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

    return NextResponse.json(
      { data: savedItem, message: 'Item saved successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/saved-items] Error:',
      error,
    );

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
