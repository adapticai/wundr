/**
 * Context Expansion API Route
 *
 * Expands context by finding related items.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { expandContext } from '@/lib/ai/rag-retrieval';
import type { ContextSource } from '@/lib/ai/context-builder';

import type { NextRequest } from 'next/server';

/**
 * POST /api/ai/context/expand
 *
 * Find related context sources
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
    const { source, workspaceId, limit = 5 } = body;

    if (!source || !source.type || !source.id) {
      return NextResponse.json(
        { error: 'Valid source object is required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const relatedSources = await expandContext(
      source as ContextSource,
      workspaceId,
      session.user.id,
      limit
    );

    return NextResponse.json({ relatedSources });
  } catch (error) {
    console.error('[POST /api/ai/context/expand] Error:', error);
    return NextResponse.json(
      { error: 'Failed to expand context' },
      { status: 500 }
    );
  }
}
