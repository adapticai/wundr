/**
 * Multipart Upload Completion API Route
 *
 * Handles completing multipart uploads by assembling parts.
 *
 * Routes:
 * - POST /api/upload/multipart/:uploadId/complete - Complete multipart upload
 *
 * @module app/api/upload/multipart/[uploadId]/complete/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadIdParamSchema,
  multipartCompleteSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { MultipartCompleteInput } from '@/lib/validations/upload';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with upload ID parameter
 */
interface RouteContext {
  params: Promise<{ uploadId: string }>;
}

/**
 * Complete multipart upload in S3
 *
 * @param uploadId - Multipart upload ID
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param parts - Array of completed parts with ETags
 */
async function completeMultipartUpload(
  uploadId: string,
  s3Key: string,
  s3Bucket: string,
  parts: { partNumber: number; eTag: string }[],
): Promise<void> {
  const region = process.env.AWS_REGION ?? 'us-east-1';

  const { S3Client, CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.eTag,
        })),
      },
    }),
  );
}

/**
 * Generate thumbnail URL for image/video files
 *
 * @param s3Key - S3 object key
 * @param mimeType - File MIME type
 * @returns Thumbnail URL or null
 */
function generateThumbnailUrl(s3Key: string, mimeType: string): string | null {
  const category = getFileCategory(mimeType);
  if (category !== 'image' && category !== 'video') {
    return null;
  }

  const cdnDomain = process.env.CDN_DOMAIN;
  const thumbnailPrefix = process.env.THUMBNAIL_PREFIX ?? 'thumbnails/';

  if (cdnDomain) {
    return `https://${cdnDomain}/${thumbnailPrefix}${s3Key}`;
  }

  // Fallback to S3 URL
  const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return `https://${s3Bucket}.s3.${region}.amazonaws.com/${thumbnailPrefix}${s3Key}`;
}

/**
 * Helper function to check if user is a member of the workspace
 *
 * @param workspaceId - Workspace ID to check
 * @param userId - User ID to verify membership
 * @returns Workspace membership or null
 */
async function checkWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return membership;
}

/**
 * Trigger async file processing
 *
 * @param fileId - ID of the file to process
 * @param mimeType - File MIME type
 */
async function triggerFileProcessing(fileId: string, mimeType: string): Promise<void> {
  const category = getFileCategory(mimeType);
  const sqsQueueUrl = process.env.FILE_PROCESSING_QUEUE_URL;

  await prisma.file.update({
    where: { id: fileId },
    data: { status: 'PROCESSING' },
  });

  // Send to SQS queue if configured
  if (sqsQueueUrl) {
    try {
      // Dynamic import - module may not be installed in all environments
      // eslint-disable-next-line import/no-unresolved
      const sqsModule = await import('@aws-sdk/client-sqs').catch(() => null);

      if (sqsModule) {
        const { SQSClient, SendMessageCommand } = sqsModule;
        const sqsClient = new SQSClient({
          region: process.env.AWS_REGION ?? 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
          },
        });

        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: sqsQueueUrl,
            MessageBody: JSON.stringify({
              fileId,
              mimeType,
              category,
              action: 'PROCESS_FILE',
            }),
          }),
        );
      } else {
        // SQS module not available, fall back to direct processing
        await prisma.file.update({
          where: { id: fileId },
          data: { status: 'READY' },
        });
      }
    } catch {
      // Fall back to direct processing if queue fails
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'READY' },
      });
    }
  } else {
    // Direct processing for development/testing
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'READY' },
    });
  }
}

/**
 * POST /api/upload/multipart/:uploadId/complete
 *
 * Complete a multipart upload by assembling all parts.
 * Requires authentication, ownership, and workspace membership.
 *
 * @param request - Next.js request with parts data
 * @param context - Route context with upload ID
 * @returns Completed file record
 *
 * @example
 * ```
 * POST /api/upload/multipart/abc123/complete
 * Content-Type: application/json
 *
 * {
 *   "workspaceId": "ws_123",
 *   "parts": [
 *     { "partNumber": 1, "eTag": "\"etag1\"" },
 *     { "partNumber": 2, "eTag": "\"etag2\"" }
 *   ],
 *   "metadata": {
 *     "duration": 120.5
 *   }
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

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const bodyResult = multipartCompleteSchema.safeParse(body);
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

    const input: MultipartCompleteInput = bodyResult.data;

    // Check workspace membership
    const membership = await checkWorkspaceMembership(input.workspaceId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Find the file record with this upload ID
    const pendingFile = await prisma.file.findFirst({
      where: {
        metadata: {
          path: ['uploadId'],
          equals: params.uploadId,
        },
        workspaceId: input.workspaceId,
        status: 'PENDING',
      },
    });

    if (!pendingFile) {
      return NextResponse.json(
        createErrorResponse(
          'Upload not found or already completed',
          UPLOAD_ERROR_CODES.UPLOAD_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify ownership
    if (pendingFile.uploadedById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Access denied', UPLOAD_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Validate parts against expected total
    const metadata = pendingFile.metadata as { totalParts?: number; expiresAt?: string } | null;
    const expectedParts = metadata?.totalParts ?? 0;

    // Sort parts by part number
    const sortedParts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);

    // Verify all parts are present
    const providedPartNumbers = new Set(sortedParts.map((p) => p.partNumber));
    const missingParts: number[] = [];

    for (let i = 1; i <= expectedParts; i++) {
      if (!providedPartNumbers.has(i)) {
        missingParts.push(i);
      }
    }

    if (missingParts.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Missing parts: ${missingParts.join(', ')}`,
          UPLOAD_ERROR_CODES.PART_MISSING,
          { missingParts },
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

    // Complete multipart upload in S3
    await completeMultipartUpload(
      params.uploadId,
      pendingFile.s3Key,
      pendingFile.s3Bucket,
      sortedParts,
    );

    // Generate thumbnail URL
    const thumbnailUrl = generateThumbnailUrl(pendingFile.s3Key, pendingFile.mimeType);

    // Merge metadata
    const existingMetadata = pendingFile.metadata as Record<string, unknown> | null;
    const mergedMetadata = {
      ...existingMetadata,
      ...input.metadata,
      uploadCompletedAt: new Date().toISOString(),
      partsCount: sortedParts.length,
    };

    // Update file record
    const file = await prisma.file.update({
      where: { id: pendingFile.id },
      data: {
        thumbnailUrl,
        status: 'PROCESSING',
        metadata: mergedMetadata as Prisma.InputJsonValue,
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
        uploadedById: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Trigger async processing
    await triggerFileProcessing(file.id, file.mimeType);

    // Add computed URL to response
    const responseData = {
      ...file,
      size: Number(file.size),
      url: generateFileUrl(file.s3Key, file.s3Bucket),
    };

    return NextResponse.json(
      { data: { file: responseData }, message: 'Multipart upload completed successfully' },
      { status: 201 },
    );
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
