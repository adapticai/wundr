/**
 * Channel Intelligence Service
 *
 * Provides intelligent channel operations for VPs including auto-joining,
 * relevance detection, notification filtering, and topic extraction.
 *
 * @module lib/services/channel-intelligence-service
 */

import { prisma } from '@neolith/database';

import type { ChannelType, MessageType } from '@neolith/database';

// =============================================================================
// TYPES
// =============================================================================

export interface ChannelRelevance {
  channelId: string;
  channelName?: string;
  relevanceScore?: number;
  score: number;
  explanation: string;
  factors: RelevanceFactors;
  matchedDisciplines?: string[];
  matchedCapabilities?: string[];
  topicOverlap?: string[];
}

/**
 * Channel relevance score factors
 */
interface RelevanceFactors {
  disciplineMatch: number;
  roleMatch: number;
  memberSimilarity: number;
  activityLevel: number;
  channelAge: number;
}

/**
 * Recommended channel with details
 */
export interface RecommendedChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ChannelType;
  relevanceScore: number;
  reasoning: string;
  memberCount: number;
  recentActivityCount: number;
  isArchived: boolean;
}

/**
 * Activity tracking event
 */
export interface ActivityEvent {
  orchestratorId: string;
  channelId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface NotificationDecision {
  shouldNotify: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  keywords: string[];
}

export interface ChannelTopics {
  channelId: string;
  channelName: string;
  topics: string[];
  topicFrequency: Record<string, number>;
  lastAnalyzedAt: Date;
  messageCount: number;
}

export interface AutoJoinResult {
  success: boolean;
  channelId: string;
  channelName: string;
  alreadyMember: boolean;
  error?: string;
}

// =============================================================================
// AUTO-JOIN ORCHESTRATOR TO CHANNEL
// =============================================================================

/**
 * Automatically join an Orchestrator to a channel based on discipline and capabilities
 *
 * @param orchestratorId - The OrchestratorID to join
 * @param channelId - The channel ID to join
 * @returns Result of the auto-join operation
 */
export async function autoJoinOrchestratorToChannel(
  orchestratorId: string,
  channelId: string,
): Promise<AutoJoinResult> {
  try {
    // Fetch Orchestrator details
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
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
      return {
        success: false,
        channelId,
        channelName: '',
        alreadyMember: false,
        error: 'Orchestrator not found',
      };
    }

    // Fetch channel details
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        type: true,
        workspaceId: true,
      },
    });

    if (!channel) {
      return {
        success: false,
        channelId,
        channelName: '',
        alreadyMember: false,
        error: 'Channel not found',
      };
    }

    // Check if Orchestrator is already a member
    const existingMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: orchestrator.userId,
        },
      },
    });

    if (existingMembership) {
      return {
        success: true,
        channelId: channel.id,
        channelName: channel.name,
        alreadyMember: true,
      };
    }

    // Only auto-join to PUBLIC channels
    if (channel.type !== 'PUBLIC') {
      return {
        success: false,
        channelId: channel.id,
        channelName: channel.name,
        alreadyMember: false,
        error: 'Can only auto-join public channels',
      };
    }

    // Create channel membership
    await prisma.channelMember.create({
      data: {
        channelId,
        userId: orchestrator.userId,
        role: 'MEMBER',
        joinedAt: new Date(),
      },
    });

    // Create system message announcing Orchestrator joining
    await prisma.message.create({
      data: {
        channelId,
        authorId: orchestrator.userId,
        content: `Orchestrator ${orchestrator.user.name || orchestrator.role} has joined the channel`,
        type: 'SYSTEM',
        metadata: {
          eventType: 'orchestrator_auto_join',
          orchestratorId,
          discipline: orchestrator.discipline,
        },
      },
    });

    return {
      success: true,
      channelId: channel.id,
      channelName: channel.name,
      alreadyMember: false,
    };
  } catch (error) {
    return {
      success: false,
      channelId,
      channelName: '',
      alreadyMember: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// GET RELEVANT CHANNELS FOR ORCHESTRATOR
// =============================================================================

/**
 * Find channels that are relevant to an Orchestrator based on discipline and capabilities
 *
 * @param orchestratorId - The OrchestratorID
 * @param limit - Maximum number of channels to return (default: 10)
 * @returns Array of relevant channels with relevance scores
 */
export async function getRelevantChannels(
  orchestratorId: string,
  limit: number = 10,
): Promise<ChannelRelevance[]> {
  // Fetch Orchestrator details with discipline
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      disciplineRef: {
        select: {
          name: true,
          description: true,
        },
      },
      user: {
        include: {
          channelMembers: {
            select: {
              channelId: true,
            },
          },
        },
      },
    },
  });

  if (!orchestrator) {
    return [];
  }

  // Get Orchestrator capabilities as array of strings
  const capabilities = Array.isArray(orchestrator.capabilities)
    ? (orchestrator.capabilities as string[])
    : [];

  // Get channels Orchestrator is not already a member of
  const memberChannelIds = orchestrator.user.channelMembers.map(
    m => m.channelId,
  );

  // Fetch all public channels in the Orchestrator's organization
  const channels = await prisma.channel.findMany({
    where: {
      workspace: {
        organizationId: orchestrator.organizationId,
      },
      type: 'PUBLIC',
      isArchived: false,
      id: {
        notIn: memberChannelIds,
      },
    },
    include: {
      workspace: {
        select: {
          name: true,
        },
      },
    },
    take: 100, // Fetch up to 100 channels to analyze
  });

  // Calculate relevance scores
  const relevantChannels: ChannelRelevance[] = [];

  for (const channel of channels) {
    const relevanceScore = await calculateChannelRelevanceLegacy(
      channel,
      orchestrator.discipline,
      capabilities,
      orchestrator.disciplineRef?.name,
    );

    if (relevanceScore.score > 0) {
      relevantChannels.push({
        channelId: channel.id,
        channelName: channel.name,
        score: relevanceScore.score,
        relevanceScore: relevanceScore.score,
        explanation: '',
        factors: {
          disciplineMatch: 0,
          roleMatch: 0,
          memberSimilarity: 0,
          activityLevel: 0,
          channelAge: 0,
        },
        matchedDisciplines: relevanceScore.matchedDisciplines,
        matchedCapabilities: relevanceScore.matchedCapabilities,
        topicOverlap: relevanceScore.topicOverlap,
      });
    }
  }

  // Sort by relevance score descending and limit
  return relevantChannels
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, limit);
}

/**
 * Calculate relevance score for a channel based on Orchestrator attributes (legacy version)
 * @deprecated Use the new calculateChannelRelevance(orchestratorId, channelId) instead
 */
async function calculateChannelRelevanceLegacy(
  channel: {
    id: string;
    name: string;
    description: string | null;
    topic: string | null;
  },
  vpDiscipline: string,
  vpCapabilities: string[],
  disciplineName?: string,
): Promise<{
  score: number;
  matchedDisciplines: string[];
  matchedCapabilities: string[];
  topicOverlap: string[];
}> {
  let score = 0;
  const matchedDisciplines: string[] = [];
  const matchedCapabilities: string[] = [];
  const topicOverlap: string[] = [];

  const channelText = [
    channel.name,
    channel.description || '',
    channel.topic || '',
  ]
    .join(' ')
    .toLowerCase();

  // Check discipline match (20 points)
  if (vpDiscipline) {
    const disciplineLower = vpDiscipline.toLowerCase();
    if (channelText.includes(disciplineLower)) {
      score += 20;
      matchedDisciplines.push(vpDiscipline);
    }
  }

  // Check discipline name match if available (15 points)
  if (disciplineName) {
    const disciplineNameLower = disciplineName.toLowerCase();
    if (channelText.includes(disciplineNameLower)) {
      score += 15;
      matchedDisciplines.push(disciplineName);
    }
  }

  // Check capability matches (5 points per capability, max 30 points)
  for (const capability of vpCapabilities.slice(0, 6)) {
    const capabilityLower = capability.toLowerCase();
    if (channelText.includes(capabilityLower)) {
      score += 5;
      matchedCapabilities.push(capability);
    }
  }

  // Extract topics from recent messages (max 25 points)
  const channelTopics = await extractChannelTopics(channel.id);
  for (const topic of channelTopics.topics) {
    const topicLower = topic.toLowerCase();

    // Check if topic matches discipline or capabilities
    if (
      (vpDiscipline && topicLower.includes(vpDiscipline.toLowerCase())) ||
      vpCapabilities.some(cap => topicLower.includes(cap.toLowerCase()))
    ) {
      const topicScore = Math.min(
        5,
        Math.ceil((channelTopics.topicFrequency[topic] || 0) / 2),
      );
      score += topicScore;
      topicOverlap.push(topic);
    }
  }

  return {
    score: Math.min(100, score), // Cap at 100
    matchedDisciplines,
    matchedCapabilities,
    topicOverlap,
  };
}

// =============================================================================
// SHOULD NOTIFY ORCHESTRATOR
// =============================================================================

/**
 * Determine if an Orchestrator should be notified about a message
 *
 * @param orchestratorId - The OrchestratorID
 * @param message - The message object
 * @returns Notification decision with reason and priority
 */
export async function shouldNotifyOrchestrator(
  orchestratorId: string,
  message: {
    id: string;
    content: string;
    channelId: string;
    authorId: string;
    type: MessageType;
    metadata?: Record<string, unknown>;
  },
): Promise<NotificationDecision> {
  // Fetch Orchestrator details
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: true,
      disciplineRef: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!orchestrator) {
    return {
      shouldNotify: false,
      reason: 'Orchestrator not found',
      priority: 'low',
      keywords: [],
    };
  }

  // Don't notify about own messages
  if (message.authorId === orchestrator.userId) {
    return {
      shouldNotify: false,
      reason: 'Own message',
      priority: 'low',
      keywords: [],
    };
  }

  // Don't notify about system messages unless they're critical
  if (message.type === 'SYSTEM' && !message.metadata?.critical) {
    return {
      shouldNotify: false,
      reason: 'System message (non-critical)',
      priority: 'low',
      keywords: [],
    };
  }

  const keywords: string[] = [];
  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low';
  let shouldNotify = false;
  let reason = '';

  const contentLower = message.content.toLowerCase();

  // Check for @mention (URGENT)
  const orchestratorMentionPatterns = [
    `@${orchestrator.user.name?.toLowerCase()}`,
    `@${orchestrator.role.toLowerCase()}`,
    orchestrator.user.email?.toLowerCase(),
  ].filter(Boolean);

  for (const pattern of orchestratorMentionPatterns) {
    if (contentLower.includes(pattern)) {
      shouldNotify = true;
      priority = 'urgent';
      reason = 'Direct mention';
      keywords.push(pattern);
      return { shouldNotify, reason, priority, keywords };
    }
  }

  // Check for discipline mention (HIGH)
  if (orchestrator.discipline) {
    const disciplinePatterns = [
      orchestrator.discipline.toLowerCase(),
      orchestrator.disciplineRef?.name?.toLowerCase(),
    ].filter(Boolean) as string[];

    for (const pattern of disciplinePatterns) {
      if (contentLower.includes(pattern)) {
        shouldNotify = true;
        priority = 'high';
        reason = 'Discipline mentioned';
        keywords.push(pattern);
      }
    }
  }

  // Check for capability keywords (MEDIUM)
  const capabilities = Array.isArray(orchestrator.capabilities)
    ? (orchestrator.capabilities as string[])
    : [];

  for (const capability of capabilities) {
    if (contentLower.includes(capability.toLowerCase())) {
      shouldNotify = true;
      priority = priority === 'high' ? priority : 'medium';
      reason = reason || 'Capability keyword matched';
      keywords.push(capability);
    }
  }

  // Check for urgent keywords (HIGH)
  const urgentKeywords = [
    'urgent',
    'asap',
    'critical',
    'emergency',
    'help needed',
  ];
  for (const keyword of urgentKeywords) {
    if (contentLower.includes(keyword)) {
      shouldNotify = true;
      priority = 'high';
      reason = 'Urgent keyword detected';
      keywords.push(keyword);
    }
  }

  // Check for question patterns directed at Orchestrator's expertise (MEDIUM)
  const questionPatterns = [
    'how to',
    'can you',
    'could you',
    'need help with',
    'looking for',
    'anyone know',
  ];

  for (const pattern of questionPatterns) {
    if (contentLower.includes(pattern)) {
      // Check if it's related to Orchestrator's discipline or capabilities
      for (const capability of capabilities) {
        if (contentLower.includes(capability.toLowerCase())) {
          shouldNotify = true;
          priority = priority === 'high' ? priority : 'medium';
          reason = reason || 'Question about expertise area';
          keywords.push(pattern, capability);
          break;
        }
      }
    }
  }

  return {
    shouldNotify,
    reason: reason || 'No relevant keywords',
    priority,
    keywords,
  };
}

// =============================================================================
// EXTRACT CHANNEL TOPICS
// =============================================================================

/**
 * Extract topics from recent channel messages
 *
 * @param channelId - The channel ID
 * @param days - Number of days to look back (default: 7)
 * @param minFrequency - Minimum topic frequency to include (default: 2)
 * @returns Channel topics with frequency counts
 */
export async function extractChannelTopics(
  channelId: string,
  days: number = 7,
  minFrequency: number = 2,
): Promise<ChannelTopics> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!channel) {
    return {
      channelId,
      channelName: '',
      topics: [],
      topicFrequency: {},
      lastAnalyzedAt: new Date(),
      messageCount: 0,
    };
  }

  // Fetch recent messages
  const since = new Date();
  since.setDate(since.getDate() - days);

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      createdAt: {
        gte: since,
      },
      isDeleted: false,
      type: 'TEXT',
    },
    select: {
      content: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 500, // Analyze up to 500 recent messages
  });

  // Extract topics using keyword extraction
  const topicFrequency: Record<string, number> = {};

  // Common technical and business terms to extract
  const topicKeywords = [
    // Technical
    'api',
    'database',
    'server',
    'client',
    'backend',
    'frontend',
    'deploy',
    'bug',
    'feature',
    'design',
    'architecture',
    'testing',
    'performance',
    'security',
    'authentication',
    'authorization',
    'migration',
    'refactor',
    // Development
    'code',
    'review',
    'pull request',
    'pr',
    'branch',
    'merge',
    'commit',
    'typescript',
    'javascript',
    'react',
    'node',
    'python',
    'java',
    'go',
    // Project management
    'deadline',
    'sprint',
    'milestone',
    'task',
    'issue',
    'blocker',
    'priority',
    'meeting',
    'standup',
    'retrospective',
    'planning',
    'release',
    // Business
    'product',
    'customer',
    'user',
    'analytics',
    'metrics',
    'kpi',
    'revenue',
    'growth',
    'marketing',
    'sales',
    'support',
    'onboarding',
  ];

  for (const message of messages) {
    const contentLower = message.content.toLowerCase();
    const words = contentLower.split(/\s+/);

    // Count individual keywords
    for (const keyword of topicKeywords) {
      if (contentLower.includes(keyword)) {
        topicFrequency[keyword] = (topicFrequency[keyword] || 0) + 1;
      }
    }

    // Extract potential multi-word topics (2-3 words)
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
      const threeWordPhrase =
        i < words.length - 2
          ? `${words[i]} ${words[i + 1]} ${words[i + 2]}`
          : '';

      // Only count phrases that contain at least one keyword
      if (topicKeywords.some(k => twoWordPhrase.includes(k))) {
        topicFrequency[twoWordPhrase] =
          (topicFrequency[twoWordPhrase] || 0) + 1;
      }

      if (
        threeWordPhrase &&
        topicKeywords.some(k => threeWordPhrase.includes(k))
      ) {
        topicFrequency[threeWordPhrase] =
          (topicFrequency[threeWordPhrase] || 0) + 1;
      }
    }
  }

  // Filter topics by minimum frequency and sort
  const topics = Object.entries(topicFrequency)
    .filter(([_, freq]) => freq >= minFrequency)
    .sort(([_, freqA], [__, freqB]) => freqB - freqA)
    .map(([topic]) => topic)
    .slice(0, 20); // Top 20 topics

  return {
    channelId: channel.id,
    channelName: channel.name,
    topics,
    topicFrequency: Object.fromEntries(
      Object.entries(topicFrequency).filter(([topic]) => topics.includes(topic)),
    ),
    lastAnalyzedAt: new Date(),
    messageCount: messages.length,
  };
}

// =============================================================================
// ENHANCED CHANNEL INTELLIGENCE (Wave 2.1.2)
// =============================================================================

/**
 * Calculate relevance score between an Orchestrator and a channel
 * Enhanced version with detailed factor breakdown
 *
 * @param orchestratorId - Orchestrator identifier
 * @param channelId - Channel identifier
 * @returns Relevance score (0-1) and explanation
 */
export async function calculateChannelRelevance(
  orchestratorId: string,
  channelId: string,
): Promise<ChannelRelevance> {
  // Fetch Orchestrator details
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: {
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
    throw new Error(`Orchestrator not found: ${orchestratorId}`);
  }

  // Fetch channel details with members
  const [channel, channelMembers, messageCount] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
    }),
    prisma.channelMember.findMany({
      where: {
        channelId,
        leftAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            orchestrator: {
              select: {
                discipline: true,
                role: true,
                disciplineRef: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.message.count({
      where: {
        channelId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  // Calculate relevance factors
  const channelWithMembers = { ...channel, members: channelMembers };
  const channelWithCounts = {
    ...channel,
    _count: { messages: messageCount },
    createdAt: channel.createdAt,
  };

  const factors: RelevanceFactors = {
    disciplineMatch: calculateDisciplineMatch(orchestrator, channel),
    roleMatch: calculateRoleMatch(orchestrator, channel),
    memberSimilarity: calculateMemberSimilarity(
      orchestrator,
      channelWithMembers,
    ),
    activityLevel: calculateActivityLevel(channelWithCounts),
    channelAge: calculateChannelAge(channel),
  };

  // Weighted average of factors
  const weights = {
    disciplineMatch: 0.35,
    roleMatch: 0.25,
    memberSimilarity: 0.2,
    activityLevel: 0.15,
    channelAge: 0.05,
  };

  const score =
    factors.disciplineMatch * weights.disciplineMatch +
    factors.roleMatch * weights.roleMatch +
    factors.memberSimilarity * weights.memberSimilarity +
    factors.activityLevel * weights.activityLevel +
    factors.channelAge * weights.channelAge;

  // Generate explanation
  const explanation = generateRelevanceExplanation(
    factors,
    orchestrator,
    channel,
  );

  return {
    channelId,
    score: Math.min(1, Math.max(0, score)),
    explanation,
    factors,
  };
}

/**
 * Get recommended channels for an Orchestrator
 *
 * @param orchestratorId - Orchestrator identifier
 * @param options - Filtering options
 * @returns Sorted list of recommended channels
 */
export async function getRecommendedChannels(
  orchestratorId: string,
  options: {
    minScore?: number;
    limit?: number;
    excludeJoined?: boolean;
    channelType?: ChannelType;
  } = {},
): Promise<RecommendedChannel[]> {
  const {
    minScore = 0.5,
    limit = 10,
    excludeJoined = true,
    channelType,
  } = options;

  // Get Orchestrator with workspace context
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: {
          channelMembers: {
            where: { leftAt: null },
            select: { channelId: true },
          },
        },
      },
    },
  });

  if (!orchestrator) {
    throw new Error(`Orchestrator not found: ${orchestratorId}`);
  }

  // Get all channels in the workspace
  const channels = await prisma.channel.findMany({
    where: {
      workspaceId: orchestrator.workspaceId ?? undefined,
      isArchived: false,
      ...(channelType && { type: channelType }),
      ...(excludeJoined && {
        id: {
          notIn: orchestrator.user.channelMembers.map(m => m.channelId),
        },
      }),
    },
    take: 100, // Process max 100 channels for performance
  });

  // Get counts for each channel
  const channelStats = await Promise.all(
    channels.map(async channel => {
      const [memberCount, messageCount] = await Promise.all([
        prisma.channelMember.count({
          where: { channelId: channel.id, leftAt: null },
        }),
        prisma.message.count({
          where: {
            channelId: channel.id,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);
      return { channelId: channel.id, memberCount, messageCount };
    }),
  );

  const statsMap = new Map(channelStats.map(s => [s.channelId, s]));

  // Calculate relevance for each channel
  const channelsWithRelevance = await Promise.all(
    channels.map(async channel => {
      const relevance = await calculateChannelRelevance(
        orchestratorId,
        channel.id,
      );
      const stats = statsMap.get(channel.id) || {
        memberCount: 0,
        messageCount: 0,
      };

      return {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        type: channel.type,
        relevanceScore: relevance.score,
        reasoning: relevance.explanation,
        memberCount: stats.memberCount,
        recentActivityCount: stats.messageCount,
        isArchived: channel.isArchived,
      };
    }),
  );

  // Filter by minimum score and sort
  return channelsWithRelevance
    .filter(c => c.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Determine if an Orchestrator should auto-join a channel
 *
 * @param orchestratorId - Orchestrator identifier
 * @param channelId - Channel identifier
 * @returns true if Orchestrator should auto-join
 */
export async function shouldAutoJoin(
  orchestratorId: string,
  channelId: string,
): Promise<boolean> {
  const relevance = await calculateChannelRelevance(orchestratorId, channelId);

  // Auto-join threshold: 0.7 or higher relevance score
  const AUTO_JOIN_THRESHOLD = 0.7;

  return relevance.score >= AUTO_JOIN_THRESHOLD;
}

/**
 * Track Orchestrator channel activity event
 *
 * @param event - Activity event details
 */
export async function trackChannelActivity(
  event: ActivityEvent,
): Promise<void> {
  const {
    orchestratorId,
    channelId,
    eventType,
    metadata,
    timestamp = new Date(),
  } = event;

  // Verify Orchestrator and channel exist
  const [orch, channel] = await Promise.all([
    prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, userId: true },
    }),
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    }),
  ]);

  if (!orch || !channel) {
    throw new Error('Orchestrator or channel not found');
  }

  // Store activity in metadata or create a log entry
  // For now, we'll use a simple approach of updating channel member's lastReadAt
  // In production, you might want a dedicated activity_log table

  if (eventType === 'message_sent' || eventType === 'task_created') {
    await prisma.channelMember.updateMany({
      where: {
        channelId,
        userId: orch.userId,
      },
      data: {
        lastReadAt: timestamp,
      },
    });
  }

  // Log to console for debugging (replace with proper logging service)
  console.log(
    `[Channel Activity] Orchestrator:${orchestratorId} Channel:${channelId} Event:${eventType}`,
    {
      metadata,
      timestamp,
    },
  );
}

/**
 * Calculate discipline match score (0-1)
 */
function calculateDisciplineMatch(
  vp: { discipline: string; disciplineRef: { name: string } | null },
  channel: { name: string; description: string | null; topic: string | null },
): number {
  const vpDiscipline = (vp.disciplineRef?.name || vp.discipline).toLowerCase();
  const channelText =
    `${channel.name} ${channel.description || ''} ${channel.topic || ''}`.toLowerCase();

  // Check for exact discipline match in channel name/description
  if (channelText.includes(vpDiscipline)) {
    return 1.0;
  }

  // Check for partial matches and related keywords
  const disciplineKeywords = vpDiscipline.split(/\s+/);
  const matchCount = disciplineKeywords.filter(keyword =>
    channelText.includes(keyword),
  ).length;

  return matchCount / disciplineKeywords.length;
}

/**
 * Calculate role match score (0-1)
 */
function calculateRoleMatch(
  vp: { role: string },
  channel: { name: string; description: string | null },
): number {
  const vpRole = vp.role.toLowerCase();
  const channelText =
    `${channel.name} ${channel.description || ''}`.toLowerCase();

  // Extract key role terms (e.g., "Senior Backend Engineer" -> ["senior", "backend", "engineer"])
  const roleKeywords = vpRole.split(/\s+/).filter(word => word.length > 3);

  const matchCount = roleKeywords.filter(keyword =>
    channelText.includes(keyword),
  ).length;

  if (roleKeywords.length === 0) {
    return 0.5;
  }

  return matchCount / roleKeywords.length;
}

/**
 * Calculate member similarity score (0-1)
 */
function calculateMemberSimilarity(
  orchestratorParam: { discipline: string },
  channel: {
    members: Array<{
      user: {
        id: string;
        orchestrator: {
          discipline: string;
          disciplineRef: { name: string } | null;
        } | null;
      };
    }>;
  },
): number {
  const orchestratorDiscipline = orchestratorParam.discipline.toLowerCase();

  // Count members with Orchestrators in the same discipline
  const similarMembers = channel.members.filter(member => {
    const memberOrchestrator = member.user.orchestrator;
    if (!memberOrchestrator) {
      return false;
    }

    const memberDiscipline = (
      memberOrchestrator.disciplineRef?.name || memberOrchestrator.discipline
    ).toLowerCase();
    return memberDiscipline === orchestratorDiscipline;
  });

  const totalMembers = channel.members.length;
  if (totalMembers === 0) {
    return 0.3;
  } // Default for empty channels

  return Math.min(1.0, similarMembers.length / (totalMembers * 0.3)); // 30% similar = perfect score
}

/**
 * Calculate activity level score (0-1)
 */
function calculateActivityLevel(channel: {
  _count: { messages: number };
  createdAt: Date;
}): number {
  const messagesLast30Days = channel._count.messages;

  // Normalize: 50+ messages in 30 days = perfect score
  const normalizedActivity = Math.min(1.0, messagesLast30Days / 50);

  return normalizedActivity;
}

/**
 * Calculate channel age score (0-1)
 * Newer channels get slightly higher scores to encourage exploration
 */
function calculateChannelAge(channel: { createdAt: Date }): number {
  const ageInDays =
    (Date.now() - channel.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Channels 0-30 days old: score 1.0
  // Channels 30-180 days old: score 0.7
  // Channels 180+ days old: score 0.5

  if (ageInDays <= 30) {
    return 1.0;
  }
  if (ageInDays <= 180) {
    return 0.7;
  }
  return 0.5;
}

/**
 * Generate human-readable explanation of relevance score
 */
function generateRelevanceExplanation(
  factors: RelevanceFactors,
  vp: { discipline: string; role: string },
  channel: { name: string; type: ChannelType },
): string {
  const reasons: string[] = [];

  if (factors.disciplineMatch >= 0.7) {
    reasons.push(`Strong discipline match with ${vp.discipline}`);
  } else if (factors.disciplineMatch >= 0.4) {
    reasons.push(`Partial discipline match with ${vp.discipline}`);
  }

  if (factors.roleMatch >= 0.7) {
    reasons.push(`Role alignment with ${vp.role}`);
  }

  if (factors.memberSimilarity >= 0.5) {
    reasons.push('Similar VPs are members');
  }

  if (factors.activityLevel >= 0.6) {
    reasons.push('Active channel with recent discussions');
  } else if (factors.activityLevel < 0.2) {
    reasons.push('Low recent activity');
  }

  if (channel.type === 'PRIVATE') {
    reasons.push('Private channel (may require invitation)');
  }

  if (reasons.length === 0) {
    return `Limited relevance to ${vp.discipline} ${vp.role}`;
  }

  return reasons.join('. ') + '.';
}
