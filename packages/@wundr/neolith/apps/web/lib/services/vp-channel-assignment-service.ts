/**
 * VP Channel Assignment Service
 *
 * Manages VP assignment to channels based on discipline, activity patterns,
 * and intelligent recommendations.
 *
 * @module lib/services/vp-channel-assignment-service
 */

import { prisma } from '@neolith/database';

import {
  autoJoinVPToChannel,
  getRelevantChannels,
  type ChannelRelevance,
} from './channel-intelligence-service';

// =============================================================================
// TYPES
// =============================================================================

export interface AssignmentResult {
  success: boolean;
  vpId: string;
  assignedChannels: string[];
  failedChannels: Array<{ channelId: string; error: string }>;
  totalAssigned: number;
}

export interface ChannelRecommendation extends ChannelRelevance {
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  autoJoinRecommended: boolean;
}

export interface UpdateMembershipResult {
  success: boolean;
  vpId: string;
  channelsJoined: string[];
  channelsLeft: string[];
  error?: string;
}

export interface ActivityAnalysis {
  vpId: string;
  activeChannels: Array<{
    channelId: string;
    channelName: string;
    messageCount: number;
    lastActivity: Date;
    engagementScore: number;
  }>;
  inactiveChannels: Array<{
    channelId: string;
    channelName: string;
    daysSinceActivity: number;
    shouldLeave: boolean;
  }>;
  recommendedChannels: ChannelRecommendation[];
}

// =============================================================================
// ASSIGN VP TO CHANNELS ON CREATION
// =============================================================================

/**
 * Assign a VP to discipline-specific channels upon creation
 *
 * @param vpId - The VP ID
 * @param disciplineIds - Array of discipline IDs (optional, will use VP's discipline if not provided)
 * @returns Assignment result with success/failure details
 */
export async function assignVPToChannels(
  vpId: string,
  disciplineIds?: string[],
): Promise<AssignmentResult> {
  const assignedChannels: string[] = [];
  const failedChannels: Array<{ channelId: string; error: string }> = [];

  try {
    // Fetch VP details
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      include: {
        disciplineRef: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!vp) {
      return {
        success: false,
        vpId,
        assignedChannels: [],
        failedChannels: [{ channelId: '', error: 'VP not found' }],
        totalAssigned: 0,
      };
    }

    // Determine which disciplines to match
    const targetDisciplineIds = disciplineIds?.length
      ? disciplineIds
      : vp.disciplineId
        ? [vp.disciplineId]
        : [];

    // Find channels that match the disciplines
    const matchingChannels = await findDisciplineChannels(
      vp.organizationId,
      vp.discipline,
      targetDisciplineIds,
    );

    // Also get general onboarding/welcome channels
    const generalChannels = await findGeneralChannels(vp.organizationId);

    // Combine and deduplicate channels
    const allChannels = Array.from(new Set([...generalChannels, ...matchingChannels]));

    // Auto-join VP to each channel
    for (const channelId of allChannels) {
      const result = await autoJoinVPToChannel(vpId, channelId);

      if (result.success && !result.alreadyMember) {
        assignedChannels.push(channelId);
      } else if (!result.success && result.error) {
        failedChannels.push({ channelId, error: result.error });
      }
    }

    return {
      success: true,
      vpId,
      assignedChannels,
      failedChannels,
      totalAssigned: assignedChannels.length,
    };
  } catch (error) {
    return {
      success: false,
      vpId,
      assignedChannels,
      failedChannels: [
        {
          channelId: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      totalAssigned: assignedChannels.length,
    };
  }
}

/**
 * Find channels that match specific disciplines
 */
async function findDisciplineChannels(
  organizationId: string,
  vpDiscipline: string,
  disciplineIds: string[],
): Promise<string[]> {
  // Fetch discipline names
  const disciplines = await prisma.discipline.findMany({
    where: {
      id: { in: disciplineIds },
    },
    select: {
      name: true,
    },
  });

  const disciplineNames = disciplines.map(d => d.name.toLowerCase());
  const disciplineKeywords = [
    vpDiscipline.toLowerCase(),
    ...disciplineNames,
  ];

  // Find channels whose names contain discipline keywords
  const channels = await prisma.channel.findMany({
    where: {
      workspace: {
        organizationId,
      },
      type: 'PUBLIC',
      isArchived: false,
      OR: disciplineKeywords.map(keyword => ({
        name: {
          contains: keyword,
          mode: 'insensitive',
        },
      })),
    },
    select: {
      id: true,
    },
  });

  return channels.map(c => c.id);
}

/**
 * Find general channels (welcome, announcements, general)
 */
async function findGeneralChannels(organizationId: string): Promise<string[]> {
  const generalKeywords = ['welcome', 'general', 'announcement', 'vp', 'virtual person'];

  const channels = await prisma.channel.findMany({
    where: {
      workspace: {
        organizationId,
      },
      type: 'PUBLIC',
      isArchived: false,
      OR: generalKeywords.map(keyword => ({
        name: {
          contains: keyword,
          mode: 'insensitive',
        },
      })),
    },
    select: {
      id: true,
    },
    take: 5, // Limit to top 5 general channels
  });

  return channels.map(c => c.id);
}

// =============================================================================
// UPDATE VP CHANNEL MEMBERSHIP BASED ON ACTIVITY
// =============================================================================

/**
 * Update VP channel membership based on activity patterns
 * Joins new relevant channels and leaves inactive ones
 *
 * @param vpId - The VP ID
 * @param options - Configuration options
 * @returns Update result with channels joined/left
 */
export async function updateVPChannelMembership(
  vpId: string,
  options: {
    daysInactive?: number;
    autoJoinRecommended?: boolean;
    leaveInactive?: boolean;
  } = {},
): Promise<UpdateMembershipResult> {
  const {
    daysInactive = 30,
    autoJoinRecommended = false,
    leaveInactive = false,
  } = options;

  const channelsJoined: string[] = [];
  const channelsLeft: string[] = [];

  try {
    // Analyze VP activity
    const analysis = await analyzeVPActivity(vpId, daysInactive);

    // Auto-join recommended channels if enabled
    if (autoJoinRecommended) {
      const highConfidenceChannels = analysis.recommendedChannels.filter(
        rec => rec.confidence === 'high' && rec.autoJoinRecommended,
      );

      for (const recommendation of highConfidenceChannels) {
        const result = await autoJoinVPToChannel(vpId, recommendation.channelId);
        if (result.success && !result.alreadyMember) {
          channelsJoined.push(recommendation.channelId);
        }
      }
    }

    // Leave inactive channels if enabled
    if (leaveInactive) {
      const channelsToLeave = analysis.inactiveChannels.filter(ch => ch.shouldLeave);

      for (const channel of channelsToLeave) {
        const left = await leaveChannel(vpId, channel.channelId);
        if (left) {
          channelsLeft.push(channel.channelId);
        }
      }
    }

    return {
      success: true,
      vpId,
      channelsJoined,
      channelsLeft,
    };
  } catch (error) {
    return {
      success: false,
      vpId,
      channelsJoined,
      channelsLeft,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analyze VP activity across channels
 */
async function analyzeVPActivity(
  vpId: string,
  daysInactive: number,
): Promise<ActivityAnalysis> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    include: {
      user: {
        include: {
          channelMembers: {
            include: {
              channel: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!vp) {
    return {
      vpId,
      activeChannels: [],
      inactiveChannels: [],
      recommendedChannels: [],
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - daysInactive);

  const activeChannels: ActivityAnalysis['activeChannels'] = [];
  const inactiveChannels: ActivityAnalysis['inactiveChannels'] = [];

  // Analyze each channel membership
  for (const membership of vp.user.channelMembers) {
    // Count messages from VP in this channel
    const messageCount = await prisma.message.count({
      where: {
        channelId: membership.channelId,
        authorId: vp.userId,
        createdAt: {
          gte: since,
        },
      },
    });

    // Get last activity
    const lastMessage = await prisma.message.findFirst({
      where: {
        channelId: membership.channelId,
        authorId: vp.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    if (messageCount > 0 && lastMessage) {
      // Active channel
      const engagementScore = calculateEngagementScore(
        messageCount,
        lastMessage.createdAt,
        daysInactive,
      );

      activeChannels.push({
        channelId: membership.channelId,
        channelName: membership.channel.name,
        messageCount,
        lastActivity: lastMessage.createdAt,
        engagementScore,
      });
    } else {
      // Inactive channel
      const daysSinceActivity = lastMessage
        ? Math.floor(
            (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : daysInactive + 1;

      inactiveChannels.push({
        channelId: membership.channelId,
        channelName: membership.channel.name,
        daysSinceActivity,
        shouldLeave: daysSinceActivity > daysInactive,
      });
    }
  }

  // Get recommendations
  const relevantChannels = await getRelevantChannels(vpId, 10);
  const recommendedChannels: ChannelRecommendation[] = relevantChannels.map(channel => {
    const score = channel.relevanceScore ?? channel.score ?? 0;
    const confidence: 'low' | 'medium' | 'high' =
      score >= 70
        ? 'high'
        : score >= 40
          ? 'medium'
          : 'low';

    return {
      ...channel,
      reason: buildRecommendationReason(channel),
      confidence,
      autoJoinRecommended: confidence === 'high' && score >= 75,
    };
  });

  return {
    vpId,
    activeChannels: activeChannels.sort((a, b) => b.engagementScore - a.engagementScore),
    inactiveChannels: inactiveChannels.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity),
    recommendedChannels,
  };
}

/**
 * Calculate engagement score based on message count and recency
 */
function calculateEngagementScore(
  messageCount: number,
  lastActivity: Date,
  maxDays: number,
): number {
  const daysSinceActivity = Math.floor(
    (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
  );

  const recencyScore = Math.max(0, 50 - (daysSinceActivity / maxDays) * 50);
  const volumeScore = Math.min(50, messageCount * 2);

  return Math.round(recencyScore + volumeScore);
}

/**
 * Build human-readable recommendation reason
 */
function buildRecommendationReason(channel: ChannelRelevance): string {
  const reasons: string[] = [];

  const matchedDisciplines = channel.matchedDisciplines ?? [];
  const matchedCapabilities = channel.matchedCapabilities ?? [];
  const topicOverlap = channel.topicOverlap ?? [];

  if (matchedDisciplines.length > 0) {
    reasons.push(`Matches your discipline (${matchedDisciplines.join(', ')})`);
  }

  if (matchedCapabilities.length > 0) {
    reasons.push(
      `Discusses your capabilities (${matchedCapabilities.slice(0, 3).join(', ')})`,
    );
  }

  if (topicOverlap.length > 0) {
    reasons.push(`Topics include: ${topicOverlap.slice(0, 3).join(', ')}`);
  }

  return reasons.join('. ') || channel.explanation || 'General relevance to your profile';
}

/**
 * Leave a channel
 */
async function leaveChannel(vpId: string, channelId: string): Promise<boolean> {
  try {
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      select: { userId: true },
    });

    if (!vp) {
      return false;
    }

    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId: vp.userId,
        },
      },
    });

    // Create system message
    await prisma.message.create({
      data: {
        channelId,
        authorId: vp.userId,
        content: 'VP left the channel',
        type: 'SYSTEM',
        metadata: {
          eventType: 'vp_leave',
          vpId,
        },
      },
    });

    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// GET VP CHANNEL RECOMMENDATIONS
// =============================================================================

/**
 * Get channel recommendations for a VP with detailed reasoning
 *
 * @param vpId - The VP ID
 * @param limit - Maximum number of recommendations (default: 10)
 * @param minConfidence - Minimum confidence level to include (default: 'low')
 * @returns Array of channel recommendations
 */
export async function getVPChannelRecommendations(
  vpId: string,
  limit: number = 10,
  minConfidence: 'low' | 'medium' | 'high' = 'low',
): Promise<ChannelRecommendation[]> {
  const relevantChannels = await getRelevantChannels(vpId, limit * 2);

  const recommendations: ChannelRecommendation[] = relevantChannels.map(channel => {
    const score = channel.relevanceScore ?? channel.score ?? 0;
    const confidence: 'low' | 'medium' | 'high' =
      score >= 70
        ? 'high'
        : score >= 40
          ? 'medium'
          : 'low';

    return {
      ...channel,
      reason: buildRecommendationReason(channel),
      confidence,
      autoJoinRecommended: confidence === 'high' && score >= 75,
    };
  });

  // Filter by minimum confidence
  const confidenceLevels = { low: 0, medium: 1, high: 2 };
  const minLevel = confidenceLevels[minConfidence];

  return recommendations
    .filter(rec => confidenceLevels[rec.confidence] >= minLevel)
    .slice(0, limit);
}

/**
 * Bulk assign multiple VPs to channels based on their disciplines
 *
 * @param vpIds - Array of VP IDs to assign
 * @returns Array of assignment results
 */
export async function bulkAssignVPsToChannels(
  vpIds: string[],
): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];

  for (const vpId of vpIds) {
    const result = await assignVPToChannels(vpId);
    results.push(result);
  }

  return results;
}

/**
 * Get VP channel membership statistics
 *
 * @param vpId - The VP ID
 * @returns Membership statistics
 */
export async function getVPChannelStats(vpId: string): Promise<{
  totalChannels: number;
  activeChannels: number;
  inactiveChannels: number;
  messageCount: number;
  averageEngagement: number;
}> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    include: {
      user: {
        include: {
          channelMembers: true,
        },
      },
    },
  });

  if (!vp) {
    return {
      totalChannels: 0,
      activeChannels: 0,
      inactiveChannels: 0,
      messageCount: 0,
      averageEngagement: 0,
    };
  }

  const totalChannels = vp.user.channelMembers.length;

  // Get message count
  const messageCount = await prisma.message.count({
    where: {
      authorId: vp.userId,
    },
  });

  // Analyze activity
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activeChannelIds = await prisma.message
    .findMany({
      where: {
        authorId: vp.userId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        channelId: true,
      },
      distinct: ['channelId'],
    })
    .then(messages => messages.map(m => m.channelId));

  const activeChannels = activeChannelIds.length;
  const inactiveChannels = totalChannels - activeChannels;

  const averageEngagement = totalChannels > 0
    ? Math.round((messageCount / totalChannels) * 100) / 100
    : 0;

  return {
    totalChannels,
    activeChannels,
    inactiveChannels,
    messageCount,
    averageEngagement,
  };
}
