/**
 * OrchestratorMemory Search API Route
 *
 * Handles searching Orchestrator memories with semantic search capabilities.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/memory/search - Search memories
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/memory/search/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  memorySearchSchema,
  createErrorResponse,
  MEMORY_ERROR_CODES,
} from '@/lib/validations/orchestrator-memory';

import type { MemorySearchInput } from '@/lib/validations/orchestrator-memory';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with params as a Promise (Next.js 16+)
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    orchestratorId: string;
  }>;
}

/**
 * Helper to verify Orchestrator access
 */
async function verifyVPAccess(
  workspaceId: string,
  orchestratorId: string,
  userId: string,
): Promise<boolean> {
  // Check user has access to workspace
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
    },
  });

  if (!workspaceMember) {
    return false;
  }

  // Verify Orchestrator exists
  const orchestrator = await prisma.vP.findFirst({
    where: {
      id: orchestratorId,
    },
    select: { id: true, workspaceId: true },
  });

  if (!orchestrator) {
    return false;
  }

  // Check Orchestrator belongs to workspace
  if (orchestrator.workspaceId && orchestrator.workspaceId !== workspaceId) {
    return false;
  }

  return true;
}

/**
 * GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/memory/search
 *
 * Search memories for a specific Orchestrator using text-based search.
 * Supports filtering by memory type and importance.
 *
 * Query Parameters:
 * - query: Search query (required)
 * - memoryType: Filter by type (conversation, task_completion, learned_pattern, preference)
 * - minImportance: Minimum importance score (0.0-1.0)
 * - limit: Maximum results (default 20, max 100)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId and orchestratorId
 * @returns Matching memories ordered by relevance and importance
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MEMORY_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const resolvedParams = await params;
    const { workspaceId, orchestratorId } = resolvedParams;

    // Verify access
    const hasAccess = await verifyVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          MEMORY_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const searchInput = {
      query: searchParams.get('query') || '',
      memoryType: searchParams.get('memoryType') || undefined,
      minImportance: searchParams.get('minImportance') || undefined,
      limit: searchParams.get('limit') || '20',
    };

    const parseResult = memorySearchSchema.safeParse(searchInput);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid search parameters',
          MEMORY_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const search: MemorySearchInput = parseResult.data;

    // Build where clause for text search
    const where: Prisma.vPMemoryWhereInput = {
      vpId: orchestratorId,
      content: { contains: search.query, mode: 'insensitive' as const },
      ...(search.memoryType && {
        memoryType: Array.isArray(search.memoryType)
          ? { in: search.memoryType }
          : search.memoryType,
      }),
      ...(search.minImportance !== undefined && {
        importance: { gte: search.minImportance },
      }),
      // Exclude expired memories
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    // Search memories ordered by importance and recency
    const memories = await prisma.vPMemory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: search.limit,
    });

    return NextResponse.json({
      data: memories,
      meta: {
        query: search.query,
        totalResults: memories.length,
        limit: search.limit,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/memory/search] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', MEMORY_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
