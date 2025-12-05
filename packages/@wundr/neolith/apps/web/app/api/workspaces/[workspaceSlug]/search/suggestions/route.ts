/**
 * Search Suggestions API Routes
 *
 * Provides auto-complete suggestions for search queries including
 * recent searches and contextual suggestions.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/search/suggestions - Get search suggestions
 *
 * @module app/api/workspaces/[workspaceId]/search/suggestions/route
 */

import { SearchServiceImpl } from '@neolith/core';
import { redis } from '@neolith/core/redis';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/search/suggestions
 *
 * Get search suggestions based on query prefix.
 * Returns recent searches and contextual suggestions.
 *
 * @param request - Next.js request with query prefix
 * @param context - Route context containing workspace ID
 * @returns Array of search suggestions
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/search/suggestions?q=quart&limit=5
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchService = new SearchServiceImpl({ prisma, redis });

    const suggestions = await searchService.getSuggestions(
      query,
      workspaceId,
      session.user.id,
      parseInt(searchParams.get('limit') || '5'),
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/search/suggestions] Error:',
      error,
    );
    return NextResponse.json({ suggestions: [] });
  }
}
