/**
 * Context Suggestions API Route
 *
 * Provides intelligent context source suggestions based on queries.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { suggestContextSources } from '@/lib/ai/rag-retrieval';

import type { NextRequest } from 'next/server';

/**
 * GET /api/ai/context/suggest
 *
 * Get suggested context sources based on query
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const workspaceId = searchParams.get('workspaceId');
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const sources = await suggestContextSources(
      query,
      workspaceId,
      session.user.id,
      limit
    );

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('[GET /api/ai/context/suggest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}
