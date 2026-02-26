/**
 * OrchestratorChannel Membership API Routes
 *
 * Handles Orchestrator channel membership operations including listing channels,
 * auto-joining relevant channels, and leaving channels with reason tracking.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels - Get channels Orchestrator is member of
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels - Auto-join Orchestrator to relevant channels
 * - DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels - Leave channel with reason
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/channels/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getRecommendedChannels,
  calculateChannelRelevance,
} from '@/lib/services/channel-intelligence-service';
import {
  vpChannelFiltersSchema,
  autoJoinChannelsSchema,
  leaveChannelSchema,
  createChannelIntelligenceError,
  CHANNEL_INTELLIGENCE_ERROR_CODES,
} from '@/lib/validations/channel-intelligence';
import {
  ORCHESTRATOR_ERROR_CODES,
  createErrorResponse,
} from '@/lib/validations/orchestrator';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Helper function to verify Orchestrator workspace access
 */
async function getOrchestratorWithWorkspaceAccess(
  workspaceId: string,
  orchestratorId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

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
        },
      },
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role, workspace };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels
 *
 * Get list of channels the Orchestrator is a member of.
 *
 * Query Parameters:
 * - includeArchived: boolean (default: false)
 * - channelType: PUBLIC | PRIVATE | DM | HUDDLE
 * - activeOnly: boolean (default: true)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and OrchestratorIDs
 * @returns List of channels with membership details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const result = await getOrchestratorWithWorkspaceAccess(
      workspaceId,
      orchestratorId,
      session.user.id
    );
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Orchestrator not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = vpChannelFiltersSchema.parse(searchParams);

    // Fetch channel memberships
    const where = {
      userId: result.orchestrator.user.id,
      ...(filters.activeOnly && { leftAt: null }),
      channel: {
        workspaceId,
        ...(filters.channelType && { type: filters.channelType }),
        ...(!filters.includeArchived && { isArchived: false }),
      },
    };

    const [memberships, total] = await Promise.all([
      prisma.channelMember.findMany({
        where,
        include: {
          channel: true,
        },
        orderBy: { joinedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.channelMember.count({ where }),
    ]);

    // Get member and message counts for each channel
    const channelIds = memberships.map(m => m.channelId);
    const channelCounts = await Promise.all(
      channelIds.map(async channelId => {
        const [memberCount, messageCount] = await Promise.all([
          prisma.channelMember.count({
            where: { channelId, leftAt: null },
          }),
          prisma.message.count({ where: { channelId } }),
        ]);
        return { channelId, memberCount, messageCount };
      })
    );

    const countMap = new Map(channelCounts.map(c => [c.channelId, c]));

    // Format response
    const channels = memberships.map(membership => {
      const counts = countMap.get(membership.channelId) || {
        memberCount: 0,
        messageCount: 0,
      };
      return {
        channelId: membership.channel.id,
        channelName: membership.channel.name,
        channelSlug: membership.channel.slug,
        channelDescription: membership.channel.description,
        channelType: membership.channel.type,
        isArchived: membership.channel.isArchived,
        memberCount: counts.memberCount,
        messageCount: counts.messageCount,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
        lastReadAt: membership.lastReadAt?.toISOString() ?? null,
        leftAt: membership.leftAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      data: channels,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels] Error:',
      error
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'An internal error occurred',
        CHANNEL_INTELLIGENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels
 *
 * Auto-join Orchestrator to discipline-relevant channels based on relevance scoring.
 *
 * Request Body:
 * - minRelevanceScore: number (0-1, default: 0.7)
 * - maxChannels: number (default: 5, max: 20)
 * - explicitChannelIds: string[] (optional)
 * - excludeChannelIds: string[] (optional)
 *
 * @param request - Next.js request with auto-join options
 * @param context - Route context with workspace and OrchestratorIDs
 * @returns List of channels joined
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const result = await getOrchestratorWithWorkspaceAccess(
      workspaceId,
      orchestratorId,
      session.user.id
    );
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Orchestrator not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid JSON body',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const options = autoJoinChannelsSchema.parse(body);

    // Get recommended channels
    const recommendations = await getRecommendedChannels(orchestratorId, {
      minScore: options.minRelevanceScore,
      limit: options.maxChannels,
      excludeJoined: true,
    });

    // Combine with explicit channels
    const channelsToJoin = [
      ...new Set([
        ...recommendations.map(r => r.id),
        ...options.explicitChannelIds,
      ]),
    ].filter(id => !options.excludeChannelIds.includes(id));

    // Join channels
    const joinedChannels = [];
    for (const channelId of channelsToJoin.slice(0, options.maxChannels)) {
      try {
        // Check if already a member
        const existingMembership = await prisma.channelMember.findFirst({
          where: {
            channelId,
            userId: result.orchestrator.user.id,
            leftAt: null,
          },
        });

        if (existingMembership) {
          continue; // Skip if already a member
        }

        // Calculate relevance for logging
        const relevance = await calculateChannelRelevance(
          orchestratorId,
          channelId
        );

        // Create membership
        const membership = await prisma.channelMember.create({
          data: {
            channelId,
            userId: result.orchestrator.user.id,
            role: 'MEMBER',
          },
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                type: true,
              },
            },
          },
        });

        joinedChannels.push({
          ...membership.channel,
          relevanceScore: relevance.score,
          reasoning: relevance.explanation,
        });
      } catch (error) {
        console.error(`Failed to join channel ${channelId}:`, error);
        // Continue with other channels
      }
    }

    return NextResponse.json({
      data: joinedChannels,
      message: `Successfully joined ${joinedChannels.length} channel(s)`,
      meta: {
        requested: channelsToJoin.length,
        joined: joinedChannels.length,
      },
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels] Error:',
      error
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'Auto-join failed',
        CHANNEL_INTELLIGENCE_ERROR_CODES.AUTO_JOIN_FAILED
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels
 *
 * Leave a channel with optional reason tracking.
 *
 * Query Parameters:
 * - channelId: string (required)
 *
 * Request Body:
 * - reason: string (optional, max 500 chars)
 * - isTemporary: boolean (default: false)
 *
 * @param request - Next.js request with leave reason
 * @param context - Route context with workspace and OrchestratorIDs
 * @returns Success confirmation
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    const channelId = request.nextUrl.searchParams.get('channelId');

    if (!workspaceId || !orchestratorId || !channelId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const result = await getOrchestratorWithWorkspaceAccess(
      workspaceId,
      orchestratorId,
      session.user.id
    );
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Orchestrator not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {}; // Allow empty body
    }

    const leaveData = leaveChannelSchema.parse(body);

    // Update channel membership
    const membership = await prisma.channelMember.updateMany({
      where: {
        channelId,
        userId: result.orchestrator.user.id,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    if (membership.count === 0) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Not a member of this channel',
          CHANNEL_INTELLIGENCE_ERROR_CODES.NOT_MEMBER
        ),
        { status: 404 }
      );
    }

    // Log leave reason if provided
    if (leaveData.reason) {
      console.log(
        `[OrchestratorChannel Leave] Orchestrator:${orchestratorId} Channel:${channelId} Reason:${leaveData.reason} Temporary:${leaveData.isTemporary}`
      );
    }

    return NextResponse.json({
      message: 'Successfully left channel',
      data: {
        channelId,
        leftAt: new Date().toISOString(),
        reason: leaveData.reason,
        isTemporary: leaveData.isTemporary,
      },
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/channels] Error:',
      error
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'An internal error occurred',
        CHANNEL_INTELLIGENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
