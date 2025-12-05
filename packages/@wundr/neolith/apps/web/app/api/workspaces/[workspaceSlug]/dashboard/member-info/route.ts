/**
 * Dashboard Member Info API Route
 *
 * Provides personalized onboarding and activity information for workspace members.
 * Generates dynamic checklists, suggestions, and activity feed based on user's progress.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/dashboard/member-info - Get member dashboard info
 *
 * @module app/api/workspaces/[workspaceSlug]/dashboard/member-info/route
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
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Onboarding checklist item
 */
interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  href?: string;
}

/**
 * Suggested channel
 */
interface SuggestedChannel {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

/**
 * Recommended orchestrator
 */
interface RecommendedOrchestrator {
  id: string;
  name: string;
  description: string;
  category: string;
}

/**
 * Team member spotlight
 */
interface TeamMember {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

/**
 * Member dashboard data
 */
interface MemberDashboardData {
  isNewMember: boolean;
  joinedDate: string;
  checklist: ChecklistItem[];
  suggestedChannels: SuggestedChannel[];
  recommendedOrchestrators: RecommendedOrchestrator[];
  teamSpotlight: TeamMember[];
}

/**
 * Helper function to check workspace access
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  // Try to find workspace by slug
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    include: {
      organization: true,
    },
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
  });

  if (!orgMembership) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * Generate onboarding checklist based on user's actual progress
 */
async function generateChecklist(
  userId: string,
  workspaceId: string,
  workspaceSlug: string
): Promise<ChecklistItem[]> {
  // Fetch user profile completeness
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      avatarUrl: true,
      bio: true,
    },
  });

  // Check if user has joined any channels
  const channelMemberships = await prisma.channelMember.count({
    where: {
      userId,
      channel: {
        workspaceId,
      },
      leftAt: null,
    },
  });

  // Check if user has sent any messages
  const messageCount = await prisma.message.count({
    where: {
      authorId: userId,
      channel: {
        workspaceId,
      },
      isDeleted: false,
    },
  });

  // Check if user has interacted with orchestrators
  const orchestratorInteractions = await prisma.message.count({
    where: {
      authorId: userId,
      author: {
        isOrchestrator: false,
      },
      channel: {
        workspaceId,
        channelMembers: {
          some: {
            user: {
              isOrchestrator: true,
            },
          },
        },
      },
    },
  });

  const checklist: ChecklistItem[] = [
    {
      id: '1',
      label: 'Complete your profile',
      completed: !!(user?.name && user?.avatarUrl),
      href: '/profile',
    },
    {
      id: '2',
      label: 'Join your first channel',
      completed: channelMemberships > 0,
      href: `/${workspaceSlug}/channels`,
    },
    {
      id: '3',
      label: 'Send your first message',
      completed: messageCount > 0,
    },
    {
      id: '4',
      label: 'Explore orchestrators',
      completed: orchestratorInteractions > 0,
      href: `/${workspaceSlug}/orchestrators`,
    },
  ];

  return checklist;
}

/**
 * Get suggested channels for the user
 */
async function getSuggestedChannels(
  userId: string,
  workspaceId: string
): Promise<SuggestedChannel[]> {
  // Get channels user hasn't joined yet
  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      isArchived: false,
      type: 'PUBLIC', // Only suggest public channels
      NOT: {
        channelMembers: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          channelMembers: true,
        },
      },
    },
    orderBy: {
      channelMembers: {
        _count: 'desc',
      },
    },
    take: 3,
  });

  return channels.map(channel => ({
    id: channel.id,
    name: channel.name,
    description: channel.description || 'No description available',
    memberCount: channel._count.channelMembers,
  }));
}

/**
 * Get recommended orchestrators based on workspace
 */
async function getRecommendedOrchestrators(
  workspaceId: string,
  userId: string
): Promise<RecommendedOrchestrator[]> {
  // Get orchestrators in the workspace that user hasn't interacted with much
  const orchestrators = await prisma.orchestrator.findMany({
    where: {
      workspaceId,
      status: { not: 'OFFLINE' },
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    take: 2,
  });

  return orchestrators.map(orch => ({
    id: orch.id,
    name: orch.user.name || `${orch.role} Orchestrator`,
    description: `${orch.role} - ${orch.discipline}`,
    category: orch.discipline,
  }));
}

/**
 * Get team spotlight - featured team members
 */
async function getTeamSpotlight(
  workspaceId: string,
  userId: string
): Promise<TeamMember[]> {
  // Get workspace members who are active, excluding the current user and orchestrators
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      userId: { not: userId },
      user: {
        isOrchestrator: false,
        status: 'ACTIVE',
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          lastActiveAt: true,
        },
      },
    },
    orderBy: {
      user: {
        lastActiveAt: 'desc',
      },
    },
    take: 4,
  });

  return members.map(member => ({
    id: member.user.id,
    name: member.user.name || 'Unknown User',
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
    role: member.role,
  }));
}

/**
 * GET /api/workspaces/:workspaceSlug/dashboard/member-info
 *
 * Get personalized member dashboard information including:
 * - Onboarding checklist with actual progress
 * - Suggested channels to join
 * - Recommended orchestrators
 * - Team spotlight
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns Member dashboard data
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Get workspace slug parameter
    const { workspaceSlug } = await context.params;

    // Check access (resolves slug or ID to workspace)
    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const workspaceId = access.workspace.id;
    const workspaceSlugResolved = access.workspace.slug;

    // Determine if user is a new member (joined within last 7 days)
    const joinedDate = access.workspaceMembership?.joinedAt || new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isNewMember = joinedDate > sevenDaysAgo;

    // Fetch all data in parallel for performance
    const [
      checklist,
      suggestedChannels,
      recommendedOrchestrators,
      teamSpotlight,
    ] = await Promise.all([
      generateChecklist(session.user.id, workspaceId, workspaceSlugResolved),
      getSuggestedChannels(session.user.id, workspaceId),
      getRecommendedOrchestrators(workspaceId, session.user.id),
      getTeamSpotlight(workspaceId, session.user.id),
    ]);

    const data: MemberDashboardData = {
      isNewMember,
      joinedDate: joinedDate.toISOString(),
      checklist,
      suggestedChannels,
      recommendedOrchestrators,
      teamSpotlight,
    };

    return NextResponse.json({
      data,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/dashboard/member-info] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
