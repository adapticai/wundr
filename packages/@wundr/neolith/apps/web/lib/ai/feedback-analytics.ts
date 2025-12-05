/**
 * AI Feedback Analytics Helpers
 *
 * Utilities for analyzing and aggregating AI feedback data
 *
 * @module lib/ai/feedback-analytics
 */

import { prisma } from '@neolith/database';

/**
 * Feedback sentiment type
 */
export type FeedbackSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

/**
 * Feedback category type
 */
export type FeedbackCategory =
  | 'accuracy'
  | 'helpfulness'
  | 'clarity'
  | 'relevance'
  | 'tone'
  | 'other';

/**
 * Feedback aggregation result
 */
export interface FeedbackAggregation {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positiveRate: number;
  categories: Record<string, number>;
  avgResponseTime?: number;
}

/**
 * Feedback trend data point
 */
export interface FeedbackTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

/**
 * Get aggregated feedback statistics for a workspace
 */
export async function getFeedbackStats(
  workspaceId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    responseId?: string;
  }
): Promise<FeedbackAggregation> {
  const where: any = { workspaceId };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  if (options?.responseId) {
    where.responseId = options.responseId;
  }

  const [sentimentCounts, categoryCounts, total] = await Promise.all([
    prisma.aiFeedback.groupBy({
      by: ['sentiment'],
      where,
      _count: { sentiment: true },
    }),
    prisma.aiFeedback.groupBy({
      by: ['category'],
      where: { ...where, category: { not: null } },
      _count: { category: true },
    }),
    prisma.aiFeedback.count({ where }),
  ]);

  const sentiments = sentimentCounts.reduce(
    (acc, item) => {
      acc[item.sentiment.toLowerCase()] = item._count.sentiment;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 } as Record<string, number>
  );

  const categories = categoryCounts.reduce(
    (acc, item) => {
      if (item.category) {
        acc[item.category] = item._count.category;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const positiveRate = total > 0 ? (sentiments.positive / total) * 100 : 0;

  return {
    total,
    positive: sentiments.positive,
    negative: sentiments.negative,
    neutral: sentiments.neutral,
    positiveRate: parseFloat(positiveRate.toFixed(2)),
    categories,
  };
}

/**
 * Get feedback trends over time
 */
export async function getFeedbackTrends(
  workspaceId: string,
  days: number = 30
): Promise<FeedbackTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const trends = (await prisma.$queryRaw`
    SELECT
      DATE(created_at) as date,
      sentiment,
      COUNT(*) as count
    FROM ai_feedback
    WHERE workspace_id = ${workspaceId}
      AND created_at >= ${startDate}
    GROUP BY DATE(created_at), sentiment
    ORDER BY date ASC
  `) as Array<{ date: Date; sentiment: string; count: bigint }>;

  // Group by date
  const dateMap = new Map<string, FeedbackTrend>();

  trends.forEach(item => {
    const dateStr = item.date.toISOString().split('T')[0];
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0,
      });
    }

    const trend = dateMap.get(dateStr)!;
    const count = Number(item.count);
    trend[item.sentiment.toLowerCase() as 'positive' | 'negative' | 'neutral'] =
      count;
    trend.total += count;
  });

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Get top issues from feedback comments
 */
export async function getTopIssues(
  workspaceId: string,
  limit: number = 10
): Promise<
  Array<{
    category: string;
    count: number;
    percentage: number;
    sampleComments: string[];
  }>
> {
  const stats = await getFeedbackStats(workspaceId);

  const issues = await Promise.all(
    Object.entries(stats.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(async ([category, count]) => {
        const feedback = await prisma.aiFeedback.findMany({
          where: {
            workspaceId,
            category,
            comment: { not: null },
          },
          select: { comment: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
        });

        return {
          category,
          count,
          percentage: (count / stats.total) * 100,
          sampleComments: feedback
            .map(f => f.comment)
            .filter((c): c is string => c !== null),
        };
      })
  );

  return issues;
}

/**
 * Get feedback sentiment for a specific response
 */
export async function getResponseFeedback(responseId: string): Promise<{
  sentiment: FeedbackSentiment | null;
  count: number;
  hasDetailed: boolean;
}> {
  const feedback = await prisma.aiFeedback.findMany({
    where: { responseId },
    select: {
      sentiment: true,
      category: true,
      comment: true,
    },
  });

  if (feedback.length === 0) {
    return { sentiment: null, count: 0, hasDetailed: false };
  }

  // Calculate dominant sentiment
  const sentimentCounts = feedback.reduce(
    (acc, f) => {
      acc[f.sentiment]++;
      return acc;
    },
    { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 } as Record<
      FeedbackSentiment,
      number
    >
  );

  const dominantSentiment = (
    Object.entries(sentimentCounts) as [FeedbackSentiment, number][]
  ).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  const hasDetailed = feedback.some(
    f => f.category !== null || f.comment !== null
  );

  return {
    sentiment: dominantSentiment,
    count: feedback.length,
    hasDetailed,
  };
}

/**
 * Calculate feedback quality score
 */
export function calculateQualityScore(stats: FeedbackAggregation): number {
  if (stats.total === 0) return 0;

  // Weighted scoring: positive = 1, neutral = 0.5, negative = 0
  const score =
    (stats.positive * 1.0 + stats.neutral * 0.5 + stats.negative * 0) /
    stats.total;

  return parseFloat((score * 100).toFixed(2));
}

/**
 * Get feedback summary for a time period
 */
export async function getFeedbackSummary(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  stats: FeedbackAggregation;
  trends: FeedbackTrend[];
  topIssues: Awaited<ReturnType<typeof getTopIssues>>;
  qualityScore: number;
}> {
  const [stats, trends, topIssues] = await Promise.all([
    getFeedbackStats(workspaceId, { startDate, endDate }),
    getFeedbackTrends(
      workspaceId,
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    ),
    getTopIssues(workspaceId),
  ]);

  const qualityScore = calculateQualityScore(stats);

  return {
    stats,
    trends,
    topIssues,
    qualityScore,
  };
}

/**
 * Export feedback data
 */
export async function exportFeedback(
  workspaceId: string,
  options?: {
    format?: 'json' | 'csv';
    startDate?: Date;
    endDate?: Date;
    includeAnonymous?: boolean;
  }
) {
  const where: any = { workspaceId };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  if (!options?.includeAnonymous) {
    where.isAnonymous = false;
  }

  const feedback = await prisma.aiFeedback.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return feedback;
}
