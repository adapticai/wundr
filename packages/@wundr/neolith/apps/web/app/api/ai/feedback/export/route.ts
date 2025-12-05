/**
 * AI Feedback Export API Route
 *
 * Export feedback data in various formats
 *
 * @module app/api/ai/feedback/export/route
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
        code: `AI_FEEDBACK_EXPORT_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Convert feedback to CSV format
 */
function toCSV(
  feedback: Array<{
    id: string;
    responseId: string;
    sentiment: string;
    category: string | null;
    comment: string | null;
    isAnonymous: boolean;
    createdAt: Date;
    user: { name: string | null; email: string } | null;
  }>
): string {
  const headers = [
    'ID',
    'Response ID',
    'Sentiment',
    'Category',
    'Comment',
    'Anonymous',
    'User Name',
    'User Email',
    'Created At',
  ];

  const rows = feedback.map(item => [
    item.id,
    item.responseId,
    item.sentiment,
    item.category || '',
    item.comment ? item.comment.replace(/"/g, '""') : '',
    item.isAnonymous ? 'Yes' : 'No',
    item.user?.name || 'Anonymous',
    item.isAnonymous ? '' : item.user?.email || '',
    item.createdAt.toISOString(),
  ]);

  return [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

/**
 * GET /api/ai/feedback/export
 *
 * Export feedback data
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId) {
      return errorResponse('workspaceId is required', 400);
    }

    if (!['json', 'csv'].includes(format)) {
      return errorResponse('Invalid format. Use json or csv', 400);
    }

    // Verify admin access
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

    // Get all feedback
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

    // Return in requested format
    if (format === 'csv') {
      const csv = toCSV(feedback);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-feedback-${workspaceId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      workspaceId,
      exportDate: new Date().toISOString(),
      count: feedback.length,
      feedback: feedback.map(
        (item: {
          id: string;
          responseId: string;
          sentiment: string;
          category: string | null;
          comment: string | null;
          isAnonymous: boolean;
          metadata: unknown;
          user: { name: string | null; email: string } | null;
          createdAt: Date;
          updatedAt: Date;
        }) => ({
          id: item.id,
          responseId: item.responseId,
          sentiment: item.sentiment,
          category: item.category,
          comment: item.comment,
          isAnonymous: item.isAnonymous,
          metadata: item.metadata,
          user: item.isAnonymous
            ? null
            : {
                name: item.user?.name,
                email: item.user?.email,
              },
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
      ),
    });
  } catch (error) {
    console.error('[GET /api/ai/feedback/export] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An internal error occurred'
    );
  }
}
