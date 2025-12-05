/**
 * File Download API Route
 *
 * Handles generating presigned download URLs for secure file access.
 *
 * Routes:
 * - GET /api/files/:id/download - Get presigned download URL
 *
 * @module app/api/files/[id]/download/route
 */

import { getStorageService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
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
 * GET /api/files/:id/download
 *
 * Generate a presigned download URL for secure file access.
 * The URL allows temporary access to the file stored in S3.
 *
 * @param request - Next.js request object with optional query params
 * @param context - Route context with file ID
 * @returns Presigned download URL or redirect
 *
 * @example
 * ```
 * GET /api/files/file_123/download?expiresIn=600&download=true
 * GET /api/files/file_123/download?redirect=true
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate file ID parameter
    const params = await context.params;
    const paramResult = fileIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid file ID format',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);
    const download = searchParams.get('download') === 'true';
    const inline = searchParams.get('inline') === 'true';
    const redirect = searchParams.get('redirect') === 'true';

    // Validate expiresIn
    if (expiresIn < 1 || expiresIn > 86400) {
      return NextResponse.json(
        createErrorResponse(
          'expiresIn must be between 1 and 86400 seconds',
          UPLOAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        mimeType: true,
        size: true,
        workspaceId: true,
        status: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Check if file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createErrorResponse(
          `File is not ready for download. Current status: ${file.status}`,
          UPLOAD_ERROR_CODES.FILE_NOT_READY
        ),
        { status: 400 }
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
          UPLOAD_ERROR_CODES.NOT_WORKSPACE_MEMBER
        ),
        { status: 403 }
      );
    }

    // Handle local files (development fallback)
    if (file.s3Bucket === 'local') {
      // For local files, the s3Key is the local path (e.g., /uploads/...)
      const localUrl = file.s3Key;

      if (redirect) {
        return NextResponse.redirect(new URL(localUrl, request.url));
      }

      return NextResponse.json({
        data: {
          url: localUrl,
          expiresAt: null, // Local files don't expire
          filename: file.originalName,
          mimeType: file.mimeType,
          size: Number(file.size),
        },
        message: 'Local file URL generated successfully',
      });
    }

    // Get storage service for S3 files
    const storage = getStorageService();

    // Determine content disposition
    let responseContentDisposition: string | undefined;
    if (download) {
      responseContentDisposition = `attachment; filename="${encodeURIComponent(file.originalName)}"`;
    } else if (inline) {
      responseContentDisposition = `inline; filename="${encodeURIComponent(file.originalName)}"`;
    }

    // Generate presigned download URL or use public URL
    let downloadUrl: string;

    // If STORAGE_PUBLIC_URL is set and we want inline viewing, use public URL directly
    if (process.env.STORAGE_PUBLIC_URL && inline) {
      downloadUrl = `${process.env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${file.s3Key}`;
    } else {
      // Generate presigned URL for secure/download access
      downloadUrl = await storage.getFileUrl(file.s3Key, {
        expiresIn,
        responseContentType: file.mimeType,
        responseContentDisposition,
      });
    }

    // Redirect if requested (for backward compatibility)
    if (redirect) {
      return NextResponse.redirect(downloadUrl);
    }

    // Return JSON response with URL
    return NextResponse.json({
      data: {
        url: downloadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        filename: file.originalName,
        mimeType: file.mimeType,
        size: Number(file.size),
      },
      message: 'Download URL generated successfully',
    });
  } catch (error) {
    console.error('[GET /api/files/:id/download] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
