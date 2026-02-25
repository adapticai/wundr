/**
 * Channel Canvas API Routes
 *
 * Handles canvas documents for a channel. Canvas documents are stored as JSON
 * in the channel's settings field under the key `canvasDocuments`.
 *
 * Routes:
 * - GET  /api/channels/:channelId/canvas        - List all canvas documents
 * - POST /api/channels/:channelId/canvas        - Create a new canvas document
 *
 * @module app/api/channels/[channelId]/canvas/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Canvas document type stored in channel settings
 */
export interface CanvasDocument {
  id: string;
  title: string;
  type: 'note' | 'document' | 'checklist' | 'table' | 'timeline';
  content: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
  createdByImage: string | null;
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

const channelIdParamSchema = z.object({
  channelId: z.string().min(1, 'Invalid channel ID'),
});

const createCanvasSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['note', 'document', 'checklist', 'table', 'timeline']),
  content: z.string().max(100000).optional().default(''),
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
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

/**
 * GET /api/channels/:channelId/canvas
 *
 * List all canvas documents for a channel.
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
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
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

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/canvas] Error:', error);
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
 * POST /api/channels/:channelId/canvas
 *
 * Create a new canvas document in a channel.
 * Requires authentication and channel membership.
 */
export async function POST(
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
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
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

    const parseResult = createCanvasSchema.safeParse(body);
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
    const existingDocuments = settings.canvasDocuments ?? [];

    const now = new Date().toISOString();
    const newDocument: CanvasDocument = {
      id: `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: input.title,
      type: input.type,
      content: input.content,
      preview: input.content.slice(0, 120),
      createdAt: now,
      updatedAt: now,
      createdById: session.user.id,
      createdByName:
        membership.user.displayName || membership.user.name || 'Unknown',
      createdByImage: membership.user.avatarUrl ?? null,
    };

    const updatedDocuments = [newDocument, ...existingDocuments];

    await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        settings: {
          ...settings,
          canvasDocuments: updatedDocuments,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { data: newDocument, message: 'Canvas document created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/canvas] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CANVAS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
