/**
 * OrchestratorMentions API Route
 *
 * Allows VPs to fetch and manage their @mentions in channels.
 * Supports filtering by channel, handled status, and date range.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions - Get Orchestrator mentions
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions - Mark mentions as handled
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/mentions/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type {
  MarkMentionsHandledInput,
  OrchestratorMentionsFiltersInput,
} from '@/lib/validations/orchestrator-conversation';
import {
  createErrorResponse,
  markMentionsHandledSchema,
  ORCHESTRATOR_CONVERSATION_ERROR_CODES,
  orchestratorMentionsFiltersSchema,
} from '@/lib/validations/orchestrator-conversation';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions
 *
 * Get @mentions for this Orchestrator with filtering and pagination.
 * - Searches message content for @mentions
 * - Filters by channel, handled status, date range
 * - Returns messages with mention context
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Paginated list of mentions
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (Orchestrator service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate filters
    const parseResult = orchestratorMentionsFiltersSchema.safeParse(queryParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: OrchestratorMentionsFiltersInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify Orchestrator exists and belongs to this workspace/organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: workspace.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the authenticated user is the Orchestrator's user account
    if (orchestrator.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Unauthorized: You can only access mentions for your own Orchestrator',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Build mention search patterns
    const mentionPatterns = [
      `@${orchestrator.user.name}`,
      `@${orchestrator.user.displayName || orchestrator.user.name}`,
      `@${orchestrator.user.email.split('@')[0]}`, // Handle email prefix mentions
    ];

    // Build where clause
    const whereClause: Record<string, unknown> = {
      channel: {
        workspaceId,
      },
      OR: mentionPatterns.map((pattern) => ({
        content: {
          contains: pattern,
        },
      })),
      deletedAt: null,
    };

    // Apply filters
    if (filters.channelId) {
      whereClause.channelId = filters.channelId;
    }

    if (filters.from || filters.to) {
      whereClause.createdAt = {};
      if (filters.from) {
        (whereClause.createdAt as Record<string, unknown>).gte = filters.from;
      }
      if (filters.to) {
        (whereClause.createdAt as Record<string, unknown>).lte = filters.to;
      }
    }

    // Apply handled status filter via metadata
    if (filters.handled !== undefined) {
      if (filters.handled) {
        whereClause.metadata = {
          path: ['vpMention', 'handled'],
          equals: true,
        };
      } else if (!filters.includeResolved) {
        whereClause.OR = [
          { metadata: { path: ['vpMention', 'handled'], equals: false } },
          { metadata: { path: ['vpMention'], equals: null } },
        ];
      }
    }

    // Get total count
    const totalCount = await prisma.message.count({
      where: whereClause as Record<string, unknown>,
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / filters.limit);
    const skip = (filters.page - 1) * filters.limit;

    // Fetch mentions
    const mentions = await prisma.message.findMany({
      where: whereClause as Record<string, unknown>,
      orderBy: {
        [filters.sortBy]: filters.sortOrder,
      },
      skip,
      take: filters.limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        parent: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Format mentions with handled status from metadata
    const formattedMentions = mentions.map((mention) => {
      const metadata = mention.metadata as Record<string, unknown> | null;
      const vpMentionData = metadata?.orchestratorMention as Record<string, unknown> | undefined;

      return {
        id: mention.id,
        content: mention.content,
        createdAt: mention.createdAt,
        author: mention.author,
        channel: mention.channel,
        parent: mention.parent,
        handled: vpMentionData?.handled === true,
        handledAt: vpMentionData?.handledAt || null,
        handledNote: vpMentionData?.note || null,
      };
    });

    return NextResponse.json({
      data: formattedMentions,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions
 *
 * Mark Orchestrator mentions as handled or unhandled.
 * - Updates mention metadata with handled status
 * - Optionally includes resolution note
 * - Supports bulk operations
 *
 * @param request - Next.js request with mention IDs and status
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Updated mention count
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (Orchestrator service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = markMentionsHandledSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: MarkMentionsHandledInput = parseResult.data;

    // Verify workspace and Orchestrator (same as GET)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: workspace.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      include: {
        user: { select: { id: true } },
      },
    });

    if (!orchestrator || orchestrator.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify mentions exist and belong to this workspace
    const mentions = await prisma.message.findMany({
      where: {
        id: { in: input.mentionIds },
        channel: {
          workspaceId,
        },
      },
    });

    if (mentions.length !== input.mentionIds.length) {
      return NextResponse.json(
        createErrorResponse(
          'One or more mentions not found',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Update mentions with handled status
    const updateResults = await Promise.all(
      mentions.map((mention) => {
        const existingMetadata = (mention.metadata as Record<string, unknown>) || {};

        return prisma.message.update({
          where: { id: mention.id },
          data: {
            metadata: {
              ...existingMetadata,
              vpMention: {
                handled: input.handled,
                handledAt: input.handled ? new Date().toISOString() : null,
                note: input.note,
              },
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }),
    );

    return NextResponse.json({
      data: {
        updatedCount: updateResults.length,
        mentionIds: updateResults.map((m) => m.id),
        handled: input.handled,
      },
      message: `${updateResults.length} mention(s) marked as ${input.handled ? 'handled' : 'unhandled'}`,
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/mentions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
