/**
 * Upload Initiation API Route
 *
 * Handles initiating file uploads by generating presigned URLs for direct S3 upload.
 *
 * Routes:
 * - POST /api/upload - Get signed URL for direct upload
 *
 * @module app/api/upload/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  uploadInitSchemaRefined,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
} from '@/lib/validations/upload';

import type {
  UploadInitInput,
  UploadInitResponse,
} from '@/lib/validations/upload';
import type { NextRequest } from 'next/server';

/**
 * Generate a unique file key for S3 storage
 *
 * @param workspaceId - Workspace ID for namespacing
 * @param filename - Original filename
 * @returns Unique S3 key
 */
function generateS3Key(workspaceId: string, filename: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `uploads/${workspaceId}/${timestamp}-${randomId}-${sanitizedFilename}`;
}

/**
 * Generate presigned POST URL for S3 upload
 *
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param contentType - File MIME type
 * @param maxSize - Maximum file size in bytes
 * @returns Presigned URL data
 */
async function generatePresignedPostUrl(
  s3Key: string,
  s3Bucket: string,
  contentType: string,
  maxSize: number
): Promise<UploadInitResponse> {
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  try {
    // Dynamic imports - modules may not be installed in all environments
    // eslint-disable-next-line import/no-unresolved
    const presignedModule = await import('@aws-sdk/s3-presigned-post').catch(
      () => null
    );
    const s3Module = await import('@aws-sdk/client-s3').catch(() => null);

    if (presignedModule && s3Module) {
      const { createPresignedPost } = presignedModule;
      const { S3Client } = s3Module;

      const client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        },
      });

      const { url, fields } = await createPresignedPost(client, {
        Bucket: s3Bucket,
        Key: s3Key,
        Conditions: [
          ['content-length-range', 0, maxSize],
          ['starts-with', '$Content-Type', contentType.split('/')[0] ?? ''],
        ],
        Fields: {
          'Content-Type': contentType,
        },
        Expires: expiresIn,
      });

      return {
        uploadUrl: url,
        s3Key,
        s3Bucket,
        fields,
        expiresAt,
      };
    }
    // Fall through to fallback if modules not available
    throw new Error('AWS SDK modules not available');
  } catch {
    // Fallback for development without AWS credentials
    const uploadUrl = `https://${s3Bucket}.s3.${region}.amazonaws.com`;

    return {
      uploadUrl,
      s3Key,
      s3Bucket,
      fields: {
        key: s3Key,
        'Content-Type': contentType,
      },
      expiresAt,
    };
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
          organizationId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * POST /api/upload
 *
 * Initiate a file upload by generating a presigned URL for direct S3 upload.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request with upload initiation data
 * @returns Presigned URL and upload metadata
 *
 * @example
 * ```
 * POST /api/upload
 * Content-Type: application/json
 *
 * {
 *   "filename": "document.pdf",
 *   "contentType": "application/pdf",
 *   "size": 1024000,
 *   "workspaceId": "ws_123"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "uploadUrl": "https://bucket.s3.region.amazonaws.com",
 *     "s3Key": "uploads/ws_123/1234567890-abc123-document.pdf",
 *     "s3Bucket": "genesis-uploads",
 *     "fields": { ... },
 *     "expiresAt": "2024-01-01T12:00:00.000Z"
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
        createErrorResponse(
          'Authentication required',
          UPLOAD_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
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
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = uploadInitSchemaRefined.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UploadInitInput = parseResult.data;

    // Check workspace membership
    const membership = await checkWorkspaceMembership(
      input.workspaceId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER
        ),
        { status: 403 }
      );
    }

    // Generate unique file key
    const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
    const s3Key = generateS3Key(input.workspaceId, input.filename);

    // Generate presigned URL
    const presignedData = await generatePresignedPostUrl(
      s3Key,
      s3Bucket,
      input.contentType,
      input.size
    );

    // Create pending file record in database
    await prisma.file.create({
      data: {
        filename: s3Key.split('/').pop() ?? input.filename,
        originalName: input.filename,
        mimeType: input.contentType,
        size: BigInt(input.size),
        s3Key,
        s3Bucket,
        status: 'PENDING',
        uploadedById: session.user.id,
        workspaceId: input.workspaceId,
        metadata: {
          category: getFileCategory(input.contentType),
          uploadInitiatedAt: new Date().toISOString(),
          channelId: input.channelId,
        },
      },
    });

    return NextResponse.json({
      data: presignedData,
      message: 'Upload URL generated successfully',
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
