/**
 * AI Prompt Template Usage Tracking API Route
 *
 * Handles tracking usage statistics for prompt templates.
 *
 * Routes:
 * - POST /api/ai/prompts/:id/use - Increment usage count
 *
 * @module app/api/ai/prompts/[id]/use/route
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
 * POST /api/ai/prompts/:id/use
 *
 * Increment the usage count for a prompt template. This tracks
 * how many times a template has been used.
 *
 * @param request - Next.js request object
 * @param context - Route context containing prompt ID
 * @returns Updated usage count
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

    // Cannot track usage for system templates
    if (id.startsWith('system-')) {
      return NextResponse.json({ data: { id, usageCount: 0 } });
    }

    // Check if template exists
    const template = await prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true, usageCount: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Increment usage count
    const updated = await prisma.promptTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
      select: { id: true, usageCount: true },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        usageCount: updated.usageCount,
      },
    });
  } catch (error) {
    console.error('[POST /api/ai/prompts/:id/use] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
