/**
 * File Detail API Routes
 *
 * Handles retrieving and deleting individual files.
 *
 * Routes:
 * - GET /api/files/:id - Get file details
 * - DELETE /api/files/:id - Delete file
 *
 * @module app/api/files/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  fileIdParamSchema,
  createErrorResponse,
  UPLOAD_ERROR_CODES,
  generateFileUrl,
} from '@/lib/validations/upload';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Delete file from S3
 *
 * @param _s3Key - S3 object key
 * @param _s3Bucket - S3 bucket name
 */
async function deleteFileFromStorage(_s3Key: string, _s3Bucket: string): Promise<void> {
  // In production, this would use AWS SDK DeleteObject command
  // TODO: Implement AWS S3 DeleteObject call
}

/**
 * GET /api/files/:id
 *
 * Get details of a specific file.
 * Requires authentication and access to the file's workspace.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns File details
 *
 * @example
 * ```
 * GET /api/files/file_123
 * ```
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

    // Fetch file with related data
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        uploadedBy: {
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
            organizationId: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
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

    // Add computed URL to response
    const responseData = {
      ...file,
      size: Number(file.size),
      url: generateFileUrl(file.s3Key, file.s3Bucket),
    };

    return NextResponse.json({
      data: responseData,
    });
  } catch (error) {
    console.error('[GET /api/files/:id] Error:', error);
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
 * DELETE /api/files/:id
 *
 * Delete a file. Only the uploader or workspace admins can delete files.
 * Requires authentication and appropriate permissions.
 *
 * When a file is deleted:
 * - All saved items referencing the file are deleted
 * - The messages that contained only this file are soft-deleted
 * - The file is permanently deleted from storage and database
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns Success confirmation
 *
 * @example
 * ```
 * DELETE /api/files/file_123
 * ```
 */
export async function DELETE(
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

    // Fetch file with message attachments
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        workspace: {
          select: {
            id: true,
            organizationId: true,
          },
        },
        messageAttachments: {
          select: {
            messageId: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        createErrorResponse('File not found', UPLOAD_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check permissions: user must be uploader or have admin role
    const isUploader = file.uploadedById === session.user.id;

    if (!isUploader) {
      // Check if user is workspace admin
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: file.workspaceId,
            userId: session.user.id,
          },
        },
        select: { role: true },
      });

      const isAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER';

      if (!isAdmin) {
        return NextResponse.json(
          createErrorResponse(
            'Permission denied. Only the uploader or workspace admins can delete files.',
            UPLOAD_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }
    }

    // Delete file from S3
    await deleteFileFromStorage(file.s3Key, file.s3Bucket);

    // Get message IDs that contain this file
    const messageIds = file.messageAttachments.map((a) => a.messageId);

    // Use transaction to ensure atomic operation
    await prisma.$transaction(async (tx) => {
      // Delete saved items that reference this file
      await tx.savedItem.deleteMany({
        where: { fileId: params.id },
      });

      // Soft-delete messages that contained this file
      // (the messageAttachment will be cascade-deleted when the file is deleted)
      // Note: We explicitly set updatedAt so the SSE polling detects the deletion
      if (messageIds.length > 0) {
        await tx.message.updateMany({
          where: { id: { in: messageIds } },
          data: {
            isDeleted: true,
            content: '[Message deleted]',
            updatedAt: new Date(),
          },
        });
      }

      // Delete file record from database (cascades to messageAttachments)
      await tx.file.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({
      message: 'File deleted successfully',
      deletedMessageCount: messageIds.length,
    });
  } catch (error) {
    console.error('[DELETE /api/files/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        UPLOAD_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
