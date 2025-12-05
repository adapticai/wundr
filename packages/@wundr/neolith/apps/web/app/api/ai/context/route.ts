/**
 * AI Context API Routes
 *
 * Handles building and managing context for AI conversations.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  buildContext,
  formatContextForPrompt,
  getAvailableContextSources,
  type ContextBuildOptions,
} from '@/lib/ai/context-builder';
import {
  retrieveRelevantContext,
  suggestContextSources,
  expandContext,
} from '@/lib/ai/rag-retrieval';

import type { NextRequest } from 'next/server';

/**
 * POST /api/ai/context
 *
 * Build context from selected sources
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
      sources,
      maxTokens = 4000,
      workspaceId,
      query,
      includeMetadata = true,
      format = 'structured',
    } = body;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'Sources array is required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const options: ContextBuildOptions = {
      sources,
      maxTokens,
      includeMetadata,
      query,
      userId: session.user.id,
    };

    const context = await buildContext(options);

    // Return formatted or structured response
    if (format === 'prompt') {
      return NextResponse.json({
        prompt: formatContextForPrompt(context),
        totalTokens: context.totalTokens,
        truncated: context.truncated,
      });
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error('[POST /api/ai/context] Error:', error);
    return NextResponse.json(
      { error: 'Failed to build context' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/context/sources
 *
 * Get available context sources for a workspace
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
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const sources = await getAvailableContextSources(
      workspaceId,
      session.user.id
    );

    return NextResponse.json(sources);
  } catch (error) {
    console.error('[GET /api/ai/context/sources] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load sources' },
      { status: 500 }
    );
  }
}
