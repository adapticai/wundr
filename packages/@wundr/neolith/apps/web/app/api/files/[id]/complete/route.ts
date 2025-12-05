/**
 * File Upload Completion API Routes
 *
 * Handles marking files as complete after successful direct upload to S3.
 *
 * Routes:
 * - POST /api/files/:id/complete - Mark file upload as complete
 *
 * @module app/api/files/[id]/complete/route
 */

import { getStorageService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/files/:id/complete
 *
 * Mark a file upload as complete after the client has successfully
 * uploaded to S3 using a presigned URL. This verifies the file exists
 * in S3 and updates the database record status to READY.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns Updated file record
 *
 * @example
 * ```
 * POST /api/files/file_123/complete
 * ```
 */
export async function POST(
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

    // Fetch file record
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
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

    // Verify user is the uploader
    if (file.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Only the uploader can complete the upload',
          UPLOAD_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if file is already complete
    if (file.status === 'READY') {
      return NextResponse.json({
        data: {
          ...file,
          size: Number(file.size),
          url: generateFileUrl(file.s3Key, file.s3Bucket),
        },
        message: 'File is already marked as complete',
      });
    }

    // Verify file exists in S3
    const storage = getStorageService();
    let s3Metadata = null;

    try {
      const exists = await storage.fileExists(file.s3Key);
      if (!exists) {
        return NextResponse.json(
          createErrorResponse(
            'File not found in storage. Upload may have failed.',
            UPLOAD_ERROR_CODES.FILE_NOT_IN_STORAGE,
          ),
          { status: 400 },
        );
      }

      // Get file metadata from S3
      const metadata = await storage.getFileMetadata(file.s3Key);
      s3Metadata = metadata;
    } catch (error) {
      console.error(
        '[POST /api/files/:id/complete] S3 verification error:',
        error,
      );
      return NextResponse.json(
        createErrorResponse(
          'Failed to verify file in storage',
          UPLOAD_ERROR_CODES.STORAGE_ERROR,
        ),
        { status: 500 },
      );
    }

    // Update file record to READY status
    const updatedFile = await prisma.file.update({
      where: { id: params.id },
      data: {
        status: 'READY',
        metadata: {
          ...(typeof file.metadata === 'object' ? file.metadata : {}),
          completedAt: new Date().toISOString(),
          s3Etag: s3Metadata?.etag,
          s3LastModified: s3Metadata?.lastModified.toISOString(),
        },
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
        workspaceId: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Add computed URL to response
    const responseData = {
      ...updatedFile,
      size: Number(updatedFile.size),
      url: generateFileUrl(updatedFile.s3Key, updatedFile.s3Bucket),
    };

    return NextResponse.json({
      data: responseData,
      message: 'File upload completed successfully',
    });
  } catch (error) {
    console.error('[POST /api/files/:id/complete] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
