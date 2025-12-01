/**
 * File Upload API Route
 *
 * Handles two types of uploads:
 * 1. POST with JSON body - Generate presigned upload URL for direct browser-to-S3 uploads
 * 2. POST with FormData - Direct file upload through API (for small files)
 *
 * Routes:
 * - POST /api/files/upload - Generate presigned upload URL OR direct upload
 *
 * @module app/api/files/upload/route
 */

import crypto from 'crypto';

import { getStorageService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
 * Schema for presigned upload URL request
 */
const presignedUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  workspaceId: z.string().min(1),
  channelId: z.string().optional(),
  expiresIn: z.number().int().positive().max(3600).optional().default(3600),
});

type PresignedUploadInput = z.infer<typeof presignedUploadSchema>;

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
/**
 * Upload file to local storage (development fallback)
 *
 * @param file - File to upload
 * @param s3Key - File key/path
 * @returns Success status
 */
async function uploadToLocalStorage(
  file: File,
  s3Key: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Create uploads directory in public folder
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Create subdirectories based on s3Key path
    const keyParts = s3Key.split('/');
    keyParts.pop(); // Remove filename from path parts
    const subDir = keyParts.join('/');

    if (subDir) {
      await fs.mkdir(path.join(uploadsDir, subDir), { recursive: true });
    }

    // Write file to disk
    const filePath = path.join(uploadsDir, s3Key);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    console.log('[uploadToLocalStorage] File saved to:', filePath);
    // Return the local path - s3Key already includes 'uploads/' prefix, so use it directly
    return { success: true, localPath: `/${s3Key}` };
  } catch (error) {
    console.error('[uploadToLocalStorage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function uploadToS3(
  file: File,
  s3Key: string,
  s3Bucket: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  // Check if S3 credentials are configured
  const hasS3Credentials =
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.STORAGE_BUCKET;

  if (!hasS3Credentials) {
    // Fallback to local storage in development
    console.warn(
      '[uploadToS3] S3 credentials not configured, using local storage fallback'
    );
    return uploadToLocalStorage(file, s3Key);
  }

  try {
    // Dynamic import - AWS SDK may not be installed in all environments
    const s3Module = await import('@aws-sdk/client-s3').catch(() => null);

    if (!s3Module) {
      // In development without AWS SDK, use local storage
      console.warn(
        '[uploadToS3] AWS SDK not available, using local storage fallback'
      );
      return uploadToLocalStorage(file, s3Key);
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
    // Fallback to local storage on S3 error in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[uploadToS3] S3 upload failed, falling back to local storage'
      );
      return uploadToLocalStorage(file, s3Key);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Helper function to resolve workspace ID from slug or ID
 *
 * @param workspaceIdOrSlug - Workspace ID or slug to resolve
 * @returns Workspace ID or null if not found
 */
async function resolveWorkspaceId(
  workspaceIdOrSlug: string
): Promise<string | null> {
  // First try to find by ID
  const workspaceById = await prisma.workspace.findUnique({
    where: { id: workspaceIdOrSlug },
    select: { id: true },
  });

  if (workspaceById) {
    return workspaceById.id;
  }

  // Try to find by slug - workspace slug is unique within an organization
  // but we need to find it across all workspaces
  const workspaceBySlug = await prisma.workspace.findFirst({
    where: { slug: workspaceIdOrSlug },
    select: { id: true },
  });

  return workspaceBySlug?.id ?? null;
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
        createErrorResponse(
          'Authentication required',
          UPLOAD_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Check Content-Type to determine request type
    const contentType = request.headers.get('content-type') || '';

    // Handle presigned URL request (JSON body)
    if (contentType.includes('application/json')) {
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

      const parseResult = presignedUploadSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid request parameters',
            UPLOAD_ERROR_CODES.VALIDATION_ERROR,
            { errors: parseResult.error.flatten().fieldErrors }
          ),
          { status: 400 }
        );
      }

      const input: PresignedUploadInput = parseResult.data;

      // Check workspace membership
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: input.workspaceId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json(
          createErrorResponse(
            'Not a member of this workspace',
            UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER
          ),
          { status: 403 }
        );
      }

      // Validate file type
      if (!isAllowedFileType(input.mimeType)) {
        return NextResponse.json(
          createErrorResponse(
            `File type '${input.mimeType}' is not allowed`,
            UPLOAD_ERROR_CODES.FILE_TYPE_NOT_ALLOWED
          ),
          { status: 400 }
        );
      }

      // Validate file size
      const maxSize = getMaxFileSize(input.mimeType);
      if (input.size > maxSize) {
        return NextResponse.json(
          createErrorResponse(
            `File size exceeds maximum allowed for ${getFileCategory(input.mimeType)} files`,
            UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
            { maxSize }
          ),
          { status: 400 }
        );
      }

      // Get storage service
      const storage = getStorageService();

      // Generate S3 key
      const s3Key = storage.generateKey({
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        filename: input.filename,
      });

      // Generate presigned upload URL
      const uploadUrl = await storage.getSignedUploadUrl(s3Key, {
        contentType: input.mimeType,
        expiresIn: input.expiresIn,
        maxContentLength: input.size,
        metadata: {
          originalFilename: input.filename,
          uploadedBy: session.user.id,
          workspaceId: input.workspaceId,
          ...(input.channelId && { channelId: input.channelId }),
        },
      });

      // Create pending file record in database
      const fileRecord = await prisma.file.create({
        data: {
          filename: input.filename,
          originalName: input.filename,
          mimeType: input.mimeType,
          size: BigInt(input.size),
          s3Key,
          s3Bucket: storage.getConfig().bucket,
          status: 'PENDING',
          uploadedById: session.user.id,
          workspaceId: input.workspaceId,
          metadata: {
            category: getFileCategory(input.mimeType),
            uploadType: 'presigned',
            expiresAt: uploadUrl.expiresAt.toISOString(),
          },
        },
        select: {
          id: true,
          s3Key: true,
          s3Bucket: true,
          status: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        data: {
          fileId: fileRecord.id,
          uploadUrl: uploadUrl.url,
          method: uploadUrl.method,
          headers: uploadUrl.headers,
          expiresAt: uploadUrl.expiresAt.toISOString(),
          s3Key,
        },
        message: 'Presigned upload URL generated successfully',
      });
    }

    // Handle direct upload (FormData)
    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid form data',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        createErrorResponse(
          'File is required',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate workspace ID
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate optional channel ID format
    if (channelId && typeof channelId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate optional message ID format
    if (messageId && typeof messageId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Invalid message ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate file is not empty
    if (file.size === 0) {
      return NextResponse.json(
        createErrorResponse(
          'File cannot be empty',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          }
        ),
        { status: 400 }
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
          }
        ),
        { status: 400 }
      );
    }

    // Suggest multipart upload for large files
    if (file.size > MULTIPART_UPLOAD_THRESHOLD) {
      console.warn(
        `[POST /api/files/upload] Large file detected (${file.size} bytes). Consider using multipart upload.`
      );
    }

    // Resolve workspace ID from slug or ID
    const resolvedWorkspaceId = await resolveWorkspaceId(workspaceId);
    if (!resolvedWorkspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 404 }
      );
    }

    // Check workspace membership
    const membership = await checkWorkspaceMembership(
      resolvedWorkspaceId,
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

    // Generate S3 key and bucket
    // Use STORAGE_BUCKET (consistent with hasS3Credentials check) or AWS_S3_BUCKET_NAME as fallback
    const s3Bucket =
      process.env.STORAGE_BUCKET ||
      process.env.AWS_S3_BUCKET_NAME ||
      process.env.AWS_S3_BUCKET ||
      'genesis-uploads';
    const s3Key = generateS3Key(resolvedWorkspaceId, file.name);

    // Upload to S3 or local storage
    const uploadResult = await uploadToS3(file, s3Key, s3Bucket);
    if (!uploadResult.success) {
      console.error(
        '[POST /api/files/upload] Upload failed:',
        uploadResult.error
      );
      return NextResponse.json(
        createErrorResponse(
          'Failed to upload file to storage',
          UPLOAD_ERROR_CODES.UPLOAD_FAILED,
          { error: uploadResult.error }
        ),
        { status: 500 }
      );
    }

    // Determine file category and generate thumbnail URL for images
    const category = getFileCategory(file.type);
    const isLocalStorage = !!uploadResult.localPath;
    const thumbnailUrl =
      category === 'image' && process.env.CDN_DOMAIN && !isLocalStorage
        ? `https://${process.env.CDN_DOMAIN}/thumbnails/${s3Key}`
        : null;

    // Prepare metadata
    const metadata = {
      category,
      uploadType: isLocalStorage ? 'local' : 'direct',
      uploadedAt: new Date().toISOString(),
      ...(isLocalStorage && { localPath: uploadResult.localPath }),
      ...(channelId &&
        typeof channelId === 'string' && { channelId: channelId as string }),
      ...(messageId &&
        typeof messageId === 'string' && { messageId: messageId as string }),
    };

    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        filename: s3Key.split('/').pop() ?? file.name,
        originalName: file.name,
        mimeType: file.type,
        size: BigInt(file.size),
        s3Key: isLocalStorage ? uploadResult.localPath! : s3Key,
        s3Bucket: isLocalStorage ? 'local' : s3Bucket,
        thumbnailUrl,
        status: 'READY',
        uploadedById: session.user.id,
        workspaceId: resolvedWorkspaceId,
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
        uploadedBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Transform response data - use local path directly if available
    const fileUrl = isLocalStorage
      ? uploadResult.localPath!
      : generateFileUrl(fileRecord.s3Key, fileRecord.s3Bucket);

    const responseData = {
      ...fileRecord,
      size: Number(fileRecord.size),
      url: fileUrl,
      category,
    };

    return NextResponse.json(
      {
        data: { file: responseData },
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/files/upload] Error:', error);

    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as {
        code: string;
        meta?: Record<string, unknown>;
      };

      if (prismaError.code === 'P2003') {
        // Foreign key constraint violation
        return NextResponse.json(
          createErrorResponse(
            'Invalid workspace, channel, or message ID',
            UPLOAD_ERROR_CODES.VALIDATION_ERROR,
            { error: 'Referenced resource does not exist' }
          ),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
