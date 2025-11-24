/**
 * Multipart Upload Management API Route
 *
 * Handles listing parts and aborting multipart uploads.
 *
 * Routes:
 * - GET /api/upload/multipart/:uploadId - List uploaded parts
 * - DELETE /api/upload/multipart/:uploadId - Abort multipart upload
 *
 * @module app/api/upload/multipart/[uploadId]/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with upload ID parameter
 */
interface RouteContext {
  params: Promise<{ uploadId: string }>;
}

/**
 * List parts for a multipart upload from S3
 *
 * @param _uploadId - Multipart upload ID
 * @param _s3Key - S3 object key
 * @returns Array of uploaded parts
 */
async function listUploadedParts(
  _uploadId: string,
  _s3Key: string,
): Promise<{ partNumber: number; eTag: string; size: number; lastModified: Date }[]> {
  // In production, this would use AWS SDK ListParts command
  // Mock response - in production, return actual parts from S3
  return [];
}

/**
 * Abort a multipart upload in S3
 *
 * @param uploadId - Multipart upload ID
 * @param s3Key - S3 object key
 */
async function abortMultipartUpload(uploadId: string, s3Key: string): Promise<void> {
  // In production, this would use AWS SDK AbortMultipartUpload command
  console.log(`[Multipart Upload] Aborted upload ${uploadId} for key ${s3Key}`);
}

/**
 * GET /api/upload/multipart/:uploadId
 *
 * List uploaded parts for a multipart upload.
 * Requires authentication and ownership of the upload.
 *
 * @param _request - Next.js request object
 * @param context - Route context with upload ID
 * @returns List of uploaded parts with metadata
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
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate upload ID parameter
    const params = await context.params;
    const paramResult = uploadIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid upload ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Find the file record with this upload ID
    const file = await prisma.file.findFirst({
      where: {
        metadata: {
          path: ['uploadId'],
          equals: params.uploadId,
        },
        status: 'PENDING',
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('Upload not found', UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify ownership
    if (file.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Access denied', UPLOAD_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // List uploaded parts from S3
    const parts = await listUploadedParts(params.uploadId, file.s3Key);
    const metadata = file.metadata as { totalParts?: number } | null;

    return NextResponse.json({
      data: {
        uploadId: params.uploadId,
        s3Key: file.s3Key,
        parts,
        totalParts: metadata?.totalParts ?? 0,
      },
    });
  } catch (error) {
    console.error('[GET /api/upload/multipart/:uploadId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/upload/multipart/:uploadId
 *
 * Abort a multipart upload and clean up resources.
 * Requires authentication and ownership of the upload.
 *
 * @param _request - Next.js request object
 * @param context - Route context with upload ID
 * @returns Success confirmation
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate upload ID parameter
    const params = await context.params;
    const paramResult = uploadIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid upload ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Find the file record with this upload ID
    const file = await prisma.file.findFirst({
      where: {
        metadata: {
          path: ['uploadId'],
          equals: params.uploadId,
        },
        status: 'PENDING',
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('Upload not found', UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify ownership
    if (file.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Access denied', UPLOAD_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Abort multipart upload in S3
    await abortMultipartUpload(params.uploadId, file.s3Key);

    // Update file status to FAILED
    await prisma.file.update({
      where: { id: file.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...(file.metadata as Prisma.JsonObject),
          abortedAt: new Date().toISOString(),
          abortReason: 'User requested abort',
        },
      },
    });

    return NextResponse.json({
      message: 'Upload aborted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/upload/multipart/:uploadId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
