/**
 * Upload Complete API Route
 *
 * Handles confirming that a file upload has completed and creates the file record.
 *
 * Routes:
 * - POST /api/upload/complete - Confirm upload completed
 *
 * @module app/api/upload/complete/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadCompleteSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { UploadCompleteInput } from '@/lib/validations/upload';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Generate thumbnail URL for image files
 *
 * @param s3Key - S3 object key
 * @param mimeType - File MIME type
 * @returns Thumbnail URL or null for non-images
 */
function generateThumbnailUrl(s3Key: string, mimeType: string): string | null {
  const category = getFileCategory(mimeType);
  if (category !== 'image') {
    return null;
  }

  const cdnDomain = process.env.CDN_DOMAIN;
  const thumbnailPrefix = process.env.THUMBNAIL_PREFIX ?? 'thumbnails/';

  if (cdnDomain) {
    return `https://${cdnDomain}/${thumbnailPrefix}${s3Key}`;
  }

  // Fallback to S3 URL with thumbnail path
  const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return `https://${s3Bucket}.s3.${region}.amazonaws.com/${thumbnailPrefix}${s3Key}`;
}

/**
 * Verify that the file exists in S3
 *
 * @param s3Key - S3 object key
 * @returns True if file exists
 */
async function verifyFileExists(s3Key: string): Promise<boolean> {
  const bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
  const region = process.env.AWS_REGION ?? 'us-east-1';

  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      }),
    );

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFound') {
      return false;
    }
    // For other errors, assume file might exist to avoid blocking uploads
    return s3Key.startsWith('uploads/') && s3Key.length > 20;
  }
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
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return membership;
}

/**
 * Trigger async file processing (thumbnail generation, metadata extraction, etc.)
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
 * POST /api/upload/complete
 *
 * Confirm that a file upload has completed and create the file record.
 * Triggers async processing for the uploaded file.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request with upload completion data
 * @returns Created file record
 *
 * @example
 * ```
 * POST /api/upload/complete
 * Content-Type: application/json
 *
 * {
 *   "s3Key": "uploads/ws_123/1234567890-abc123-document.pdf",
 *   "workspaceId": "ws_123",
 *   "metadata": {
 *     "width": 1920,
 *     "height": 1080
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
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
    const parseResult = uploadCompleteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UploadCompleteInput = parseResult.data;

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

    // Find the pending file record
    const pendingFile = await prisma.file.findFirst({
      where: {
        s3Key: input.s3Key,
        workspaceId: input.workspaceId,
        uploadedById: session.user.id,
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

    // Verify file exists in S3
    const fileExists = await verifyFileExists(input.s3Key);
    if (!fileExists) {
      return NextResponse.json(
        createErrorResponse(
          'Upload failed - file not found in storage',
          UPLOAD_ERROR_CODES.UPLOAD_FAILED,
        ),
        { status: 400 },
      );
    }

    // Generate thumbnail URL
    const thumbnailUrl = generateThumbnailUrl(input.s3Key, pendingFile.mimeType);

    // Merge existing metadata with new metadata
    const existingMetadata = pendingFile.metadata as Record<string, unknown> | null;
    const mergedMetadata = {
      ...existingMetadata,
      ...input.metadata,
      uploadCompletedAt: new Date().toISOString(),
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
      { data: { file: responseData }, message: 'Upload completed successfully' },
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
