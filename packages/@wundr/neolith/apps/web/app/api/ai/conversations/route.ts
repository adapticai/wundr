/**
 * AI Conversations API Route
 *
 * Handles listing and creating AI chat conversations.
 * Conversations are stored as special DM channels with metadata in settings field.
 *
 * Routes:
 * - GET /api/ai/conversations - List AI conversations by workspace
 * - POST /api/ai/conversations - Create a new AI conversation
 *
 * @module app/api/ai/conversations/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  CreateAIConversationInput,
  AIConversationFilters,
  AIConversation,
  AIConversationMetadata,
} from '@/types/ai-conversation';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

const AI_CHANNEL_PREFIX = 'ai-chat';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  return { workspace, workspaceMembership };
}

/**
 * Transform channel to AI conversation
 */
function transformToAIConversation(
  channel: any,
  userId: string
): AIConversation {
  const settings = (channel.settings as Record<string, unknown>) || {};
  const metadata = (settings.aiMetadata as AIConversationMetadata) || {};

  return {
    id: channel.id,
    title: metadata.title || 'New Conversation',
    workspaceId: channel.workspaceId,
    createdById: channel.createdById || userId,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    metadata: metadata,
    isPinned: metadata.isPinned || false,
    isArchived: metadata.isArchived || false,
    hasAccess: true,
  };
}

/**
 * GET /api/ai/conversations
 *
 * List AI conversations for a workspace.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of AI conversations
 *
 * @example
 * ```
 * GET /api/ai/conversations?workspaceId=ws_123&page=1&limit=20
 * GET /api/ai/conversations?workspaceId=ws_123&search=typescript&pinnedOnly=true
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters: AIConversationFilters = {
      workspaceId: searchParams.workspaceId,
      search: searchParams.search,
      tags: searchParams.tags ? searchParams.tags.split(',') : undefined,
      pinnedOnly: searchParams.pinnedOnly === 'true',
      archivedOnly: searchParams.archivedOnly === 'true',
      includeArchived: searchParams.includeArchived === 'true',
      page: searchParams.page ? parseInt(searchParams.page) : 1,
      limit: searchParams.limit ? parseInt(searchParams.limit) : 20,
      sortBy: (searchParams.sortBy as any) || 'updatedAt',
      sortOrder: (searchParams.sortOrder as any) || 'desc',
    };

    // Workspace ID is required
    if (!filters.workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'workspaceId is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(
      filters.workspaceId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Build where clause for AI conversation channels
    // AI conversations are DM channels with name starting with ai-chat prefix
    const where: Prisma.channelWhereInput = {
      workspaceId: filters.workspaceId,
      type: 'DM',
      name: { startsWith: AI_CHANNEL_PREFIX },
      channelMembers: {
        some: { userId: session.user.id },
      },
    };

    // Apply search filter on title in metadata
    if (filters.search) {
      // Note: Prisma doesn't support JSON field text search well, so we fetch all and filter in memory
      // For production, consider using PostgreSQL full-text search or a search engine
    }

    // Calculate pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    // Build orderBy
    const sortBy = (filters.sortBy ||
      'updatedAt') as keyof Prisma.channelOrderByWithRelationInput;
    const orderBy: Prisma.channelOrderByWithRelationInput = {
      [sortBy]: filters.sortOrder,
    };

    // Fetch channels and total count
    const [channels, totalCount] = await Promise.all([
      prisma.channel.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      prisma.channel.count({ where }),
    ]);

    // Transform to AI conversations and apply filters
    let conversations = channels.map(channel =>
      transformToAIConversation(channel, session.user.id)
    );

    // Apply in-memory filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      conversations = conversations.filter(
        conv =>
          conv.title.toLowerCase().includes(searchLower) ||
          conv.metadata.tags?.some(tag =>
            tag.toLowerCase().includes(searchLower)
          )
      );
    }

    if (filters.pinnedOnly) {
      conversations = conversations.filter(conv => conv.isPinned);
    }

    if (filters.archivedOnly) {
      conversations = conversations.filter(conv => conv.isArchived);
    } else if (!filters.includeArchived) {
      conversations = conversations.filter(conv => !conv.isArchived);
    }

    if (filters.tags && filters.tags.length > 0) {
      conversations = conversations.filter(conv =>
        filters.tags!.some(tag => conv.metadata.tags?.includes(tag))
      );
    }

    // Calculate pagination metadata
    const filteredCount = conversations.length;
    const totalPages = Math.ceil(filteredCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      data: conversations,
      pagination: {
        page,
        limit,
        totalCount: filteredCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/conversations] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/conversations
 *
 * Create a new AI conversation.
 *
 * @param request - Next.js request with conversation data
 * @returns Created AI conversation object
 *
 * @example
 * ```
 * POST /api/ai/conversations
 * Content-Type: application/json
 *
 * {
 *   "workspaceId": "ws_123",
 *   "title": "TypeScript Help",
 *   "systemPrompt": "You are a TypeScript expert",
 *   "initialMessage": "How do I use generics?",
 *   "model": "gpt-4o-mini",
 *   "tags": ["typescript", "programming"]
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: CreateAIConversationInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const {
      workspaceId,
      title,
      systemPrompt,
      initialMessage,
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 4096,
      tags = [],
    } = body;

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'workspaceId is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Generate unique channel name
    const channelName = `${AI_CHANNEL_PREFIX}:${Date.now()}:${session.user.id}`;
    const slug = channelName.replace(/:/g, '-');

    // Prepare metadata
    const metadata: AIConversationMetadata = {
      title: title || 'New Conversation',
      model,
      systemPrompt,
      temperature,
      maxTokens,
      tags,
      isPinned: false,
      isArchived: false,
      messageCount: 0,
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
    };

    // Create conversation channel with messages in a transaction
    const conversation = await prisma.$transaction(async tx => {
      // Create the channel
      const channel = await tx.channel.create({
        data: {
          name: channelName,
          slug,
          type: 'DM',
          description: `AI Conversation: ${metadata.title}`,
          workspaceId,
          createdById: session.user.id,
          settings: {
            aiMetadata: metadata as unknown as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
        },
      });

      // Add user as channel member
      await tx.channelMember.create({
        data: {
          channelId: channel.id,
          userId: session.user.id,
          role: 'OWNER',
        },
      });

      // Create system message if system prompt provided
      if (systemPrompt) {
        await tx.message.create({
          data: {
            channelId: channel.id,
            authorId: session.user.id,
            content: systemPrompt,
            type: 'SYSTEM',
            metadata: {
              role: 'system',
              model,
            },
          },
        });
      }

      // Create initial user message if provided
      if (initialMessage) {
        await tx.message.create({
          data: {
            channelId: channel.id,
            authorId: session.user.id,
            content: initialMessage,
            type: 'TEXT',
            metadata: {
              role: 'user',
              model,
            },
          },
        });

        // Update message count
        metadata.messageCount = systemPrompt ? 2 : 1;
        metadata.lastMessagePreview = initialMessage.substring(0, 100);

        await tx.channel.update({
          where: { id: channel.id },
          data: {
            settings: {
              aiMetadata: metadata as unknown as Prisma.InputJsonValue,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return channel;
    });

    const aiConversation = transformToAIConversation(
      conversation,
      session.user.id
    );

    return NextResponse.json(
      {
        data: aiConversation,
        message: 'AI conversation created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/ai/conversations] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
