/**
 * Workspace Sidebar Stream API Route (Server-Sent Events)
 *
 * SSE endpoint for real-time sidebar updates including:
 * - Channel unread counts
 * - DM unread counts and new messages
 * - New channel/DM creation
 * - Channel membership changes
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/sidebar/stream - SSE stream for sidebar updates
 *
 * Events:
 * - connected - Initial connection established
 * - channel:update - Channel was updated (name, description, unread count)
 * - channel:created - New channel was created
 * - channel:deleted - Channel was deleted
 * - dm:update - DM was updated (new message, unread count)
 * - dm:created - New DM was created
 * - unread:update - Unread counts changed
 * - heartbeat - Keep-alive ping
 *
 * @module app/api/workspaces/[workspaceSlug]/sidebar/stream/route
 */

import { prisma } from '@neolith/database';

import { auth } from '@/lib/auth';
import { ORG_ERROR_CODES } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/** Heartbeat interval for SSE keep-alive (30 seconds) */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Poll interval for sidebar changes (3 seconds) */
const POLL_INTERVAL_MS = 3 * 1000;

/**
 * Format SSE message
 */
function formatSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create an SSE error response
 */
function createSSEErrorResponse(
  error: string,
  code: string,
  status: number
): Response {
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
 * Transform channel for SSE response
 */
function transformChannel(
  channel: {
    id: string;
    name: string;
    slug: string;
    type: string;
    description: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { messages: number };
    channelMembers?: Array<{ isStarred: boolean }>;
  },
  isStarred?: boolean
) {
  return {
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    type: channel.type.toLowerCase(),
    description: channel.description,
    isArchived: channel.isArchived,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    messageCount: channel._count?.messages ?? 0,
    isStarred: isStarred ?? channel.channelMembers?.[0]?.isStarred ?? false,
  };
}

/**
 * Transform DM for SSE response
 */
function transformDM(
  dm: {
    id: string;
    name: string;
    updatedAt: Date;
    createdAt: Date;
    channelMembers: Array<{
      userId: string;
      isStarred?: boolean;
      user: {
        id: string;
        name: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        status: string;
        isOrchestrator: boolean;
      };
    }>;
    messages: Array<{
      id: string;
      content: string;
      createdAt: Date;
      author: {
        id: string;
        name: string | null;
        displayName: string | null;
      };
    }>;
  },
  currentUserId: string,
  isStarred?: boolean
) {
  const participants = dm.channelMembers.map(m => ({
    id: m.userId,
    user: {
      id: m.user.id,
      name: m.user.displayName || m.user.name || 'Unknown',
      avatarUrl: m.user.avatarUrl,
      status: m.user.status,
      isOrchestrator: m.user.isOrchestrator,
    },
  }));

  const lastMessage = dm.messages[0]
    ? {
        content: dm.messages[0].content,
        createdAt: dm.messages[0].createdAt.toISOString(),
        author: {
          id: dm.messages[0].author.id,
          name:
            dm.messages[0].author.displayName ||
            dm.messages[0].author.name ||
            'Unknown',
        },
      }
    : null;

  // Check if this is a self-DM
  const otherParticipants = participants.filter(p => p.id !== currentUserId);
  const isSelfDM = otherParticipants.length === 0;
  const isGroupDM = otherParticipants.length >= 2;

  // Get isStarred from current user's membership
  const currentUserMembership = dm.channelMembers.find(
    m => m.userId === currentUserId
  );
  const starred = isStarred ?? currentUserMembership?.isStarred ?? false;

  return {
    id: dm.id,
    participants,
    lastMessage,
    updatedAt: dm.updatedAt.toISOString(),
    createdAt: dm.createdAt.toISOString(),
    isSelfDM,
    isGroupDM,
    isStarred: starred,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/sidebar/stream
 *
 * Server-Sent Events endpoint for real-time sidebar updates.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns SSE stream
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return createSSEErrorResponse(
        'Authentication required',
        ORG_ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    const userId = session.user.id;

    // Get workspace slug
    const params = await context.params;
    const { workspaceSlug } = params;

    if (!workspaceSlug) {
      return createSSEErrorResponse(
        'Workspace slug is required',
        ORG_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    // Get workspace - support both ID and slug for lookup
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
    });

    if (!workspace) {
      return createSSEErrorResponse(
        'Workspace not found',
        ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        404
      );
    }

    // Check if user is a workspace member
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
    });

    if (!membership) {
      return createSSEErrorResponse(
        'Access denied',
        ORG_ERROR_CODES.FORBIDDEN,
        403
      );
    }

    // Track previous state for change detection
    const previousChannelState = new Map<
      string,
      { updatedAt: string; unreadCount: number; isStarred: boolean }
    >();
    const previousDMState = new Map<
      string,
      { updatedAt: string; lastMessageId: string | null; isStarred: boolean }
    >();

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection confirmation
        controller.enqueue(
          encoder.encode(
            formatSSEMessage('connected', {
              workspaceId: workspace.id,
              workspaceSlug,
              timestamp: new Date().toISOString(),
            })
          )
        );

        // Fetch and send initial sidebar state
        const initialChannels = await prisma.channel.findMany({
          where: {
            workspaceId: workspace.id,
            type: { not: 'DM' },
            isArchived: false,
            channelMembers: {
              some: { userId },
            },
          },
          include: {
            _count: { select: { messages: true } },
            channelMembers: {
              where: { userId },
              select: { isStarred: true },
            },
          },
          orderBy: { name: 'asc' },
        });

        // Get unread counts for channels
        const channelUnreadCounts = await Promise.all(
          initialChannels.map(async channel => {
            const lastRead = await prisma.channelMember.findUnique({
              where: {
                channelId_userId: {
                  channelId: channel.id,
                  userId,
                },
              },
              select: { lastReadAt: true },
            });

            const unreadCount = await prisma.message.count({
              where: {
                channelId: channel.id,
                isDeleted: false,
                createdAt: lastRead?.lastReadAt
                  ? { gt: lastRead.lastReadAt }
                  : undefined,
                authorId: { not: userId },
              },
            });

            return { channelId: channel.id, unreadCount };
          })
        );

        // Create unread count map
        const unreadMap = new Map(
          channelUnreadCounts.map(c => [c.channelId, c.unreadCount])
        );

        // Send initial channels with unread counts
        const channelsWithUnread = initialChannels.map(channel => ({
          ...transformChannel(channel),
          unreadCount: unreadMap.get(channel.id) ?? 0,
        }));

        controller.enqueue(
          encoder.encode(
            formatSSEMessage('sidebar:init', {
              channels: channelsWithUnread,
            })
          )
        );

        // Store initial channel state
        for (const channel of channelsWithUnread) {
          previousChannelState.set(channel.id, {
            updatedAt: channel.updatedAt,
            unreadCount: channel.unreadCount,
            isStarred: channel.isStarred,
          });
        }

        // Fetch and send initial DMs
        const initialDMs = await prisma.channel.findMany({
          where: {
            workspaceId: workspace.id,
            type: 'DM',
            channelMembers: {
              some: { userId, leftAt: null },
            },
          },
          include: {
            channelMembers: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    avatarUrl: true,
                    status: true,
                    isOrchestrator: true,
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              where: { isDeleted: false },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        });

        // Get unread counts for DMs
        const dmUnreadCounts = await Promise.all(
          initialDMs.map(async dm => {
            const lastRead = await prisma.channelMember.findUnique({
              where: {
                channelId_userId: {
                  channelId: dm.id,
                  userId,
                },
              },
              select: { lastReadAt: true },
            });

            const unreadCount = await prisma.message.count({
              where: {
                channelId: dm.id,
                isDeleted: false,
                createdAt: lastRead?.lastReadAt
                  ? { gt: lastRead.lastReadAt }
                  : undefined,
                authorId: { not: userId },
              },
            });

            return { dmId: dm.id, unreadCount };
          })
        );

        const dmUnreadMap = new Map(
          dmUnreadCounts.map(d => [d.dmId, d.unreadCount])
        );

        const dmsWithUnread = initialDMs.map(dm => ({
          ...transformDM(dm, userId),
          unreadCount: dmUnreadMap.get(dm.id) ?? 0,
        }));

        controller.enqueue(
          encoder.encode(
            formatSSEMessage('dms:init', {
              directMessages: dmsWithUnread,
            })
          )
        );

        // Store initial DM state
        for (const dm of dmsWithUnread) {
          previousDMState.set(dm.id, {
            updatedAt: dm.updatedAt,
            lastMessageId: dm.lastMessage
              ? (initialDMs.find(d => d.id === dm.id)?.messages[0]?.id ?? null)
              : null,
            isStarred: dm.isStarred,
          });
        }

        // Send starred:init event with all starred channels and DMs
        const starredChannels = channelsWithUnread.filter(c => c.isStarred);
        const starredDMs = dmsWithUnread.filter(d => d.isStarred);

        controller.enqueue(
          encoder.encode(
            formatSSEMessage('starred:init', {
              starredChannels,
              starredDMs,
            })
          )
        );

        // Set up polling interval for sidebar changes
        const pollInterval = setInterval(async () => {
          try {
            // Check for channel updates
            const currentChannels = await prisma.channel.findMany({
              where: {
                workspaceId: workspace.id,
                type: { not: 'DM' },
                isArchived: false,
                channelMembers: {
                  some: { userId },
                },
              },
              include: {
                _count: { select: { messages: true } },
                channelMembers: {
                  where: { userId },
                  select: { isStarred: true },
                },
              },
            });

            // Get current unread counts
            const currentUnreadCounts = await Promise.all(
              currentChannels.map(async channel => {
                const lastRead = await prisma.channelMember.findUnique({
                  where: {
                    channelId_userId: {
                      channelId: channel.id,
                      userId,
                    },
                  },
                  select: { lastReadAt: true },
                });

                const unreadCount = await prisma.message.count({
                  where: {
                    channelId: channel.id,
                    isDeleted: false,
                    createdAt: lastRead?.lastReadAt
                      ? { gt: lastRead.lastReadAt }
                      : undefined,
                    authorId: { not: userId },
                  },
                });

                return { channelId: channel.id, unreadCount };
              })
            );

            const currentUnreadMap = new Map(
              currentUnreadCounts.map(c => [c.channelId, c.unreadCount])
            );

            // Check for new channels and starred changes
            for (const channel of currentChannels) {
              const prevState = previousChannelState.get(channel.id);
              const currentUnread = currentUnreadMap.get(channel.id) ?? 0;
              const currentIsStarred =
                channel.channelMembers?.[0]?.isStarred ?? false;

              if (!prevState) {
                // New channel
                controller.enqueue(
                  encoder.encode(
                    formatSSEMessage('channel:created', {
                      channel: {
                        ...transformChannel(channel),
                        unreadCount: currentUnread,
                      },
                    })
                  )
                );
                previousChannelState.set(channel.id, {
                  updatedAt: channel.updatedAt.toISOString(),
                  unreadCount: currentUnread,
                  isStarred: currentIsStarred,
                });
              } else {
                const hasUpdates =
                  prevState.updatedAt !== channel.updatedAt.toISOString() ||
                  prevState.unreadCount !== currentUnread ||
                  prevState.isStarred !== currentIsStarred;

                if (hasUpdates) {
                  // Channel updated (including star status)
                  controller.enqueue(
                    encoder.encode(
                      formatSSEMessage('channel:update', {
                        channel: {
                          ...transformChannel(channel),
                          unreadCount: currentUnread,
                        },
                      })
                    )
                  );

                  // Also emit starred:update if starred status changed
                  if (prevState.isStarred !== currentIsStarred) {
                    controller.enqueue(
                      encoder.encode(
                        formatSSEMessage('starred:update', {
                          type: 'channel',
                          id: channel.id,
                          isStarred: currentIsStarred,
                          channel: {
                            ...transformChannel(channel),
                            unreadCount: currentUnread,
                          },
                        })
                      )
                    );
                  }

                  previousChannelState.set(channel.id, {
                    updatedAt: channel.updatedAt.toISOString(),
                    unreadCount: currentUnread,
                    isStarred: currentIsStarred,
                  });
                }
              }
            }

            // Check for deleted channels
            const currentChannelIds = new Set(currentChannels.map(c => c.id));
            for (const [channelId] of previousChannelState) {
              if (!currentChannelIds.has(channelId)) {
                controller.enqueue(
                  encoder.encode(
                    formatSSEMessage('channel:deleted', { channelId })
                  )
                );
                previousChannelState.delete(channelId);
              }
            }

            // Check for DM updates
            const currentDMs = await prisma.channel.findMany({
              where: {
                workspaceId: workspace.id,
                type: 'DM',
                channelMembers: {
                  some: { userId, leftAt: null },
                },
              },
              include: {
                channelMembers: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        displayName: true,
                        avatarUrl: true,
                        status: true,
                        isOrchestrator: true,
                      },
                    },
                  },
                },
                messages: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  where: { isDeleted: false },
                  include: {
                    author: {
                      select: {
                        id: true,
                        name: true,
                        displayName: true,
                      },
                    },
                  },
                },
              },
            });

            // Get current DM unread counts
            const currentDMUnreadCounts = await Promise.all(
              currentDMs.map(async dm => {
                const lastRead = await prisma.channelMember.findUnique({
                  where: {
                    channelId_userId: {
                      channelId: dm.id,
                      userId,
                    },
                  },
                  select: { lastReadAt: true },
                });

                const unreadCount = await prisma.message.count({
                  where: {
                    channelId: dm.id,
                    isDeleted: false,
                    createdAt: lastRead?.lastReadAt
                      ? { gt: lastRead.lastReadAt }
                      : undefined,
                    authorId: { not: userId },
                  },
                });

                return { dmId: dm.id, unreadCount };
              })
            );

            const currentDMUnreadMap = new Map(
              currentDMUnreadCounts.map(d => [d.dmId, d.unreadCount])
            );

            for (const dm of currentDMs) {
              const prevState = previousDMState.get(dm.id);
              const currentLastMessageId = dm.messages[0]?.id ?? null;
              const currentUnread = currentDMUnreadMap.get(dm.id) ?? 0;
              const currentUserMembership = dm.channelMembers.find(
                m => m.userId === userId
              );
              const currentIsStarred =
                currentUserMembership?.isStarred ?? false;

              if (!prevState) {
                // New DM
                controller.enqueue(
                  encoder.encode(
                    formatSSEMessage('dm:created', {
                      dm: {
                        ...transformDM(dm, userId),
                        unreadCount: currentUnread,
                      },
                    })
                  )
                );
                previousDMState.set(dm.id, {
                  updatedAt: dm.updatedAt.toISOString(),
                  lastMessageId: currentLastMessageId,
                  isStarred: currentIsStarred,
                });
              } else {
                const hasUpdates =
                  prevState.updatedAt !== dm.updatedAt.toISOString() ||
                  prevState.lastMessageId !== currentLastMessageId ||
                  prevState.isStarred !== currentIsStarred;

                if (hasUpdates) {
                  // DM updated (new message, starred status change, or other update)
                  controller.enqueue(
                    encoder.encode(
                      formatSSEMessage('dm:update', {
                        dm: {
                          ...transformDM(dm, userId),
                          unreadCount: currentUnread,
                        },
                      })
                    )
                  );

                  // Also emit starred:update if starred status changed
                  if (prevState.isStarred !== currentIsStarred) {
                    controller.enqueue(
                      encoder.encode(
                        formatSSEMessage('starred:update', {
                          type: 'dm',
                          id: dm.id,
                          isStarred: currentIsStarred,
                          dm: {
                            ...transformDM(dm, userId),
                            unreadCount: currentUnread,
                          },
                        })
                      )
                    );
                  }

                  previousDMState.set(dm.id, {
                    updatedAt: dm.updatedAt.toISOString(),
                    lastMessageId: currentLastMessageId,
                    isStarred: currentIsStarred,
                  });
                }
              }
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
                })
              )
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
    console.error(
      '[GET /api/workspaces/:workspaceSlug/sidebar/stream] Error:',
      error
    );
    return createSSEErrorResponse(
      'An internal error occurred',
      ORG_ERROR_CODES.INTERNAL_ERROR,
      500
    );
  }
}
