/**
 * File Thumbnail API Route
 *
 * Handles redirecting to thumbnail URLs for image files.
 *
 * Routes:
 * - GET /api/files/:id/thumbnail - Redirect to thumbnail URL
 *
 * @module app/api/files/[id]/thumbnail/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  getFileCategory,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Generate thumbnail URL with optional transformations
 *
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param width - Desired thumbnail width
 * @param height - Desired thumbnail height
 * @returns Thumbnail URL
 */
function generateThumbnailUrl(
  s3Key: string,
  s3Bucket: string,
  width: number = 200,
  height: number = 200,
): string {
  const cdnDomain = process.env.CDN_DOMAIN;
  const region = process.env.AWS_REGION ?? 'us-east-1';

  if (cdnDomain) {
    // If using an image transformation CDN
    return `https://${cdnDomain}/thumbnails/${s3Key}?w=${width}&h=${height}&fit=cover`;
  }

  // Fallback to pre-generated thumbnail location
  return `https://${s3Bucket}.s3.${region}.amazonaws.com/thumbnails/${s3Key}`;
}

/**
 * GET /api/files/:id/thumbnail
 *
 * Redirect to thumbnail URL for image files.
 * Supports optional width and height query parameters.
 * Requires authentication and access to the file's workspace.
 *
 * @param request - Next.js request with optional query parameters
 * @param context - Route context with file ID
 * @returns Redirect to thumbnail URL
 *
 * @example
 * ```
 * GET /api/files/file_123/thumbnail?w=300&h=300
 * ```
 *
 * Response: HTTP 302 redirect to thumbnail URL
 */
export async function GET(
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

    // Validate file ID parameter
    const params = await context.params;
    const paramResult = fileIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid file ID format', UPLOAD_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse optional size parameters
    const searchParams = request.nextUrl.searchParams;
    const width = parseInt(searchParams.get('w') ?? '200', 10);
    const height = parseInt(searchParams.get('h') ?? '200', 10);

    // Validate size parameters
    const maxSize = 2000;
    const validWidth = Math.min(Math.max(width, 50), maxSize);
    const validHeight = Math.min(Math.max(height, 50), maxSize);

    // Fetch file
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        s3Key: true,
        s3Bucket: true,
        mimeType: true,
        thumbnailUrl: true,
        workspaceId: true,
        status: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if file is an image
    const category = getFileCategory(file.mimeType);
    if (category !== 'image') {
      return NextResponse.json(
        createErrorResponse(
          'Thumbnails are only available for image files',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check if file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createErrorResponse(
          'File is not ready',
          UPLOAD_ERROR_CODES.NOT_FOUND,
          { status: file.status },
        ),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: file.workspaceId,
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

    // Generate thumbnail URL
    const thumbnailUrl = file.thumbnailUrl
      ?? generateThumbnailUrl(file.s3Key, file.s3Bucket, validWidth, validHeight);

    // Redirect to thumbnail URL
    return NextResponse.redirect(thumbnailUrl);
  } catch (error) {
    console.error('[GET /api/files/:id/thumbnail] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
