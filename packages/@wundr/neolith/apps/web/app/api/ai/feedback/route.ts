/**
 * AI Feedback API Route
 *
 * Collects user feedback on AI-generated responses to improve quality over time.
 * Features:
 * - Quick thumbs up/down feedback
 * - Detailed category-based feedback
 * - Anonymous feedback support
 * - Aggregated analytics
 * - Export capabilities
 *
 * Routes:
 * - POST /api/ai/feedback - Submit feedback
 * - GET /api/ai/feedback - Get feedback list (admin)
 * - GET /api/ai/feedback/stats - Get aggregated statistics
 * - GET /api/ai/feedback/export - Export feedback data
 *
 * @module app/api/ai/feedback/route
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@neolith/database';

/**
 * Feedback submission schema
 */
const feedbackSchema = z.object({
  responseId: z.string().min(1),
  sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
  category: z
    .enum(['accuracy', 'helpfulness', 'clarity', 'relevance', 'tone', 'other'])
    .optional(),
  comment: z.string().max(2000).optional(),
  isAnonymous: z.boolean().default(false),
  workspaceId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

type FeedbackRequest = z.infer<typeof feedbackSchema>;

/**
 * Error response helper
 */
function errorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code: `AI_FEEDBACK_ERROR_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * POST /api/ai/feedback
 *
 * Submit feedback on an AI response
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    // 2. Parse and validate request
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const validation = feedbackSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
        400
      );
    }

    const feedbackData: FeedbackRequest = validation.data;

    // 3. Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: feedbackData.workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return errorResponse('Workspace not found or access denied', 403);
    }

    // 4. Check for duplicate feedback on same response
    const existingFeedback = await prisma.aiFeedback.findFirst({
      where: {
        responseId: feedbackData.responseId,
        userId: feedbackData.isAnonymous ? null : session.user.id,
        workspaceId: feedbackData.workspaceId,
      },
    });

    let feedback;

    if (existingFeedback) {
      // Update existing feedback
      feedback = await prisma.aiFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          sentiment: feedbackData.sentiment,
          category: feedbackData.category,
          comment: feedbackData.comment,
          metadata: (feedbackData.metadata || {}) as Record<string, never>,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });
    } else {
      // Create new feedback
      feedback = await prisma.aiFeedback.create({
        data: {
          responseId: feedbackData.responseId,
          sentiment: feedbackData.sentiment,
          category: feedbackData.category,
          comment: feedbackData.comment,
          isAnonymous: feedbackData.isAnonymous,
          workspaceId: feedbackData.workspaceId,
          userId: feedbackData.isAnonymous ? null : session.user.id,
          metadata: (feedbackData.metadata || {}) as Record<string, never>,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      id: feedback.id,
      message: existingFeedback
        ? 'Feedback updated successfully'
        : 'Feedback submitted successfully',
      feedback: {
        ...feedback,
        user: feedbackData.isAnonymous ? null : feedback.user,
      },
    });
  } catch (error) {
    console.error('[POST /api/ai/feedback] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An internal error occurred'
    );
  }
}

/**
 * GET /api/ai/feedback
 *
 * Get feedback list (admin/workspace owners only)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const sentiment = searchParams.get('sentiment');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );

    if (!workspaceId) {
      return errorResponse('workspaceId is required', 400);
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

    // Build query filters
    const where: Record<string, unknown> = { workspaceId };
    if (sentiment) {
      where.sentiment = sentiment;
    }
    if (category) {
      where.category = category;
    }

    // Get feedback with pagination
    const [feedback, total] = await Promise.all([
      prisma.aiFeedback.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aiFeedback.count({ where }),
    ]);

    return NextResponse.json({
      feedback,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/feedback] Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An internal error occurred'
    );
  }
}
