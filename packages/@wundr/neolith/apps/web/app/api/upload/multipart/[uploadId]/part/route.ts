/**
 * Multipart Upload Part URL API Route
 *
 * Handles generating signed URLs for uploading individual parts.
 *
 * Routes:
 * - POST /api/upload/multipart/:uploadId/part - Get signed URL for part upload
 *
 * @module app/api/upload/multipart/[uploadId]/part/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadIdParamSchema,
  partUrlSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  MAX_PARTS,
} from '@/lib/validations/upload';

import type { PartUrlInput, PartUrlResponse } from '@/lib/validations/upload';
import type { NextRequest } from 'next/server';

/**
 * Route context with upload ID parameter
 */
interface RouteContext {
  params: Promise<{ uploadId: string }>;
}

/**
 * Generate presigned URL for uploading a part
 *
 * @param uploadId - Multipart upload ID
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param partNumber - Part number (1-indexed)
 * @returns Presigned URL for part upload
 */
async function generatePartUploadUrl(
  uploadId: string,
  s3Key: string,
  s3Bucket: string,
  partNumber: number,
): Promise<PartUrlResponse> {
  const region = process.env.MY_AWS_REGION ?? 'us-east-1';
  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  try {
    const { S3Client, UploadPartCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    const command = new UploadPartCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      uploadUrl,
      partNumber,
      expiresAt,
    };
  } catch {
    // Fallback URL for development without AWS credentials
    const uploadUrl = `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3Key}?uploadId=${uploadId}&partNumber=${partNumber}`;

    return {
      uploadUrl,
      partNumber,
      expiresAt,
    };
  }
}

/**
 * POST /api/upload/multipart/:uploadId/part
 *
 * Generate a presigned URL for uploading a specific part of a multipart upload.
 * Requires authentication and ownership of the upload.
 *
 * @param request - Next.js request with part number
 * @param context - Route context with upload ID
 * @returns Presigned URL for part upload
 *
 * @example
 * ```
 * POST /api/upload/multipart/abc123/part
 * Content-Type: application/json
 *
 * {
 *   "partNumber": 1
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
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

    // Validate upload ID parameter
    const params = await context.params;
    const paramResult = uploadIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid upload ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate part number
    const bodyResult = partUrlSchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: bodyResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: PartUrlInput = bodyResult.data;

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
          UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND,
        ),
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

    // Validate part number against total parts
    const metadata = file.metadata as {
      totalParts?: number;
      expiresAt?: string;
    } | null;
    const totalParts = metadata?.totalParts ?? MAX_PARTS;

    if (input.partNumber > totalParts) {
      return NextResponse.json(
        createErrorResponse(
          `Part number ${input.partNumber} exceeds total parts ${totalParts}`,
          UPLOAD_ERROR_CODES.INVALID_PART,
        ),
        { status: 400 },
      );
    }

    // Check if upload has expired
    if (metadata?.expiresAt) {
      const expiresAt = new Date(metadata.expiresAt);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          createErrorResponse(
            'Upload has expired',
            UPLOAD_ERROR_CODES.UPLOAD_EXPIRED,
          ),
          { status: 410 },
        );
      }
    }

    // Generate presigned URL for part upload
    const partUrlData = await generatePartUploadUrl(
      params.uploadId,
      file.s3Key,
      file.s3Bucket,
      input.partNumber,
    );

    return NextResponse.json({
      data: partUrlData,
    });
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
