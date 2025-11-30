/**
 * Command Palette Suggestions API
 *
 * Provides personalized suggestions for the command palette including:
 * - Recent channels the user has visited/messaged in
 * - Recent DMs the user has participated in
 * - Recent files the user has accessed
 * - Frequently contacted people
 * - Quick actions based on user role/permissions
 *
 * @module app/api/workspaces/[workspaceSlug]/command-palette/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Suggestion types
 */
interface ChannelSuggestion {
  type: 'channel';
  id: string;
  name: string;
  description: string | null;
  channelType: string;
  memberCount: number;
  unreadCount?: number;
  lastActivityAt: Date | null;
}

interface DMSuggestion {
  type: 'dm';
  id: string;
  name: string;
  participants: Array<{
    id: string;
    name: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  }>;
  lastMessageAt: Date | null;
  unreadCount?: number;
}

interface PersonSuggestion {
  type: 'person';
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  status: string;
  isOrchestrator: boolean;
  role?: string | null;
  discipline?: string | null;
}

interface FileSuggestion {
  type: 'file';
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // Converted from BigInt for JSON serialization
  thumbnailUrl: string | null;
  channelName?: string;
  uploadedAt: Date;
}

interface QuickAction {
  type: 'action';
  id: string;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
  path: string;
}

interface CommandPaletteSuggestions {
  recentChannels: ChannelSuggestion[];
  recentDMs: DMSuggestion[];
  recentPeople: PersonSuggestion[];
  recentFiles: FileSuggestion[];
  quickActions: QuickAction[];
}

/**
 * GET /api/workspaces/:workspaceSlug/command-palette
 *
 * Get personalized suggestions for the command palette.
 * Returns recent channels, DMs, people, files, and quick actions.
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
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const { workspaceSlug } = await context.params;

    // Parse optional limit parameters
    const searchParams = request.nextUrl.searchParams;
    const channelLimit = Math.min(parseInt(searchParams.get('channelLimit') || '5', 10), 10);
    const dmLimit = Math.min(parseInt(searchParams.get('dmLimit') || '5', 10), 10);
    const personLimit = Math.min(parseInt(searchParams.get('personLimit') || '5', 10), 10);
    const fileLimit = Math.min(parseInt(searchParams.get('fileLimit') || '3', 10), 10);

    // Get workspace by ID or slug
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', ORG_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch all data in parallel
    const [
      recentChannels,
      recentDMs,
      recentPeople,
      recentFiles,
      userRole,
    ] = await Promise.all([
      // Recent channels - based on user's channel memberships with recent activity
      prisma.channelMember.findMany({
        where: {
          userId: session.user.id,
          channel: {
            workspaceId: workspace.id,
            type: { in: ['PUBLIC', 'PRIVATE'] },
            isArchived: false,
          },
        },
        orderBy: [
          { channel: { updatedAt: 'desc' } },
        ],
        take: channelLimit,
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              updatedAt: true,
              _count: {
                select: {
                  channelMembers: true,
                },
              },
            },
          },
        },
      }),

      // Recent DMs - based on user's DM channels with recent messages
      prisma.channelMember.findMany({
        where: {
          userId: session.user.id,
          channel: {
            workspaceId: workspace.id,
            type: 'DM',
          },
        },
        orderBy: [
          { channel: { updatedAt: 'desc' } },
        ],
        take: dmLimit,
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              updatedAt: true,
              channelMembers: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true,
                      isOrchestrator: true,
                    },
                  },
                },
              },
              messages: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
              },
            },
          },
        },
      }),

      // Recent people - people the user has interacted with (sent messages to)
      prisma.message.findMany({
        where: {
          authorId: session.user.id,
          channel: {
            workspaceId: workspace.id,
          },
        },
        distinct: ['channelId'],
        orderBy: { createdAt: 'desc' },
        take: 20, // Get more to filter
        include: {
          channel: {
            select: {
              type: true,
              channelMembers: {
                where: {
                  userId: { not: session.user.id },
                },
                take: 1,
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      displayName: true,
                      email: true,
                      avatarUrl: true,
                      status: true,
                      isOrchestrator: true,
                      orchestrator: {
                        select: {
                          role: true,
                          discipline: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Recent files - files from channels the user is a member of
      prisma.file.findMany({
        where: {
          workspaceId: workspace.id,
          messageAttachments: {
            some: {
              message: {
                channel: {
                  channelMembers: {
                    some: {
                      userId: session.user.id,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: fileLimit,
        include: {
          messageAttachments: {
            take: 1,
            include: {
              message: {
                include: {
                  channel: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Get user's role for quick actions
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: workspace.organizationId,
            userId: session.user.id,
          },
        },
        select: { role: true },
      }),
    ]);

    // Transform recent channels
    const transformedChannels: ChannelSuggestion[] = recentChannels.map((cm) => ({
      type: 'channel' as const,
      id: cm.channel.id,
      name: cm.channel.name,
      description: cm.channel.description,
      channelType: cm.channel.type,
      memberCount: cm.channel._count.channelMembers,
      lastActivityAt: cm.channel.updatedAt,
    }));

    // Transform recent DMs
    const transformedDMs: DMSuggestion[] = recentDMs.map((cm) => ({
      type: 'dm' as const,
      id: cm.channel.id,
      name: cm.channel.name,
      participants: cm.channel.channelMembers
        .filter((m) => m.userId !== session.user.id)
        .map((m) => ({
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          isOrchestrator: m.user.isOrchestrator,
        })),
      lastMessageAt: cm.channel.messages[0]?.createdAt ?? null,
    }));

    // Transform recent people (deduplicate and limit)
    const seenPeople = new Set<string>();
    const transformedPeople: PersonSuggestion[] = [];

    for (const message of recentPeople) {
      if (message.channel.type !== 'DM') continue;

      for (const member of message.channel.channelMembers) {
        if (seenPeople.has(member.user.id)) continue;
        if (transformedPeople.length >= personLimit) break;

        seenPeople.add(member.user.id);
        transformedPeople.push({
          type: 'person' as const,
          id: member.user.id,
          name: member.user.name,
          displayName: member.user.displayName,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          status: member.user.status,
          isOrchestrator: member.user.isOrchestrator,
          role: member.user.orchestrator?.role,
          discipline: member.user.orchestrator?.discipline,
        });
      }
    }

    // Transform recent files
    const transformedFiles: FileSuggestion[] = recentFiles.map((file) => ({
      type: 'file' as const,
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size), // Convert BigInt to Number for JSON serialization
      thumbnailUrl: file.thumbnailUrl,
      channelName: file.messageAttachments[0]?.message?.channel?.name,
      uploadedAt: file.createdAt,
    }));

    // Build quick actions based on user role
    const isAdmin = userRole?.role === 'OWNER' || userRole?.role === 'ADMIN';

    const quickActions: QuickAction[] = [
      {
        type: 'action',
        id: 'new-message',
        label: 'New message',
        description: 'Start a new conversation',
        icon: 'message-square-plus',
        shortcut: '⌘N',
        path: `/${workspaceSlug}/messages/new`,
      },
      {
        type: 'action',
        id: 'browse-channels',
        label: 'Browse channels',
        description: 'Find and join channels',
        icon: 'hash',
        shortcut: '⌘⇧C',
        path: `/${workspaceSlug}/channels`,
      },
      {
        type: 'action',
        id: 'search-messages',
        label: 'Search messages',
        description: 'Search all messages',
        icon: 'search',
        shortcut: '⌘F',
        path: `/${workspaceSlug}/search`,
      },
    ];

    // Add admin actions
    if (isAdmin) {
      quickActions.push(
        {
          type: 'action',
          id: 'create-channel',
          label: 'Create channel',
          description: 'Create a new channel',
          icon: 'plus-circle',
          path: `/${workspaceSlug}/channels/new`,
        },
        {
          type: 'action',
          id: 'invite-people',
          label: 'Invite people',
          description: 'Invite people to workspace',
          icon: 'user-plus',
          path: `/${workspaceSlug}/settings/members`,
        },
        {
          type: 'action',
          id: 'workspace-settings',
          label: 'Workspace settings',
          description: 'Manage workspace settings',
          icon: 'settings',
          shortcut: '⌘,',
          path: `/${workspaceSlug}/settings`,
        },
      );
    }

    const response: CommandPaletteSuggestions = {
      recentChannels: transformedChannels,
      recentDMs: transformedDMs,
      recentPeople: transformedPeople,
      recentFiles: transformedFiles,
      quickActions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/command-palette] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORG_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
