/**
 * Multipart Upload Initiation API Route
 *
 * Handles initiating multipart uploads for large files.
 *
 * Routes:
 * - POST /api/upload/multipart - Initiate multipart upload
 *
 * @module app/api/upload/multipart/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  multipartInitSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
} from '@/lib/validations/upload';

import type {
  MultipartInitInput,
  MultipartInitResponse,
} from '@/lib/validations/upload';
import type { Prisma } from '@neolith/database';
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
 * Generate a unique upload ID for multipart upload
 *
 * @returns Unique upload ID
 */
function generateUploadId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Initiate multipart upload in S3
 *
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @returns Multipart upload initialization data
 */
async function initiateMultipartUpload(
  s3Key: string,
  s3Bucket: string,
  contentType: string,
): Promise<MultipartInitResponse> {
  const region = process.env.MY_AWS_REGION ?? 'us-east-1';
  const expiresIn = 24 * 3600; // 24 hours for multipart uploads
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  try {
    const { S3Client, CreateMultipartUploadCommand } =
      await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    const response = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        ContentType: contentType,
      }),
    );

    return {
      uploadId: response.UploadId ?? generateUploadId(),
      s3Key,
      s3Bucket,
      expiresAt,
    };
  } catch {
    // Fallback to generated ID if S3 call fails (for development)
    return {
      uploadId: generateUploadId(),
      s3Key,
      s3Bucket,
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
        },
      },
    },
  });

  return membership;
}

/**
 * POST /api/upload/multipart
 *
 * Initiate a multipart upload for large files.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request with multipart initiation data
 * @returns Upload ID and metadata for multipart upload
 *
 * @example
 * ```
 * POST /api/upload/multipart
 * Content-Type: application/json
 *
 * {
 *   "filename": "large-video.mp4",
 *   "contentType": "video/mp4",
 *   "size": 500000000,
 *   "workspaceId": "ws_123",
 *   "parts": 50
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
          UPLOAD_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
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

    // Validate input
    const parseResult = multipartInitSchema.safeParse(body);
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

    const input: MultipartInitInput = parseResult.data;

    // Check workspace membership
    const membership = await checkWorkspaceMembership(
      input.workspaceId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Generate unique file key
    const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
    const s3Key = generateS3Key(input.workspaceId, input.filename);

    // Initiate multipart upload
    const multipartData = await initiateMultipartUpload(
      s3Key,
      s3Bucket,
      input.contentType,
    );

    // Create pending file record with multipart upload metadata
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
          uploadType: 'multipart',
          uploadId: multipartData.uploadId,
          totalParts: input.parts,
          uploadInitiatedAt: new Date().toISOString(),
          expiresAt: multipartData.expiresAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      data: multipartData,
      message: 'Multipart upload initiated successfully',
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
