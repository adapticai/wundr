/**
 * Files API Routes
 *
 * Handles listing files and direct upload for small files.
 *
 * Routes:
 * - GET /api/files - List files with filtering and pagination
 * - POST /api/files - Direct upload for small files
 *
 * @module app/api/files/route
 */

import crypto from 'crypto';

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileListSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  ALLOWED_FILE_TYPES,
  getFileCategory,
  getMaxFileSize,
  isAllowedFileType,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { FileListInput } from '@/lib/validations/upload';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Build where clause for file type filtering
 *
 * @param type - File type category
 * @returns Prisma where clause for mimeType
 */
function buildMimeTypeFilter(
  type: 'image' | 'document' | 'audio' | 'video' | 'archive',
): Prisma.StringFilter {
  const typeKey = type === 'image' ? 'images' : type === 'document' ? 'documents' : type;
  const mimeTypes = ALLOWED_FILE_TYPES[typeKey as keyof typeof ALLOWED_FILE_TYPES] as readonly string[];
  return {
    in: [...mimeTypes],
  };
}

/**
 * GET /api/files
 *
 * List files accessible to the authenticated user.
 * Files are filtered based on user's workspace memberships.
 *
 * @param request - Next.js request with query parameters
 * @returns Paginated list of files
 *
 * @example
 * ```
 * GET /api/files?type=image&limit=20&sortBy=createdAt&sortOrder=desc
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', UPLOAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = fileListSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: FileListInput = parseResult.data;

    // Get workspaces the user is a member of
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });

    const accessibleWorkspaceIds = userWorkspaces.map((w) => w.workspaceId);

    // If specific workspace requested, verify access
    if (filters.workspaceId && !accessibleWorkspaceIds.includes(filters.workspaceId)) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Build where clause
    const where: Prisma.FileWhereInput = {
      workspaceId: filters.workspaceId
        ? filters.workspaceId
        : { in: accessibleWorkspaceIds },
      status: 'READY',
      ...(filters.type && { mimeType: buildMimeTypeFilter(filters.type) }),
    };

    // Add cursor condition
    if (filters.cursor) {
      const cursorFile = await prisma.file.findUnique({
        where: { id: filters.cursor },
        select: { createdAt: true, size: true, filename: true },
      });

      if (cursorFile) {
        const cursorCondition = filters.sortOrder === 'desc' ? 'lt' : 'gt';
        if (filters.sortBy === 'createdAt') {
          where.createdAt = { [cursorCondition]: cursorFile.createdAt };
        } else if (filters.sortBy === 'size') {
          where.size = { [cursorCondition]: cursorFile.size };
        } else {
          where.filename = { [cursorCondition]: cursorFile.filename };
        }
      }
    }

    // Fetch files
    const files = await prisma.file.findMany({
      where,
      take: filters.limit + 1,
      orderBy: {
        [filters.sortBy]: filters.sortOrder,
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
        uploader: {
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

    // Check if there are more files
    const hasMore = files.length > filters.limit;
    const resultFiles = hasMore ? files.slice(0, filters.limit) : files;
    const nextCursor = hasMore ? resultFiles[resultFiles.length - 1]?.id ?? null : null;

    // Transform files to include computed URL
    const transformedFiles = resultFiles.map((file) => ({
      ...file,
      size: Number(file.size),
      url: generateFileUrl(file.s3Key, file.s3Bucket),
    }));

    return NextResponse.json({
      data: transformedFiles,
      pagination: {
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('[GET /api/files] Error:', error);
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
 * POST /api/files
 *
 * Direct upload for small files (< 5MB).
 * For larger files, use the multipart upload API.
 *
 * @param request - Next.js request with file data as FormData
 * @returns Created file record
 *
 * @example
 * ```
 * POST /api/files
 * Content-Type: multipart/form-data
 *
 * file: [binary data]
 * workspaceId: ws_123
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

    const file = formData.get('file');
    const workspaceId = formData.get('workspaceId');

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

    // Check file type
    if (!isAllowedFileType(file.type)) {
      return NextResponse.json(
        createErrorResponse(
          `File type '${file.type}' is not allowed`,
          UPLOAD_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
        ),
        { status: 400 },
      );
    }

    // Check file size for direct upload (max 5MB)
    const maxDirectUploadSize = 5 * 1024 * 1024;
    if (file.size > maxDirectUploadSize) {
      return NextResponse.json(
        createErrorResponse(
          'File too large for direct upload. Use multipart upload for files > 5MB.',
          UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
          { maxSize: maxDirectUploadSize, useMultipart: true },
        ),
        { status: 400 },
      );
    }

    // Check file size against type-specific limit
    const maxSize = getMaxFileSize(file.type);
    if (file.size > maxSize) {
      return NextResponse.json(
        createErrorResponse(
          `File size exceeds maximum allowed for ${getFileCategory(file.type)} files`,
          UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
          { maxSize },
        ),
        { status: 400 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this workspace',
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Generate file key
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `uploads/${workspaceId}/${timestamp}-${randomId}-${sanitizedFilename}`;
    const s3Bucket = process.env.AWS_S3_BUCKET ?? 'genesis-uploads';

    // In production, upload file to S3 here
    // const buffer = await file.arrayBuffer();
    // await s3Client.send(new PutObjectCommand({
    //   Bucket: s3Bucket,
    //   Key: s3Key,
    //   Body: Buffer.from(buffer),
    //   ContentType: file.type,
    // }));

    const category = getFileCategory(file.type);
    const thumbnailUrl = category === 'image' && process.env.CDN_DOMAIN
      ? `https://${process.env.CDN_DOMAIN}/thumbnails/${s3Key}`
      : null;

    // Create file record
    const fileRecord = await prisma.file.create({
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
        metadata: {
          category,
          uploadType: 'direct',
          uploadedAt: new Date().toISOString(),
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
        uploadedById: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Add computed URL to response
    const responseData = {
      ...fileRecord,
      size: Number(fileRecord.size),
      url: generateFileUrl(fileRecord.s3Key, fileRecord.s3Bucket),
    };

    return NextResponse.json(
      { data: { file: responseData }, message: 'File uploaded successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/files] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
