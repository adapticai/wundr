/**
 * Channel Relevance Calculation API Routes
 *
 * Calculates relevance scores between Orchestrators and channels based on
 * discipline match, role alignment, member similarity, and activity.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId/relevance
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/relevance/route
 */

import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { calculateChannelRelevance } from '@/lib/services/channel-intelligence-service';
import {
  CHANNEL_INTELLIGENCE_ERROR_CODES,
  calculateRelevanceSchema,
  createChannelIntelligenceError,
} from '@/lib/validations/channel-intelligence';

/**
 * Route context with workspace and channel ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; channelId: string }>;
}

/**
 * Helper function to verify workspace access
 */
async function getWorkspaceAccess(workspaceId: string, userId: string) {
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

  return { workspace, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/relevance
 *
 * Calculate relevance score between a Orchestrator and channel.
 * Returns a score (0-1) and detailed explanation of the calculation.
 *
 * Query Parameters:
 * - orchestratorId: string (required) - Orchestrator to calculate relevance for
 * - disciplineOverride: string (optional) - Override Orchestrator discipline
 * - includeExplanation: boolean (default: true)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and channel IDs
 * @returns Relevance score, explanation, and breakdown factors
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createChannelIntelligenceError('Authentication required', CHANNEL_INTELLIGENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, channelId } = params;

    if (!workspaceId || !channelId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify workspace access
    const workspaceAccess = await getWorkspaceAccess(workspaceId, session.user.id);
    if (!workspaceAccess) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Workspace not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryData = calculateRelevanceSchema.parse(searchParams);

    const { orchestratorId, disciplineOverride, includeExplanation } = queryData;

    // Verify Orchestrator exists and has access to workspace
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: workspaceAccess.workspace.organizationId,
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
        disciplineRef: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Orchestrator not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify channel exists and is in workspace
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        workspaceId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        type: true,
        topic: true,
        isArchived: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Channel not found in workspace',
          CHANNEL_INTELLIGENCE_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Calculate relevance
    const relevance = await calculateChannelRelevance(orchestratorId, channelId);

    // Build response
    const response: {
      channelId: string;
      channelName: string;
      channelType: string;
      orchestratorId: string;
      orchestratorDiscipline: string;
      orchestratorRole: string;
      relevanceScore: number;
      explanation?: string;
      factors?: {
        disciplineMatch: number;
        roleMatch: number;
        memberSimilarity: number;
        activityLevel: number;
        channelAge: number;
      };
      recommendation?: string;
    } = {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      orchestratorId: orchestrator.id,
      orchestratorDiscipline: disciplineOverride || orchestrator.discipline,
      orchestratorRole: orchestrator.role,
      relevanceScore: relevance.score,
    };

    if (includeExplanation) {
      response.explanation = relevance.explanation;
      response.factors = relevance.factors;

      // Add recommendation based on score
      if (relevance.score >= 0.8) {
        response.recommendation = 'Highly relevant - strongly recommend joining';
      } else if (relevance.score >= 0.6) {
        response.recommendation = 'Relevant - recommend joining';
      } else if (relevance.score >= 0.4) {
        response.recommendation = 'Somewhat relevant - may be worth exploring';
      } else {
        response.recommendation = 'Low relevance - not recommended';
      }
    }

    return NextResponse.json({
      data: response,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId/relevance] Error:',
      error,
    );

    // Handle specific calculation errors
    if (error instanceof Error) {
      if (error.message.includes('Orchestrator not found')) {
        return NextResponse.json(
          createChannelIntelligenceError(
            error.message,
            CHANNEL_INTELLIGENCE_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (error.message.includes('Channel not found')) {
        return NextResponse.json(
          createChannelIntelligenceError(
            error.message,
            CHANNEL_INTELLIGENCE_ERROR_CODES.CHANNEL_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createChannelIntelligenceError(
        'Relevance calculation failed',
        CHANNEL_INTELLIGENCE_ERROR_CODES.CALCULATION_ERROR,
      ),
      { status: 500 },
    );
  }
}
