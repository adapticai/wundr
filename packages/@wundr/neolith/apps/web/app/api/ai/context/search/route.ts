/**
 * Context Search API Route
 *
 * RAG-style semantic search across workspace content.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { retrieveRelevantContext, type RAGQuery } from '@/lib/ai/rag-retrieval';

import type { NextRequest } from 'next/server';

/**
 * POST /api/ai/context/search
 *
 * Semantic search for relevant context
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      query: searchQuery,
      workspaceId,
      filters,
      limit = 10,
      minRelevance = 0.3,
    } = body;

    if (!searchQuery) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const ragQuery: RAGQuery = {
      query: searchQuery,
      workspaceId,
      userId: session.user.id,
      filters: filters || {},
      limit,
      minRelevance,
    };

    const results = await retrieveRelevantContext(ragQuery);

    return NextResponse.json({
      results,
      totalResults: results.length,
      query: searchQuery,
    });
  } catch (error) {
    console.error('[POST /api/ai/context/search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
