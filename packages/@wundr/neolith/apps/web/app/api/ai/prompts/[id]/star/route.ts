/**
 * AI Prompt Template Star API Route
 *
 * Handles starring/unstarring prompt templates.
 *
 * Routes:
 * - POST /api/ai/prompts/:id/star - Toggle star on template
 *
 * @module app/api/ai/prompts/[id]/star/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with prompt ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/ai/prompts/:id/star
 *
 * Toggle star on a prompt template. If already starred, unstars it.
 * If not starred, stars it. Updates the template's star count.
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Star status
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { id } = params;

    // Cannot star system templates
    if (id.startsWith('system-')) {
      return NextResponse.json(
        { error: 'Cannot star system templates', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Check if template exists
    const template = await prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true, starCount: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if already starred
    const existingStar = await prisma.promptTemplateStar.findUnique({
      where: {
        promptTemplateId_userId: {
          promptTemplateId: id,
          userId: session.user.id,
        },
      },
    });

    let isStarred: boolean;
    let newStarCount: number;

    if (existingStar) {
      // Unstar
      await prisma.$transaction([
        prisma.promptTemplateStar.delete({
          where: {
            promptTemplateId_userId: {
              promptTemplateId: id,
              userId: session.user.id,
            },
          },
        }),
        prisma.promptTemplate.update({
          where: { id },
          data: { starCount: { decrement: 1 } },
        }),
      ]);
      isStarred = false;
      newStarCount = template.starCount - 1;
    } else {
      // Star
      await prisma.$transaction([
        prisma.promptTemplateStar.create({
          data: {
            promptTemplateId: id,
            userId: session.user.id,
          },
        }),
        prisma.promptTemplate.update({
          where: { id },
          data: { starCount: { increment: 1 } },
        }),
      ]);
      isStarred = true;
      newStarCount = template.starCount + 1;
    }

    return NextResponse.json({
      data: {
        id,
        isStarred,
        starCount: newStarCount,
      },
    });
  } catch (error) {
    console.error('[POST /api/ai/prompts/:id/star] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
