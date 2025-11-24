/**
 * File Download API Route
 *
 * Handles generating signed download URLs for files.
 *
 * Routes:
 * - GET /api/files/:id/download - Redirect to signed download URL
 *
 * @module app/api/files/[id]/download/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Generate presigned download URL
 *
 * @param s3Key - S3 object key
 * @param s3Bucket - S3 bucket name
 * @param filename - Original filename for Content-Disposition
 * @returns Presigned download URL
 */
async function generateDownloadUrl(s3Key: string, s3Bucket: string, filename: string): Promise<string> {
  // In production, this would use AWS SDK to generate presigned URL
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const expiresIn = 3600; // 1 hour

  // Mock presigned URL - in production, this would be a real signed URL
  const encodedFilename = encodeURIComponent(filename);
  return `https://${s3Bucket}.s3.${region}.amazonaws.com/${s3Key}?response-content-disposition=attachment%3B%20filename%3D%22${encodedFilename}%22&X-Amz-Expires=${expiresIn}`;
}

/**
 * GET /api/files/:id/download
 *
 * Redirect to a signed download URL for the file.
 * Requires authentication and access to the file's workspace.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns Redirect to signed download URL
 *
 * @example
 * ```
 * GET /api/files/file_123/download
 * ```
 *
 * Response: HTTP 302 redirect to signed S3 URL
 */
export async function GET(
  _request: NextRequest,
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

    // Fetch file
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        s3Key: true,
        s3Bucket: true,
        originalName: true,
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

    // Check if file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createErrorResponse(
          'File is not ready for download',
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

    // Generate signed download URL
    const downloadUrl = await generateDownloadUrl(file.s3Key, file.s3Bucket, file.originalName);

    // Redirect to signed URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error('[GET /api/files/:id/download] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
