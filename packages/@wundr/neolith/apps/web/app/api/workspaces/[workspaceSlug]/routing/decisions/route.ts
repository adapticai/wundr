/**
 * Routing Decisions List API Route
 *
 * Lists recent routing decisions for a workspace with optional filtering
 * by orchestrator, discipline, and date range. Results are paginated.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceSlug]/routing/decisions - List routing decisions
 *
 * @module app/api/workspaces/[workspaceSlug]/routing/decisions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const listDecisionsQuerySchema = z.object({
  /** Filter by the orchestrator agent user ID */
  agentId: z.string().optional(),
  /** Filter by discipline keyword (matched against decision metadata) */
  discipline: z.string().optional(),
  /** ISO datetime - only include decisions created after this time */
  after: z.string().datetime().optional(),
  /** ISO datetime - only include decisions created before this time */
  before: z.string().datetime().optional(),
  /** Filter by how the routing was matched */
  matchedBy: z
    .enum([
      'direct_mention',
      'thread_continuity',
      'binding_rule',
      'discipline_match',
      'seniority_escalation',
      'load_balance',
      'fallback',
    ])
    .optional(),
  /** Whether to include only escalated decisions */
  escalated: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// =============================================================================
// Route Context
// =============================================================================

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * GET /api/workspaces/[workspaceSlug]/routing/decisions
 *
 * List routing decisions for the workspace's organization. Supports filtering
 * by agentId, discipline, date range, matchedBy strategy, and escalation flag.
 *
 * Query parameters:
 * - agentId: filter by agent user ID
 * - discipline: keyword filter against decision metadata
 * - after: ISO datetime lower bound on createdAt
 * - before: ISO datetime upper bound on createdAt
 * - matchedBy: routing strategy used
 * - escalated: "true" to show only escalated decisions
 * - page: page number (default 1)
 * - limit: results per page (default 20, max 100)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context with workspace slug
 * @returns Paginated list of routing decisions
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this workspace',
          TASK_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const rawParams = request.nextUrl.searchParams;
    const queryInput: Record<string, unknown> = {};

    for (const key of [
      'agentId',
      'discipline',
      'after',
      'before',
      'matchedBy',
      'escalated',
    ]) {
      const val = rawParams.get(key);
      if (val !== null) queryInput[key] = val;
    }
    for (const key of ['page', 'limit']) {
      const val = rawParams.get(key);
      if (val !== null) queryInput[key] = val;
    }

    const parseResult = listDecisionsQuerySchema.safeParse(queryInput);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const filters = parseResult.data;
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.routingDecisionWhereInput = {
      organizationId: workspace.organizationId,
      ...(filters.agentId && { agentId: filters.agentId }),
      ...(filters.matchedBy && { matchedBy: filters.matchedBy }),
      ...(filters.escalated !== undefined && { escalated: filters.escalated }),
      ...((filters.after || filters.before) && {
        createdAt: {
          ...(filters.after && { gte: new Date(filters.after) }),
          ...(filters.before && { lte: new Date(filters.before) }),
        },
      }),
    };

    // If filtering by discipline, apply JSON path filter on metadata
    if (filters.discipline) {
      (where as Record<string, unknown>).metadata = {
        path: ['discipline'],
        string_contains: filters.discipline,
      };
    }

    // Fetch decisions and total count in parallel
    const [decisions, totalCount] = await Promise.all([
      prisma.routingDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.routingDecision.count({ where }),
    ]);

    // Enrich with agent name lookups for decisions that lack denormalized names
    const agentIds = [
      ...new Set(decisions.map(d => d.agentId).filter(Boolean)),
    ];
    const agentUsers =
      agentIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const agentMap = new Map(agentUsers.map(u => [u.id, u]));

    const enrichedDecisions = decisions.map(d => ({
      id: d.id,
      agentId: d.agentId,
      agentName: d.agentName ?? agentMap.get(d.agentId)?.name ?? null,
      confidence: d.confidence,
      reasoning: d.reasoning,
      matchedBy: d.matchedBy,
      fallbackUsed: d.fallbackUsed,
      escalated: d.escalated,
      routingLatencyMs: d.routingLatencyMs,
      channelId: d.channelId,
      metadata: d.metadata,
      createdAt: d.createdAt,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: enrichedDecisions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/routing/decisions] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
