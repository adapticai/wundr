/**
 * AI Feedback Statistics API Route
 *
 * Aggregated feedback statistics and analytics
 *
 * @module app/api/ai/feedback/stats/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

/**
 * Error response helper
 */
function errorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code: `AI_FEEDBACK_STATS_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * GET /api/ai/feedback/stats
 *
 * Get aggregated feedback statistics
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId) {
      return errorResponse('workspaceId is required', 400);
    }

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return errorResponse('Insufficient permissions', 403);
    }

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const where: Record<string, unknown> = { workspaceId };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    // Get aggregated statistics
    const [
      totalFeedback,
      sentimentCounts,
      categoryCounts,
      recentFeedback,
      trendData,
    ] = await Promise.all([
      // Total count
      prisma.aiFeedback.count({ where }),

      // Sentiment breakdown
      prisma.aiFeedback.groupBy({
        by: ['sentiment'],
        where,
        _count: { sentiment: true },
      }),

      // Category breakdown
      prisma.aiFeedback.groupBy({
        by: ['category'],
        where: { ...where, category: { not: null } },
        _count: { category: true },
      }),

      // Recent feedback items
      prisma.aiFeedback.findMany({
        where,
        select: {
          id: true,
          sentiment: true,
          category: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Trend data (last 30 days)
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          sentiment,
          COUNT(*) as count
        FROM ai_feedback
        WHERE workspace_id = ${workspaceId}
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at), sentiment
        ORDER BY date DESC
      `,
    ]);

    // Calculate sentiment percentages
    const sentimentStats = sentimentCounts.reduce(
      (
        acc: Record<string, number>,
        item: { sentiment: string; _count: { sentiment: number } }
      ) => {
        acc[item.sentiment.toLowerCase()] = item._count.sentiment;
        return acc;
      },
      { positive: 0, negative: 0, neutral: 0 } as Record<string, number>
    );

    const positiveRate =
      totalFeedback > 0
        ? ((sentimentStats.positive / totalFeedback) * 100).toFixed(1)
        : '0.0';

    // Calculate category distribution
    const categoryStats = categoryCounts.reduce(
      (
        acc: Record<string, number>,
        item: { category: string | null; _count: { category: number } }
      ) => {
        if (item.category) {
          acc[item.category] = item._count.category;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      overview: {
        total: totalFeedback,
        positive: sentimentStats.positive,
        negative: sentimentStats.negative,
        neutral: sentimentStats.neutral,
        positiveRate: parseFloat(positiveRate),
      },
      sentiments: sentimentStats,
      categories: categoryStats,
      recentFeedback,
      trendData,
    });
  } catch (error) {
    console.error('[GET /api/ai/feedback/stats] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An internal error occurred'
    );
  }
}
