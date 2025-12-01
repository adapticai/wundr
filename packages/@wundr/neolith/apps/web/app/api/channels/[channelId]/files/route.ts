/**
 * Channel Files API Route
 *
 * Handles listing files associated with a specific channel via message attachments.
 * Note: Files are stored at workspace level, but can be associated with channels
 * through message attachments.
 *
 * Routes:
 * - GET /api/channels/:channelId/files - List files in channel
 *
 * @module app/api/channels/[channelId]/files/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  workspaceFilesSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  ALLOWED_FILE_TYPES,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { WorkspaceFilesInput } from '@/lib/validations/upload';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Channel ID validation schema
 */
const channelIdParamSchema = z.object({
  channelId: z.string().cuid('Invalid channel ID format'),
});

/**
 * Build where clause for file type filtering
 *
 * @param type - File type category
 * @returns Prisma where clause for mimeType
 */
function buildMimeTypeFilter(
  type: 'image' | 'document' | 'audio' | 'video' | 'archive'
): Prisma.StringFilter {
  // Map singular type names to their ALLOWED_FILE_TYPES keys
  const typeKeyMap: Record<string, keyof typeof ALLOWED_FILE_TYPES> = {
    image: 'images',
    document: 'documents',
    audio: 'audio',
    video: 'video',
    archive: 'archives',
  };
  const typeKey = typeKeyMap[type];
  const mimeTypes = ALLOWED_FILE_TYPES[typeKey] as readonly string[];
  return {
    in: [...mimeTypes],
  };
}

/**
 * GET /api/channels/:channelId/files
 *
 * List files associated with a specific channel through message attachments.
 * Also includes files that have the channel referenced in their metadata.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context with channel ID
 * @returns Paginated list of files in the channel
 *
 * @example
 * ```
 * GET /api/channels/ch_123/files?type=image&limit=20
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": "file_123",
 *       "filename": "image.jpg",
 *       "mimeType": "image/jpeg",
 *       "size": 102400,
 *       "url": "https://cdn.example.com/...",
 *       ...
 *     }
 *   ],
 *   "pagination": {
 *     "hasMore": true,
 *     "nextCursor": "file_124"
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          UPLOAD_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = workspaceFilesSchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: WorkspaceFilesInput = queryResult.data;

    // Check channel membership
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          UPLOAD_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get file IDs from message attachments in this channel
    const attachments = await prisma.messageAttachment.findMany({
      where: {
        message: {
          channelId: params.channelId,
          isDeleted: false,
        },
      },
      select: {
        fileId: true,
      },
      distinct: ['fileId'],
    });

    const attachedFileIds = attachments.map(a => a.fileId);

    // Build where clause for files
    // Include files either:
    // 1. Attached to messages in this channel
    // 2. Have this channel referenced in metadata
    const where: Prisma.fileWhereInput = {
      OR: [
        { id: { in: attachedFileIds } },
        {
          workspaceId: membership.channel.workspaceId,
          metadata: {
            path: ['channelId'],
            equals: params.channelId,
          },
        },
      ],
      status: 'READY',
      ...(filters.type && { mimeType: buildMimeTypeFilter(filters.type) }),
    };

    // Add cursor condition for pagination
    if (filters.cursor) {
      const cursorFile = await prisma.file.findUnique({
        where: { id: filters.cursor },
        select: { createdAt: true },
      });

      if (cursorFile) {
        where.createdAt = { lt: cursorFile.createdAt };
      }
    }

    // Fetch files
    const files = await prisma.file.findMany({
      where,
      take: filters.limit + 1,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        s3Key: true,
        s3Bucket: true,
        thumbnailUrl: true,
        status: true,
        metadata: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
      },
    });

    // Check if there are more files
    const hasMore = files.length > filters.limit;
    const resultFiles = hasMore ? files.slice(0, filters.limit) : files;
    const nextCursor = hasMore
      ? (resultFiles[resultFiles.length - 1]?.id ?? null)
      : null;

    // Transform files to include computed URL
    const transformedFiles = resultFiles.map(file => ({
      ...file,
      size: Number(file.size),
      url: generateFileUrl(file.s3Key, file.s3Bucket),
    }));

    // Get total count for the channel
    const totalCount = await prisma.file.count({
      where: {
        OR: [
          { id: { in: attachedFileIds } },
          {
            workspaceId: membership.channel.workspaceId,
            metadata: {
              path: ['channelId'],
              equals: params.channelId,
            },
          },
        ],
        status: 'READY',
        ...(filters.type && { mimeType: buildMimeTypeFilter(filters.type) }),
      },
    });

    return NextResponse.json({
      data: transformedFiles,
      pagination: {
        hasMore,
        nextCursor,
        totalCount,
      },
      channel: {
        id: membership.channel.id,
        name: membership.channel.name,
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/files] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
