/**
 * Messages API Routes
 *
 * Handles creating messages with file uploads support.
 * This route accepts FormData to support file attachments.
 *
 * Routes:
 * - POST /api/messages - Send a new message with optional attachments
 *
 * @module app/api/messages/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Helper function to check if user is a member of the channel
 */
async function checkChannelMembership(channelId: string, userId: string) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    include: {
      channel: {
        include: {
          workspace: {
            select: {
              id: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  return membership;
}

/**
 * Helper function to upload file and create file record
 */
async function uploadFile(file: File, userId: string, workspaceId: string) {
  // In a production environment, you would upload to S3, Cloudinary, etc.
  // For now, we'll just create a file record with metadata

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const extension = file.name.split('.').pop();
  const filename = `${timestamp}-${randomStr}.${extension}`;

  // Generate S3 key (path in S3 bucket)
  const s3Key = `uploads/${workspaceId}/${filename}`;
  const s3Bucket = process.env.S3_BUCKET_NAME || 'neolith-files';

  // Create file record
  const fileRecord = await prisma.file.create({
    data: {
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: BigInt(file.size),
      uploadedById: userId,
      workspaceId,
      s3Key,
      s3Bucket,
      // Generate thumbnail URL for images
      thumbnailUrl: file.type.startsWith('image/') ? `/api/files/${s3Key}/thumbnail` : null,
      status: 'READY',
      metadata: {
        category: file.type.split('/')[0] || 'file',
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  return fileRecord;
}

/**
 * POST /api/messages
 *
 * Send a new message with optional file attachments.
 * Accepts FormData with content, channelId, optional parentId, mentions, and file attachments.
 *
 * @param request - Next.js request with FormData
 * @returns Created message object
 *
 * @example
 * ```
 * POST /api/messages
 * Content-Type: multipart/form-data
 *
 * FormData:
 *   content: "Hello, world!"
 *   channelId: "ch_123"
 *   parentId: "msg_456" (optional)
 *   mentions: ["user_1", "user_2"] (optional, JSON array as string)
 *   attachments: File[] (optional, multiple files)
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MESSAGE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid form data', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Extract fields
    const content = formData.get('content') as string;
    const channelId = formData.get('channelId') as string;
    const parentId = (formData.get('parentId') as string) || null;
    const mentionsStr = (formData.get('mentions') as string) || null;
    const attachmentIdsStr = (formData.get('attachmentIds') as string) || null;
    const attachmentFiles = formData.getAll('attachments') as File[];

    // Validate required fields
    // Note: content can be empty if there are file attachments or attachment IDs
    const hasAttachments = attachmentFiles.length > 0;
    const attachmentIdsArray = attachmentIdsStr ? (function() {
      try {
        const parsed = JSON.parse(attachmentIdsStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })() : [];
    const hasAttachmentIds = attachmentIdsArray.length > 0;

    if ((!content || content.trim().length === 0) && !hasAttachments && !hasAttachmentIds) {
      return NextResponse.json(
        createErrorResponse('Message must have content or attachments', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    if (!channelId) {
      return NextResponse.json(
        createErrorResponse('Channel ID is required', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate content length (only if content is provided)
    if (content && content.length > 4000) {
      return NextResponse.json(
        createErrorResponse('Message content exceeds maximum length of 4000 characters', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse mentions
    let mentions: string[] = [];
    if (mentionsStr) {
      try {
        mentions = JSON.parse(mentionsStr);
        if (!Array.isArray(mentions)) {
          throw new Error('Mentions must be an array');
        }
      } catch {
        return NextResponse.json(
          createErrorResponse('Invalid mentions format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
    }

    // Parse attachment IDs (already uploaded files)
    let attachmentIds: string[] = [];
    if (attachmentIdsStr) {
      try {
        attachmentIds = JSON.parse(attachmentIdsStr);
        if (!Array.isArray(attachmentIds)) {
          throw new Error('Attachment IDs must be an array');
        }
      } catch {
        return NextResponse.json(
          createErrorResponse('Invalid attachment IDs format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
    }

    // Check channel membership
    const membership = await checkChannelMembership(channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // If parentId provided, verify parent message exists and belongs to same channel
    if (parentId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: parentId },
        select: { channelId: true, isDeleted: true, parentId: true },
      });

      if (!parentMessage || parentMessage.isDeleted) {
        return NextResponse.json(
          createErrorResponse(
            'Parent message not found',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 404 },
        );
      }

      if (parentMessage.channelId !== channelId) {
        return NextResponse.json(
          createErrorResponse(
            'Parent message belongs to a different channel',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 400 },
        );
      }

      // Don't allow nested threads
      if (parentMessage.parentId) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot reply to a thread reply',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 400 },
        );
      }
    }

    // Upload files and create file records (legacy support for direct file upload)
    type UploadedFile = Awaited<ReturnType<typeof uploadFile>>;
    const uploadedFiles: UploadedFile[] = [];
    const uploadErrors: string[] = [];

    for (const file of attachmentFiles) {
      if (file && file.size > 0) {
        try {
          const fileRecord = await uploadFile(file, session.user.id, membership.channel.workspaceId);
          uploadedFiles.push(fileRecord);
        } catch (error) {
          console.error('[POST /api/messages] File upload error:', error);
          uploadErrors.push(file.name);
          // Continue with other files
        }
      }
    }

    // Log if some files failed to upload
    if (uploadErrors.length > 0) {
      console.warn('[POST /api/messages] Failed to upload files:', uploadErrors);
    }

    // Combine uploaded files with pre-uploaded attachment IDs
    const allFileIds = [
      ...uploadedFiles.map((f) => f.id),
      ...attachmentIds,
    ];

    // Create the message with attachments
    const message = await prisma.message.create({
      data: {
        content: content?.trim() || '',
        type: 'TEXT',
        channelId,
        authorId: session.user.id,
        parentId,
        metadata: {
          mentions,
        } as Prisma.InputJsonValue,
        messageAttachments: allFileIds.length > 0 ? {
          create: allFileIds.map((fileId) => ({
            id: crypto.randomUUID(),
            fileId,
          })),
        } : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        messageAttachments: {
          include: {
            file: {
              select: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                size: true,
                s3Key: true,
                s3Bucket: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Create notifications for mentioned users
    if (mentions.length > 0) {
      const mentionNotifications = mentions
        .filter((userId) => userId !== session.user.id) // Don't notify self
        .map((userId) => ({
          userId,
          type: 'MENTION' as const,
          title: 'You were mentioned',
          body: `${session.user.name ?? 'Someone'} mentioned you in a message`,
          resourceId: message.id,
          resourceType: 'message',
          actionUrl: `/workspace/${membership.channel.workspaceId}/channels/${channelId}`,
        }));

      if (mentionNotifications.length > 0) {
        await prisma.notification.createMany({
          data: mentionNotifications,
        });
      }
    }

    // TODO: Broadcast message via WebSocket to channel members
    // This would be implemented with a real-time service like Pusher, Socket.io, etc.

    // Transform message to convert BigInt file sizes to numbers for JSON serialization
    const transformedMessage = {
      ...message,
      messageAttachments: message.messageAttachments.map((attachment) => ({
        ...attachment,
        file: attachment.file ? {
          ...attachment.file,
          size: Number(attachment.file.size),
        } : null,
      })),
    };

    return NextResponse.json(
      transformedMessage,
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/messages] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
