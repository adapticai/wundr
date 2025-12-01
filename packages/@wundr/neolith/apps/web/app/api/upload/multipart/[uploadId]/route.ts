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

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
} from '@/lib/validations/upload';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with upload ID parameter
 */
interface RouteContext {
  params: Promise<{ uploadId: string }>;
}

/**
 * List parts for a multipart upload from S3 using ListParts command
 *
 * @param uploadId - Multipart upload ID
 * @param s3Key - S3 object key
 * @returns Array of uploaded parts
 */
async function listUploadedParts(
  uploadId: string,
  s3Key: string
): Promise<
  { partNumber: number; eTag: string; size: number; lastModified: Date }[]
> {
  const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';

  try {
    const { S3Client, ListPartsCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    const response = await client.send(
      new ListPartsCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        UploadId: uploadId,
      })
    );

    return (response.Parts ?? []).map(part => ({
      partNumber: part.PartNumber ?? 0,
      eTag: part.ETag ?? '',
      size: part.Size ?? 0,
      lastModified: part.LastModified ?? new Date(),
    }));
  } catch {
    // Return empty array if listing fails
    return [];
  }
}

/**
 * Abort a multipart upload in S3
 *
 * @param uploadId - Multipart upload ID
 * @param s3Key - S3 object key
 */
async function abortMultipartUpload(
  uploadId: string,
  s3Key: string
): Promise<void> {
  const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';

  const { S3Client, AbortMultipartUploadCommand } =
    await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      UploadId: uploadId,
    })
  );
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

    // Validate upload ID parameter
    const params = await context.params;
    const paramResult = uploadIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid upload ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        createErrorResponse(
          'Upload not found',
          UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify ownership
    if (file.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Access denied', UPLOAD_ERROR_CODES.FORBIDDEN),
        { status: 403 }
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
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
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

    // Validate upload ID parameter
    const params = await context.params;
    const paramResult = uploadIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid upload ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        createErrorResponse(
          'Upload not found',
          UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify ownership
    if (file.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Access denied', UPLOAD_ERROR_CODES.FORBIDDEN),
        { status: 403 }
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
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
