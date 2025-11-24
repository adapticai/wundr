/**
 * Enterprise Search API Routes
 *
 * Handles full-text search across workspaces with support for
 * messages, files, channels, users, and VPs.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/search - Search workspace content
 *
 * @module app/api/workspaces/[workspaceId]/search/route
 */

import { SearchServiceImpl } from '@genesis/core';
import { redis } from '@genesis/core/redis';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { SearchResultType } from '@genesis/core';
import type { NextRequest} from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/search
 *
 * Search workspace content with full-text search and filters.
 * Requires authentication and workspace membership.
 *
 * @param request - Next.js request with search query parameters
 * @param context - Route context containing workspace ID
 * @returns Search results with pagination
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/search?q=quarterly+report&types=message,file&limit=20
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

    const { workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchService = new SearchServiceImpl({ prisma, redis });

    // Parse filters
    const types = searchParams.get('types')?.split(',').filter(Boolean) as SearchResultType[] | undefined;
    const channelIds = searchParams.get('channels')?.split(',').filter(Boolean);
    const userIds = searchParams.get('users')?.split(',').filter(Boolean);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    const results = await searchService.search({
      query,
      filters: {
        workspaceId,
        types,
        channelIds,
        userIds,
        dateRange: fromDate && toDate ? {
          start: new Date(fromDate),
          end: new Date(toDate),
        } : undefined,
      },
      pagination: {
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
      },
      highlight: searchParams.get('highlight') !== 'false',
      facets: searchParams.get('facets')?.split(',').filter(Boolean),
    });

    // Save to recent searches
    await searchService.saveRecentSearch(session.user.id, query);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 },
    );
  }
}
