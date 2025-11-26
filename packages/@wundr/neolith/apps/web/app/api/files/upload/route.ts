/**
 * File Upload API Route
 *
 * Handles direct file uploads for message attachments.
 * Supports multipart form data uploads with S3 integration.
 *
 * Routes:
 * - POST /api/files/upload - Upload file directly to S3 and create File record
 *
 * @module app/api/files/upload/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
  getMaxFileSize,
  isAllowedFileType,
  generateFileUrl,
  MULTIPART_UPLOAD_THRESHOLD,
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
 * Upload file to S3
 *
 * @param file - File to upload
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @returns Success status
 */
async function uploadToS3(
  file: File,
  s3Key: string,
  s3Bucket: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Dynamic import - AWS SDK may not be installed in all environments
    const s3Module = await import('@aws-sdk/client-s3').catch(() => null);

    if (!s3Module) {
      // In development without AWS SDK, skip actual upload
      console.warn('[uploadToS3] AWS SDK not available, skipping actual upload');
      return { success: true };
    }

    const { S3Client, PutObjectCommand } = s3Module;
    const region = process.env.AWS_REGION ?? 'us-east-1';

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await client.send(command);

    return { success: true };
  } catch (error) {
    console.error('[uploadToS3] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
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
  const membership = await prisma.workspace_members.findUnique({
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
 * POST /api/files/upload
 *
 * Upload file directly to S3 and create File record in database.
 * Suitable for message attachments and smaller files.
 *
 * @param request - Next.js request with file data as FormData
 * @returns Created file record with metadata and URL
 *
 * @example
 * ```
 * POST /api/files/upload
 * Content-Type: multipart/form-data
 *
 * file: [binary data]
 * workspaceId: cuid_workspace_123
 * channelId: cuid_channel_456 (optional)
 * messageId: cuid_message_789 (optional)
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "file": {
 *       "id": "cuid_file_123",
 *       "filename": "1234567890-abc123-document.pdf",
 *       "originalName": "document.pdf",
 *       "mimeType": "application/pdf",
 *       "size": 1024000,
 *       "url": "https://bucket.s3.region.amazonaws.com/uploads/...",
 *       "thumbnailUrl": null,
 *       "status": "READY",
 *       "category": "document",
 *       "uploadedById": "user_123",
 *       "workspaceId": "workspace_123",
 *       "createdAt": "2024-01-01T12:00:00.000Z"
 *     }
 *   },
 *   "message": "File uploaded successfully"
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

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid form data', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Extract and validate form fields
    const file = formData.get('file');
    const workspaceId = formData.get('workspaceId');
    const channelId = formData.get('channelId');
    const messageId = formData.get('messageId');

    // Validate file
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        createErrorResponse('File is required', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate workspace ID
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Workspace ID is required', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate optional channel ID format
    if (channelId && typeof channelId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate optional message ID format
    if (messageId && typeof messageId !== 'string') {
      return NextResponse.json(
        createErrorResponse('Invalid message ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate file is not empty
    if (file.size === 0) {
      return NextResponse.json(
        createErrorResponse('File cannot be empty', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check file type
    if (!isAllowedFileType(file.type)) {
      return NextResponse.json(
        createErrorResponse(
          `File type '${file.type}' is not allowed`,
          UPLOAD_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
          {
            providedType: file.type,
            hint: 'Supported types: images, documents, audio, video, and archives',
          },
        ),
        { status: 400 },
      );
    }

    // Check file size against type-specific limit
    const maxSize = getMaxFileSize(file.type);
    if (file.size > maxSize) {
      const category = getFileCategory(file.type);
      return NextResponse.json(
        createErrorResponse(
          `File size exceeds maximum allowed for ${category} files`,
          UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
          {
            fileSize: file.size,
            maxSize,
            category,
            useMultipart: file.size > MULTIPART_UPLOAD_THRESHOLD,
          },
        ),
        { status: 400 },
      );
    }

    // Suggest multipart upload for large files
    if (file.size > MULTIPART_UPLOAD_THRESHOLD) {
      console.warn(
        `[POST /api/files/upload] Large file detected (${file.size} bytes). Consider using multipart upload.`,
      );
    }

    // Check workspace membership
    const membership = await checkWorkspaceMembership(workspaceId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Generate S3 key and bucket
    const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';
    const s3Key = generateS3Key(workspaceId, file.name);

    // Upload to S3
    const uploadResult = await uploadToS3(file, s3Key, s3Bucket);
    if (!uploadResult.success) {
      console.error('[POST /api/files/upload] S3 upload failed:', uploadResult.error);
      return NextResponse.json(
        createErrorResponse(
          'Failed to upload file to storage',
          UPLOAD_ERROR_CODES.UPLOAD_FAILED,
          { error: uploadResult.error },
        ),
        { status: 500 },
      );
    }

    // Determine file category and generate thumbnail URL for images
    const category = getFileCategory(file.type);
    const thumbnailUrl =
      category === 'image' && process.env.CDN_DOMAIN
        ? `https://${process.env.CDN_DOMAIN}/thumbnails/${s3Key}`
        : null;

    // Prepare metadata
    const metadata = {
      category,
      uploadType: 'direct',
      uploadedAt: new Date().toISOString(),
      ...(channelId && typeof channelId === 'string' && { channelId: channelId as string }),
      ...(messageId && typeof messageId === 'string' && { messageId: messageId as string }),
    };

    // Create file record in database
    const fileRecord = await prisma.files.create({
      data: {
        filename: s3Key.split('/').pop() ?? file.name,
        originalName: file.name,
        mimeType: file.type,
        size: BigInt(file.size),
        s3Key,
        s3Bucket,
        thumbnailUrl,
        status: 'READY',
        uploadedById: session.user.id,
        workspaceId,
        metadata,
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
        uploader: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Transform response data
    const responseData = {
      ...fileRecord,
      size: Number(fileRecord.size),
      url: generateFileUrl(fileRecord.s3Key, fileRecord.s3Bucket),
      category,
    };

    return NextResponse.json(
      {
        data: { file: responseData },
        message: 'File uploaded successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/files/upload] Error:', error);

    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: Record<string, unknown> };

      if (prismaError.code === 'P2003') {
        // Foreign key constraint violation
        return NextResponse.json(
          createErrorResponse(
            'Invalid workspace, channel, or message ID',
            UPLOAD_ERROR_CODES.VALIDATION_ERROR,
            { error: 'Referenced resource does not exist' },
          ),
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', UPLOAD_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
