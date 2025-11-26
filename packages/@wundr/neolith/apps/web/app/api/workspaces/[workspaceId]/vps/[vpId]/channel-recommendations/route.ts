/**
 * VP Channel Recommendations API Routes
 *
 * Provides personalized channel recommendations for VPs based on
 * discipline, expertise, and relevance scoring. Excludes channels
 * the VP is already a member of.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/channel-recommendations
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/channel-recommendations/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getRecommendedChannels } from '@/lib/services/channel-intelligence-service';
import {
  channelRecommendationFiltersSchema,
  createChannelIntelligenceError,
  CHANNEL_INTELLIGENCE_ERROR_CODES,
} from '@/lib/validations/channel-intelligence';
import { VP_ERROR_CODES, createErrorResponse } from '@/lib/validations/vp';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to verify VP workspace access
 */
async function getVPWithWorkspaceAccess(
  workspaceId: string,
  vpId: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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

  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
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

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role, workspace };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/channel-recommendations
 *
 * Get recommended channels for a VP based on discipline/expertise.
 * Returns channels with relevance scores and reasoning, excluding
 * channels the VP is already a member of.
 *
 * Query Parameters:
 * - minScore: number (0-1, default: 0.5)
 * - limit: number (default: 10, max: 50)
 * - includePreviouslyLeft: boolean (default: false)
 * - channelType: PUBLIC | PRIVATE | DM | HUDDLE
 * - recentActivityDays: number (max: 90)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and VP IDs
 * @returns Sorted list of recommended channels with scores
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'VP not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = channelRecommendationFiltersSchema.parse(searchParams);

    // Get current memberships to exclude
    const currentMemberships = await prisma.channelMember.findMany({
      where: {
        userId: result.vp.user.id,
        ...(filters.includePreviouslyLeft ? {} : { leftAt: null }),
      },
      select: { channelId: true },
    });

    const excludeChannelIds = currentMemberships.map((m) => m.channelId);

    // Get base recommendations
    const baseRecommendations = await getRecommendedChannels(vpId, {
      minScore: filters.minScore,
      limit: filters.limit * 2, // Get more initially for filtering
      excludeJoined: true,
      channelType: filters.channelType,
    });

    // Apply additional filters
    let recommendations = baseRecommendations.filter(
      (rec) => !excludeChannelIds.includes(rec.id),
    );

    // Filter by recent activity if specified
    if (filters.recentActivityDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.recentActivityDays);

      const channelIds = recommendations.map((r) => r.id);
      const activeChannels = await prisma.channel.findMany({
        where: {
          id: { in: channelIds },
          messages: {
            some: {
              createdAt: { gte: cutoffDate },
            },
          },
        },
        select: { id: true },
      });

      const activeChannelIds = new Set(activeChannels.map((c) => c.id));
      recommendations = recommendations.filter((rec) => activeChannelIds.has(rec.id));
    }

    // Limit to requested count
    recommendations = recommendations.slice(0, filters.limit);

    // Format response
    const formattedRecommendations = recommendations.map((rec) => ({
      channelId: rec.id,
      channelName: rec.name,
      channelSlug: rec.slug,
      channelDescription: rec.description,
      channelType: rec.type,
      isArchived: rec.isArchived,
      memberCount: rec.memberCount,
      recentActivityCount: rec.recentActivityCount,
      relevanceScore: rec.relevanceScore,
      reasoning: rec.reasoning,
    }));

    return NextResponse.json({
      data: formattedRecommendations,
      meta: {
        count: formattedRecommendations.length,
        minScore: filters.minScore,
        vpDiscipline: result.vp.discipline,
        vpRole: result.vp.role,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/vps/:vpId/channel-recommendations] Error:',
      error,
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'An internal error occurred',
        CHANNEL_INTELLIGENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
