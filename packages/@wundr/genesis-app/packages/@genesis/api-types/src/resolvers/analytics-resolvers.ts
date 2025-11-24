/**
 * GraphQL Resolvers for Analytics and Insights
 *
 * Provides comprehensive analytics functionality for workspace usage metrics,
 * trend analysis, real-time statistics, and insight generation.
 *
 * @module @genesis/api-types/resolvers/analytics-resolvers
 */

import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

/**
 * GraphQL context for analytics resolvers
 */
export interface AnalyticsResolverContext {
  prisma: PrismaClient;
  redis: Redis;
  userId: string;
}

/**
 * GraphQL context with services interface
 */
export interface AnalyticsGraphQLContext {
  services: {
    analytics?: AnalyticsServiceInterface;
  };
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  prisma?: PrismaClient;
  redis?: Redis;
}

/**
 * Analytics service interface
 */
export interface AnalyticsServiceInterface {
  getMetrics(options: GetMetricsOptions): Promise<UsageMetrics>;
  getTrend(
    workspaceId: string,
    metric: string,
    currentPeriod: DateRange,
    previousPeriod: DateRange
  ): Promise<TrendData>;
  generateInsightReport(
    workspaceId: string,
    period: AnalyticsPeriodValue
  ): Promise<InsightReport>;
  getRealTimeStats(workspaceId: string): Promise<Record<string, unknown>>;
  track(event: TrackEventInput): Promise<void>;
}

/**
 * Analytics period enum values
 */
export const AnalyticsPeriod = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  CUSTOM: 'custom',
} as const;

export type AnalyticsPeriodValue = (typeof AnalyticsPeriod)[keyof typeof AnalyticsPeriod];

/**
 * Trend direction enum values
 */
export const TrendDirection = {
  UP: 'up',
  DOWN: 'down',
  STABLE: 'stable',
} as const;

export type TrendDirectionValue = (typeof TrendDirection)[keyof typeof TrendDirection];

/**
 * Highlight type enum values
 */
export const HighlightType = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
} as const;

export type HighlightTypeValue = (typeof HighlightType)[keyof typeof HighlightType];

/**
 * Recommendation priority enum values
 */
export const RecommendationPriority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type RecommendationPriorityValue = (typeof RecommendationPriority)[keyof typeof RecommendationPriority];

// =============================================================================
// INTERNAL TYPES
// =============================================================================

interface DateRange {
  start: Date;
  end: Date;
}

interface GetMetricsOptions {
  workspaceId: string;
  period: AnalyticsPeriodValue;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  metrics?: string[] | undefined;
  groupBy?: 'day' | 'week' | 'month' | undefined;
}

interface TrackEventInput {
  workspaceId: string;
  userId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  sessionId?: string | undefined;
}

interface DailyCount {
  date: string;
  count: number;
}

interface ChannelCount {
  channelId: string;
  channelName: string;
  count: number;
}

interface UserCount {
  userId: string;
  userName: string;
  count: number;
}

interface ContributorStats {
  userId: string;
  userName: string;
  messageCount: number;
}

interface ChannelStats {
  channelId: string;
  channelName: string;
  messageCount: number;
  memberCount: number;
}

interface FileTypeStats {
  type: string;
  count: number;
  size: number;
}

interface UploaderStats {
  userId: string;
  userName: string;
  count: number;
  size: number;
}

interface DailyCallStats {
  date: string;
  count: number;
  duration: number;
}

interface HourlyStats {
  hour: number;
  count: number;
}

interface VPStats {
  vpId: string;
  vpName: string;
  discipline: string;
  messagesSent: number;
  tasksCompleted: number;
}

interface MessageMetrics {
  total: number;
  byDay: DailyCount[];
  byChannel: ChannelCount[];
  byUser: UserCount[];
  averagePerDay: number;
  threadsCreated: number;
  reactionsAdded: number;
}

interface UserMetrics {
  totalMembers: number;
  activeUsers: number;
  newUsers: number;
  dailyActiveUsers: DailyCount[];
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  topContributors: ContributorStats[];
}

interface ChannelMetrics {
  total: number;
  public: number;
  private: number;
  newChannels: number;
  mostActive: ChannelStats[];
  averageMessagesPerChannel: number;
}

interface FileMetrics {
  totalUploaded: number;
  totalSize: number;
  byType: FileTypeStats[];
  topUploaders: UploaderStats[];
  averageSizeBytes: number;
}

interface CallMetrics {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  averageParticipants: number;
  byDay: DailyCallStats[];
  peakHours: HourlyStats[];
}

interface VPMetrics {
  totalVPs: number;
  activeVPs: number;
  messagesSent: number;
  messagesReceived: number;
  tasksCompleted: number;
  averageResponseTime: number;
  byVP: VPStats[];
}

interface UsageMetrics {
  workspaceId: string;
  period: AnalyticsPeriodValue;
  startDate: Date;
  endDate: Date;
  messages: MessageMetrics;
  users: UserMetrics;
  channels: ChannelMetrics;
  files: FileMetrics;
  calls: CallMetrics;
  vp: VPMetrics;
}

interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: TrendDirectionValue;
}

interface InsightHighlight {
  type: HighlightTypeValue;
  title: string;
  description: string;
  metric: string;
  value: number;
  change?: TrendData;
}

interface InsightRecommendation {
  priority: RecommendationPriorityValue;
  title: string;
  description: string;
  actionUrl?: string;
}

interface InsightReport {
  id: string;
  workspaceId: string;
  period: AnalyticsPeriodValue;
  generatedAt: Date;
  highlights: InsightHighlight[];
  recommendations: InsightRecommendation[];
}

interface RealTimeStats {
  stats: Record<string, unknown>;
  timestamp: Date;
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for analytics
 */
export const analyticsTypeDefs = `#graphql
  type UsageMetrics {
    workspaceId: ID!
    period: AnalyticsPeriod!
    startDate: DateTime!
    endDate: DateTime!
    messages: MessageMetrics!
    users: UserMetrics!
    channels: ChannelMetrics!
    files: FileMetrics!
    calls: CallMetrics!
    vp: VPMetrics!
  }

  type MessageMetrics {
    total: Int!
    byDay: [DailyCount!]!
    byChannel: [ChannelCount!]!
    byUser: [UserCount!]!
    averagePerDay: Int!
    threadsCreated: Int!
    reactionsAdded: Int!
  }

  type UserMetrics {
    totalMembers: Int!
    activeUsers: Int!
    newUsers: Int!
    dailyActiveUsers: [DailyCount!]!
    weeklyActiveUsers: Int!
    monthlyActiveUsers: Int!
    averageSessionDuration: Int!
    topContributors: [ContributorStats!]!
  }

  type ChannelMetrics {
    total: Int!
    public: Int!
    private: Int!
    newChannels: Int!
    mostActive: [ChannelStats!]!
    averageMessagesPerChannel: Int!
  }

  type FileMetrics {
    totalUploaded: Int!
    totalSize: Float!
    byType: [FileTypeStats!]!
    topUploaders: [UploaderStats!]!
    averageSizeBytes: Float!
  }

  type CallMetrics {
    totalCalls: Int!
    totalDuration: Int!
    averageDuration: Int!
    averageParticipants: Int!
    byDay: [DailyCallStats!]!
    peakHours: [HourlyStats!]!
  }

  type VPMetrics {
    totalVPs: Int!
    activeVPs: Int!
    messagesSent: Int!
    messagesReceived: Int!
    tasksCompleted: Int!
    averageResponseTime: Int!
    byVP: [VPStats!]!
  }

  type DailyCount {
    date: String!
    count: Int!
  }

  type ChannelCount {
    channelId: ID!
    channelName: String!
    count: Int!
  }

  type UserCount {
    userId: ID!
    userName: String!
    count: Int!
  }

  type ContributorStats {
    userId: ID!
    userName: String!
    messageCount: Int!
  }

  type ChannelStats {
    channelId: ID!
    channelName: String!
    messageCount: Int!
    memberCount: Int!
  }

  type FileTypeStats {
    type: String!
    count: Int!
    size: Float!
  }

  type UploaderStats {
    userId: ID!
    userName: String!
    count: Int!
    size: Float!
  }

  type DailyCallStats {
    date: String!
    count: Int!
    duration: Int!
  }

  type HourlyStats {
    hour: Int!
    count: Int!
  }

  type VPStats {
    vpId: ID!
    vpName: String!
    discipline: String!
    messagesSent: Int!
    tasksCompleted: Int!
  }

  type TrendData {
    current: Float!
    previous: Float!
    change: Float!
    changePercent: Float!
    trend: TrendDirection!
  }

  enum TrendDirection {
    up
    down
    stable
  }

  enum AnalyticsPeriod {
    day
    week
    month
    quarter
    year
    custom
  }

  type InsightReport {
    id: ID!
    workspaceId: ID!
    period: AnalyticsPeriod!
    generatedAt: DateTime!
    highlights: [InsightHighlight!]!
    recommendations: [InsightRecommendation!]!
  }

  type InsightHighlight {
    type: HighlightType!
    title: String!
    description: String!
    metric: String!
    value: Float!
    change: TrendData
  }

  enum HighlightType {
    positive
    negative
    neutral
  }

  type InsightRecommendation {
    priority: RecommendationPriority!
    title: String!
    description: String!
    actionUrl: String
  }

  enum RecommendationPriority {
    high
    medium
    low
  }

  type RealTimeStats {
    stats: JSON!
    timestamp: DateTime!
  }

  input AnalyticsQueryInput {
    workspaceId: ID!
    period: AnalyticsPeriod!
    startDate: DateTime
    endDate: DateTime
    metrics: [String!]
    groupBy: String
  }

  input TrendQueryInput {
    workspaceId: ID!
    metric: String!
    currentStart: DateTime!
    currentEnd: DateTime!
    previousStart: DateTime!
    previousEnd: DateTime!
  }

  extend type Query {
    """
    Get comprehensive usage metrics for a workspace
    """
    analyticsMetrics(input: AnalyticsQueryInput!): UsageMetrics!

    """
    Get trend data comparing current and previous periods
    """
    analyticsTrend(input: TrendQueryInput!): TrendData!

    """
    Generate insights report for a workspace
    """
    analyticsInsights(workspaceId: ID!, period: AnalyticsPeriod!): InsightReport!

    """
    Get real-time statistics for a workspace
    """
    analyticsRealTime(workspaceId: ID!): RealTimeStats!
  }

  extend type Mutation {
    """
    Track an analytics event
    """
    trackAnalyticsEvent(
      workspaceId: ID!
      eventType: String!
      eventData: JSON
      sessionId: String
    ): Boolean!
  }

  extend type Subscription {
    """
    Subscribe to real-time analytics updates
    """
    analyticsUpdated(workspaceId: ID!): RealTimeStats!
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate date range based on period
 */
function calculateDateRange(period: AnalyticsPeriodValue, startDate?: Date, endDate?: Date): DateRange {
  const end = endDate ?? new Date();
  let start: Date;

  switch (period) {
    case 'day':
      start = new Date(end);
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'custom':
      start = startDate ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(end);
      start.setDate(start.getDate() - 7);
  }

  return { start: startDate ?? start, end };
}

/**
 * Calculate trend direction
 */
function calculateTrend(current: number, previous: number): TrendDirectionValue {
  const threshold = 0.01; // 1% threshold for stable
  const changePercent = previous > 0 ? (current - previous) / previous : 0;

  if (changePercent > threshold) return 'up';
  if (changePercent < -threshold) return 'down';
  return 'stable';
}

/**
 * Generate a unique ID for reports
 */
function generateReportId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// DEFAULT METRICS FACTORY
// =============================================================================

/**
 * Create default empty metrics
 */
function createDefaultMetrics(
  workspaceId: string,
  period: AnalyticsPeriodValue,
  dateRange: DateRange
): UsageMetrics {
  return {
    workspaceId,
    period,
    startDate: dateRange.start,
    endDate: dateRange.end,
    messages: {
      total: 0,
      byDay: [],
      byChannel: [],
      byUser: [],
      averagePerDay: 0,
      threadsCreated: 0,
      reactionsAdded: 0,
    },
    users: {
      totalMembers: 0,
      activeUsers: 0,
      newUsers: 0,
      dailyActiveUsers: [],
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      averageSessionDuration: 0,
      topContributors: [],
    },
    channels: {
      total: 0,
      public: 0,
      private: 0,
      newChannels: 0,
      mostActive: [],
      averageMessagesPerChannel: 0,
    },
    files: {
      totalUploaded: 0,
      totalSize: 0,
      byType: [],
      topUploaders: [],
      averageSizeBytes: 0,
    },
    calls: {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      averageParticipants: 0,
      byDay: [],
      peakHours: [],
    },
    vp: {
      totalVPs: 0,
      activeVPs: 0,
      messagesSent: 0,
      messagesReceived: 0,
      tasksCompleted: 0,
      averageResponseTime: 0,
      byVP: [],
    },
  };
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Analytics query resolvers
 */
export const analyticsQueries = {
  /**
   * Get comprehensive usage metrics
   */
  analyticsMetrics: async (
    _parent: unknown,
    { input }: {
      input: {
        workspaceId: string;
        period: AnalyticsPeriodValue;
        startDate?: Date;
        endDate?: Date;
        metrics?: string[];
        groupBy?: string;
      };
    },
    context: AnalyticsGraphQLContext
  ): Promise<UsageMetrics> => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    // If analytics service is available, use it
    if (context.services.analytics) {
      return context.services.analytics.getMetrics({
        workspaceId: input.workspaceId,
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate,
        metrics: input.metrics,
        groupBy: input.groupBy as 'day' | 'week' | 'month' | undefined,
      });
    }

    // Fallback: return default metrics structure
    const dateRange = calculateDateRange(input.period, input.startDate, input.endDate);
    return createDefaultMetrics(input.workspaceId, input.period, dateRange);
  },

  /**
   * Get trend data comparing periods
   */
  analyticsTrend: async (
    _parent: unknown,
    { input }: {
      input: {
        workspaceId: string;
        metric: string;
        currentStart: Date;
        currentEnd: Date;
        previousStart: Date;
        previousEnd: Date;
      };
    },
    context: AnalyticsGraphQLContext
  ): Promise<TrendData> => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    // If analytics service is available, use it
    if (context.services.analytics) {
      return context.services.analytics.getTrend(
        input.workspaceId,
        input.metric,
        { start: input.currentStart, end: input.currentEnd },
        { start: input.previousStart, end: input.previousEnd }
      );
    }

    // Fallback: return neutral trend
    return {
      current: 0,
      previous: 0,
      change: 0,
      changePercent: 0,
      trend: 'stable',
    };
  },

  /**
   * Generate insights report
   */
  analyticsInsights: async (
    _parent: unknown,
    { workspaceId, period }: {
      workspaceId: string;
      period: AnalyticsPeriodValue;
    },
    context: AnalyticsGraphQLContext
  ): Promise<InsightReport> => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    // If analytics service is available, use it
    if (context.services.analytics) {
      return context.services.analytics.generateInsightReport(workspaceId, period);
    }

    // Fallback: return empty report
    return {
      id: generateReportId(),
      workspaceId,
      period,
      generatedAt: new Date(),
      highlights: [],
      recommendations: [],
    };
  },

  /**
   * Get real-time statistics
   */
  analyticsRealTime: async (
    _parent: unknown,
    { workspaceId }: { workspaceId: string },
    context: AnalyticsGraphQLContext
  ): Promise<RealTimeStats> => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    // If analytics service is available, use it
    if (context.services.analytics) {
      const stats = await context.services.analytics.getRealTimeStats(workspaceId);
      return {
        stats,
        timestamp: new Date(),
      };
    }

    // Fallback: return empty stats
    return {
      stats: {
        activeUsers: 0,
        onlineVPs: 0,
        messagesLastHour: 0,
        activeCalls: 0,
      },
      timestamp: new Date(),
    };
  },
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Analytics mutation resolvers
 */
export const analyticsMutations = {
  /**
   * Track an analytics event
   */
  trackAnalyticsEvent: async (
    _parent: unknown,
    { workspaceId, eventType, eventData, sessionId }: {
      workspaceId: string;
      eventType: string;
      eventData?: Record<string, unknown>;
      sessionId?: string;
    },
    context: AnalyticsGraphQLContext
  ): Promise<boolean> => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    // If analytics service is available, use it
    if (context.services.analytics) {
      await context.services.analytics.track({
        workspaceId,
        userId: context.user.id,
        eventType,
        eventData: eventData ?? {},
        sessionId,
      });
      return true;
    }

    // Fallback: acknowledge the event (could be logged to Redis in production)
    return true;
  },
};

// =============================================================================
// SUBSCRIPTIONS
// =============================================================================

/**
 * Analytics subscription resolvers
 */
export const analyticsSubscriptions = {
  /**
   * Subscribe to real-time analytics updates
   */
  analyticsUpdated: {
    subscribe: async function* (
      _parent: unknown,
      { workspaceId }: { workspaceId: string },
      context: AnalyticsGraphQLContext
    ): AsyncGenerator<{ analyticsUpdated: RealTimeStats }> {
      if (!context.user?.id) {
        throw new Error('Authentication required');
      }

      // In production, this would use Redis pub/sub
      // For now, poll at regular intervals
      while (true) {
        let stats: Record<string, unknown>;

        if (context.services.analytics) {
          stats = await context.services.analytics.getRealTimeStats(workspaceId);
        } else {
          stats = {
            activeUsers: 0,
            onlineVPs: 0,
            messagesLastHour: 0,
            activeCalls: 0,
          };
        }

        yield {
          analyticsUpdated: {
            stats,
            timestamp: new Date(),
          },
        };

        // Poll every 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    },
  },
};

// =============================================================================
// FIELD RESOLVERS
// =============================================================================

/**
 * Field resolvers for UsageMetrics type
 */
export const UsageMetricsFieldResolvers = {
  /**
   * Ensure period enum is lowercase
   */
  period: (parent: UsageMetrics) => parent.period.toLowerCase(),
};

/**
 * Field resolvers for InsightReport type
 */
export const InsightReportFieldResolvers = {
  /**
   * Ensure period enum is lowercase
   */
  period: (parent: InsightReport) => parent.period.toLowerCase(),
};

/**
 * Field resolvers for TrendData type
 */
export const TrendDataFieldResolvers = {
  /**
   * Ensure trend enum is lowercase
   */
  trend: (parent: TrendData) => parent.trend.toLowerCase(),
};

/**
 * Field resolvers for InsightHighlight type
 */
export const InsightHighlightFieldResolvers = {
  /**
   * Ensure type enum is lowercase
   */
  type: (parent: InsightHighlight) => parent.type.toLowerCase(),
};

/**
 * Field resolvers for InsightRecommendation type
 */
export const InsightRecommendationFieldResolvers = {
  /**
   * Ensure priority enum is lowercase
   */
  priority: (parent: InsightRecommendation) => parent.priority.toLowerCase(),
};

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined analytics resolvers for schema stitching
 */
export const analyticsResolvers = {
  Query: analyticsQueries,
  Mutation: analyticsMutations,
  Subscription: analyticsSubscriptions,
  UsageMetrics: UsageMetricsFieldResolvers,
  InsightReport: InsightReportFieldResolvers,
  TrendData: TrendDataFieldResolvers,
  InsightHighlight: InsightHighlightFieldResolvers,
  InsightRecommendation: InsightRecommendationFieldResolvers,
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create analytics resolvers with injected context
 *
 * @param context - The analytics resolver context with prisma and redis
 * @returns Configured analytics resolvers
 *
 * @example
 * ```typescript
 * const resolvers = createAnalyticsResolvers({
 *   prisma: prismaClient,
 *   redis: redisClient,
 *   userId: 'user_123',
 * });
 * ```
 */
export function createAnalyticsResolvers(context: AnalyticsResolverContext) {
  const baseContext: AnalyticsGraphQLContext = {
    services: {},
    user: { id: context.userId },
    prisma: context.prisma,
    redis: context.redis,
  };

  return {
    Query: {
      analyticsMetrics: (_: unknown, args: Parameters<typeof analyticsQueries.analyticsMetrics>[1]) =>
        analyticsQueries.analyticsMetrics(_, args, baseContext),
      analyticsTrend: (_: unknown, args: Parameters<typeof analyticsQueries.analyticsTrend>[1]) =>
        analyticsQueries.analyticsTrend(_, args, baseContext),
      analyticsInsights: (_: unknown, args: Parameters<typeof analyticsQueries.analyticsInsights>[1]) =>
        analyticsQueries.analyticsInsights(_, args, baseContext),
      analyticsRealTime: (_: unknown, args: Parameters<typeof analyticsQueries.analyticsRealTime>[1]) =>
        analyticsQueries.analyticsRealTime(_, args, baseContext),
    },
    Mutation: {
      trackAnalyticsEvent: (_: unknown, args: Parameters<typeof analyticsMutations.trackAnalyticsEvent>[1]) =>
        analyticsMutations.trackAnalyticsEvent(_, args, baseContext),
    },
    Subscription: analyticsSubscriptions,
    UsageMetrics: UsageMetricsFieldResolvers,
    InsightReport: InsightReportFieldResolvers,
    TrendData: TrendDataFieldResolvers,
    InsightHighlight: InsightHighlightFieldResolvers,
    InsightRecommendation: InsightRecommendationFieldResolvers,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default analyticsResolvers;
