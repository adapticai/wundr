/**
 * Channel Message Subscription API Route (Server-Sent Events)
 *
 * SSE endpoint for real-time channel message updates.
 * Clients can subscribe to new messages, updates, and deletions.
 *
 * Routes:
 * - GET /api/channels/:channelId/subscribe - SSE stream for message updates
 *
 * Events:
 * - connected - Initial connection established
 * - new_message - New message posted
 * - message_updated - Message edited
 * - message_deleted - Message deleted
 * - typing - User is typing
 * - heartbeat - Keep-alive ping
 *
 * @module app/api/channels/[channelId]/subscribe/route
 */

import { prisma } from '@neolith/database';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/** Heartbeat interval for SSE keep-alive (30 seconds) */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Poll interval for message changes (2 seconds) */
const POLL_INTERVAL_MS = 2 * 1000;

/**
 * Format SSE message
 */
function formatSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create an SSE error response
 * Returns a proper SSE stream with an error event, then closes
 */
function createSSEErrorResponse(error: string, code: string, status: number): Response {
  const encoder = new TextEncoder();
  const errorMessage = formatSSEMessage('error', { error, code, status });

  return new Response(encoder.encode(errorMessage), {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Helper to check channel access
 */
async function checkChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: channel.workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  // For private channels, user must be a member
  if (channel.type === 'PRIVATE' && !channelMembership) {
    return null;
  }

  return {
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * Transform message for SSE response
 */
function transformMessage(message: {
  id: string;
  content: string;
  type: string;
  authorId: string;
  channelId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  isDeleted: boolean;
  author: {
    id: string;
    name: string | null;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
  }>;
  _count: {
    replies: number;
  };
}, currentUserId: string) {
  // Group reactions by emoji
  const reactionMap = new Map<string, { emoji: string; count: number; userIds: string[]; hasReacted: boolean }>();
  for (const reaction of message.reactions) {
    const existing = reactionMap.get(reaction.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(reaction.userId);
      if (reaction.userId === currentUserId) {
        existing.hasReacted = true;
      }
    } else {
      reactionMap.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        userIds: [reaction.userId],
        hasReacted: reaction.userId === currentUserId,
      });
    }
  }

  return {
    id: message.id,
    content: message.content,
    type: message.type,
    authorId: message.authorId,
    channelId: message.channelId,
    parentId: message.parentId,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    isDeleted: message.isDeleted,
    author: {
      id: message.author.id,
      name: message.author.displayName || message.author.name || message.author.email,
      email: message.author.email,
      displayName: message.author.displayName,
      avatarUrl: message.author.avatarUrl,
      image: message.author.avatarUrl,
      isOrchestrator: message.author.isOrchestrator,
    },
    reactions: Array.from(reactionMap.values()),
    replyCount: message._count.replies,
  };
}

/**
 * GET /api/channels/:channelId/subscribe
 *
 * Server-Sent Events endpoint for real-time channel message updates.
 * Requires authentication and channel membership for private channels.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns SSE stream
 *
 * @example
 * ```
 * GET /api/channels/ch_123/subscribe
 *
 * Events:
 * event: connected
 * data: {"channelId":"ch_123","timestamp":"2024-01-15T10:30:00Z"}
 *
 * event: new_message
 * data: {"id":"msg_456","content":"Hello!","author":{...},...}
 *
 * event: message_updated
 * data: {"id":"msg_456","content":"Hello! (edited)",...}
 *
 * event: message_deleted
 * data: {"messageId":"msg_456"}
 *
 * event: heartbeat
 * data: {"timestamp":"2024-01-15T10:31:00Z"}
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return createSSEErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED, 401);
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return createSSEErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const { channelId } = params;

    // Check access
    const access = await checkChannelAccess(channelId, session.user.id);
    if (!access) {
      return createSSEErrorResponse(
        'Channel not found or access denied',
        ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        404,
      );
    }

    // Track last seen message for polling
    let lastMessageId: string | null = null;
    let lastMessageTime: Date | null = null;

    // Get the most recent message to set the baseline
    const latestMessage = await prisma.message.findFirst({
      where: { channelId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    if (latestMessage) {
      lastMessageId = latestMessage.id;
      lastMessageTime = latestMessage.createdAt;
    }

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection confirmation
        controller.enqueue(
          encoder.encode(
            formatSSEMessage('connected', {
              channelId,
              timestamp: new Date().toISOString(),
            }),
          ),
        );

        // Set up polling interval for new messages
        const pollInterval = setInterval(async () => {
          try {
            // Query for new messages since last check
            const whereClause: {
              channelId: string;
              isDeleted: boolean;
              createdAt?: { gt: Date };
            } = {
              channelId,
              isDeleted: false,
            };

            if (lastMessageTime) {
              whereClause.createdAt = { gt: lastMessageTime };
            }

            const newMessages = await prisma.message.findMany({
              where: whereClause,
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
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
                  },
                },
                _count: {
                  select: {
                    replies: true,
                  },
                },
              },
            });

            // Emit new messages
            for (const message of newMessages) {
              // Skip if we've already processed this message
              if (lastMessageId === message.id) {
                continue;
              }

              controller.enqueue(
                encoder.encode(
                  formatSSEMessage('new_message', {
                    type: 'new_message',
                    message: transformMessage(message, session.user.id),
                  }),
                ),
              );

              lastMessageId = message.id;
              lastMessageTime = message.createdAt;
            }

            // Check for recently updated messages (edited)
            const recentlyUpdated = await prisma.message.findMany({
              where: {
                channelId,
                isDeleted: false,
                editedAt: { not: null },
                updatedAt: { gt: new Date(Date.now() - POLL_INTERVAL_MS * 2) },
              },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
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
                  },
                },
                _count: {
                  select: {
                    replies: true,
                  },
                },
              },
            });

            for (const message of recentlyUpdated) {
              // Only emit if it's not a new message we just emitted
              if (newMessages.some((m) => m.id === message.id)) {
                continue;
              }

              controller.enqueue(
                encoder.encode(
                  formatSSEMessage('message_updated', {
                    type: 'message_updated',
                    message: transformMessage(message, session.user.id),
                  }),
                ),
              );
            }

            // Check for recently deleted messages
            const recentlyDeleted = await prisma.message.findMany({
              where: {
                channelId,
                isDeleted: true,
                updatedAt: { gt: new Date(Date.now() - POLL_INTERVAL_MS * 2) },
              },
              select: { id: true },
            });

            for (const message of recentlyDeleted) {
              controller.enqueue(
                encoder.encode(
                  formatSSEMessage('message_deleted', {
                    type: 'message_deleted',
                    messageId: message.id,
                  }),
                ),
              );
            }
          } catch {
            // Ignore polling errors, connection will be cleaned up on close
          }
        }, POLL_INTERVAL_MS);

        // Set up heartbeat interval for keep-alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(
                formatSSEMessage('heartbeat', {
                  timestamp: new Date().toISOString(),
                }),
              ),
            );
          } catch {
            // Connection closed, intervals will be cleaned up
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/subscribe] Error:', error);
    return createSSEErrorResponse(
      'An internal error occurred',
      ORG_ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
