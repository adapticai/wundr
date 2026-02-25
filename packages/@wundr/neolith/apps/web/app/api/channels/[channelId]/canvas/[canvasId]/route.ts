/**
 * Channel Canvas Document API Routes
 *
 * Handles operations on a specific canvas document within a channel.
 *
 * Routes:
 * - GET    /api/channels/:channelId/canvas/:canvasId - Get a single canvas document
 * - PATCH  /api/channels/:channelId/canvas/:canvasId - Update a canvas document
 * - DELETE /api/channels/:channelId/canvas/:canvasId - Delete a canvas document
 *
 * @module app/api/channels/[channelId]/canvas/[canvasId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { CanvasDocument } from '../route';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID and canvas ID parameters
 */
interface RouteContext {
  params: Promise<{ channelId: string; canvasId: string }>;
}

/**
 * Channel settings shape with canvas documents
 */
interface ChannelSettings {
  canvasDocuments?: CanvasDocument[];
  [key: string]: unknown;
}

const CANVAS_ERROR_CODES = {
  UNAUTHORIZED: 'CANVAS_UNAUTHORIZED',
  FORBIDDEN: 'CANVAS_FORBIDDEN',
  NOT_FOUND: 'CANVAS_NOT_FOUND',
  VALIDATION_ERROR: 'CANVAS_VALIDATION_ERROR',
  INTERNAL_ERROR: 'CANVAS_INTERNAL_ERROR',
  NOT_CHANNEL_MEMBER: 'CANVAS_NOT_CHANNEL_MEMBER',
} as const;

function createErrorResponse(message: string, code: string) {
  return { error: message, code };
}

const routeParamSchema = z.object({
  channelId: z.string().min(1, 'Invalid channel ID'),
  canvasId: z.string().min(1, 'Invalid canvas ID'),
});

const updateCanvasSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100000).optional(),
});

/**
 * Helper to fetch channel membership and current settings
 */
async function getChannelMembership(channelId: string, userId: string) {
  return prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId, userId },
    },
    include: {
      channel: {
        select: {
          id: true,
          settings: true,
        },
      },
    },
  });
}

/**
 * GET /api/channels/:channelId/canvas/:canvasId
 *
 * Get a single canvas document.
 * Requires authentication and channel membership.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CANVAS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const paramResult = routeParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          CANVAS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const membership = await getChannelMembership(
      params.channelId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          CANVAS_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    const settings = membership.channel.settings as ChannelSettings;
    const documents = settings.canvasDocuments ?? [];
    const document = documents.find(d => d.id === params.canvasId);

    if (!document) {
      return NextResponse.json(
        createErrorResponse(
          'Canvas document not found',
          CANVAS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error(
      '[GET /api/channels/:channelId/canvas/:canvasId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CANVAS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/channels/:channelId/canvas/:canvasId
 *
 * Update a canvas document's title or content.
 * Only the creator or a channel admin can update a document.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CANVAS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const paramResult = routeParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          CANVAS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          CANVAS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = updateCanvasSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          CANVAS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const membership = await getChannelMembership(
      params.channelId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          CANVAS_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    const settings = membership.channel.settings as ChannelSettings;
    const documents = settings.canvasDocuments ?? [];
    const documentIndex = documents.findIndex(d => d.id === params.canvasId);

    if (documentIndex === -1) {
      return NextResponse.json(
        createErrorResponse(
          'Canvas document not found',
          CANVAS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const existingDocument = documents[documentIndex];

    // Only the creator or admins/owners can edit
    const isCreator = existingDocument.createdById === session.user.id;
    const isAdmin = membership.role === 'ADMIN' || membership.role === 'OWNER';
    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only the creator or channel admins can edit this document',
          CANVAS_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    const newContent =
      input.content !== undefined ? input.content : existingDocument.content;
    const updatedDocument: CanvasDocument = {
      ...existingDocument,
      title: input.title !== undefined ? input.title : existingDocument.title,
      content: newContent,
      preview: newContent.slice(0, 120),
      updatedAt: new Date().toISOString(),
    };

    const updatedDocuments = [...documents];
    updatedDocuments[documentIndex] = updatedDocument;

    await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        settings: {
          ...settings,
          canvasDocuments: updatedDocuments,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      data: updatedDocument,
      message: 'Canvas document updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/channels/:channelId/canvas/:canvasId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CANVAS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/channels/:channelId/canvas/:canvasId
 *
 * Delete a canvas document from the channel.
 * Only the creator or a channel admin can delete a document.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CANVAS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const paramResult = routeParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          CANVAS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const membership = await getChannelMembership(
      params.channelId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          CANVAS_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    const settings = membership.channel.settings as ChannelSettings;
    const documents = settings.canvasDocuments ?? [];
    const document = documents.find(d => d.id === params.canvasId);

    if (!document) {
      return NextResponse.json(
        createErrorResponse(
          'Canvas document not found',
          CANVAS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Only the creator or admins/owners can delete
    const isCreator = document.createdById === session.user.id;
    const isAdmin = membership.role === 'ADMIN' || membership.role === 'OWNER';
    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only the creator or channel admins can delete this document',
          CANVAS_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    const updatedDocuments = documents.filter(d => d.id !== params.canvasId);

    await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        settings: {
          ...settings,
          canvasDocuments: updatedDocuments,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      message: 'Canvas document deleted successfully',
      deletedId: params.canvasId,
    });
  } catch (error) {
    console.error(
      '[DELETE /api/channels/:channelId/canvas/:canvasId] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CANVAS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
