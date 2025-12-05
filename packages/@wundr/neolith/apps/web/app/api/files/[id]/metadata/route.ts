/**
 * File Metadata API Routes
 *
 * Handles retrieving file metadata from S3 and database.
 *
 * Routes:
 * - GET /api/files/:id/metadata - Get comprehensive file metadata
 *
 * @module app/api/files/[id]/metadata/route
 */

import { getStorageService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/files/:id/metadata
 *
 * Get comprehensive file metadata including both database record
 * and S3 object metadata. This is useful for verifying file integrity
 * and getting additional S3-specific information.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns File metadata from database and S3
 *
 * @example
 * ```
 * GET /api/files/file_123/metadata
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          UPLOAD_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate file ID parameter
    const params = await context.params;
    const paramResult = fileIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid file ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Fetch file from database
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
          },
        },
        messageAttachments: {
          select: {
            messageId: true,
            message: {
              select: {
                id: true,
                channelId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: file.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Get S3 metadata if file is ready
    let s3Metadata = null;
    if (file.status === 'READY') {
      try {
        const storage = getStorageService();
        const metadata = await storage.getFileMetadata(file.s3Key);
        s3Metadata = {
          etag: metadata.etag,
          lastModified: metadata.lastModified.toISOString(),
          storageClass: metadata.storageClass,
          versionId: metadata.versionId,
          s3Metadata: metadata.metadata,
        };
      } catch (error) {
        // Log error but don't fail the request
        console.error(
          '[GET /api/files/:id/metadata] S3 metadata error:',
          error,
        );
      }
    }

    // Build response
    const responseData = {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size),
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      thumbnailUrl: file.thumbnailUrl,
      status: file.status,
      metadata: file.metadata,
      workspaceId: file.workspaceId,
      uploadedById: file.uploadedById,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      uploadedBy: file.uploadedBy,
      workspace: file.workspace,
      messageAttachments: file.messageAttachments.map(attachment => ({
        messageId: attachment.messageId,
        channelId: attachment.message.channelId,
        attachedAt: attachment.message.createdAt.toISOString(),
      })),
      s3: s3Metadata,
    };

    return NextResponse.json({
      data: responseData,
    });
  } catch (error) {
    console.error('[GET /api/files/:id/metadata] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
