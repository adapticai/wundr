/**
 * Universal Subagent API Routes
 *
 * Handles listing global/universal subagents that are available across session managers.
 *
 * Routes:
 * - GET /api/subagents/universal - List universal subagents
 *
 * @module app/api/subagents/universal/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Error codes for subagent operations
 */
const SUBAGENT_ERROR_CODES = {
  UNAUTHORIZED: 'SUBAGENT_UNAUTHORIZED',
  VALIDATION_ERROR: 'SUBAGENT_VALIDATION_ERROR',
  INTERNAL_ERROR: 'SUBAGENT_INTERNAL_ERROR',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof SUBAGENT_ERROR_CODES)[keyof typeof SUBAGENT_ERROR_CODES],
  details?: Record<string, unknown>
) {
  return {
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * GET /api/subagents/universal
 *
 * List universal/global subagents available to any session manager.
 * Filters by isGlobal=true.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of universal subagents
 *
 * @example
 * ```
 * GET /api/subagents/universal?scope=ORGANIZATION&skip=0&take=50
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          SUBAGENT_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const scope = searchParams.get('scope');
    const status = searchParams.get('status');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');
    const search = searchParams.get('search');

    // Build where clause - only global subagents
    const where: Prisma.subagentWhereInput = {
      isGlobal: true,
      ...(scope && { scope: scope as Prisma.EnumAgentScopeFilter }),
      ...(status && { status: status as Prisma.EnumAgentStatusFilter }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Fetch universal subagents and total count in parallel
    const [data, total] = await Promise.all([
      prisma.subagent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          sessionManager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.subagent.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/subagents/universal] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SUBAGENT_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/subagents/universal
 *
 * Create a universal subagent available to any session manager.
 * Requires authentication and admin privileges.
 *
 * @param request - Next.js request with subagent creation data
 * @returns Created universal subagent object
 *
 * @example
 * ```
 * POST /api/subagents/universal
 * Content-Type: application/json
 *
 * {
 *   "name": "Code Reviewer",
 *   "description": "Reviews code for quality and best practices",
 *   "charterId": "charter_code_reviewer_v1",
 *   "charterData": { ... },
 *   "tier": 3,
 *   "capabilities": ["code_review", "linting", "security_scan"],
 *   "mcpTools": ["grep", "read", "edit"],
 *   "maxTokensPerTask": 50000,
 *   "worktreeRequirement": "read"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          SUBAGENT_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          SUBAGENT_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const input = body as {
      name: string;
      description?: string;
      charterId: string;
      charterData: Record<string, unknown>;
      tier?: number;
      capabilities?: string[];
      mcpTools?: string[];
      maxTokensPerTask?: number;
      worktreeRequirement?: string;
    };

    // Validate required fields
    if (!input.name || !input.charterId || !input.charterData) {
      return NextResponse.json(
        createErrorResponse(
          'Missing required fields: name, charterId, charterData',
          SUBAGENT_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Create universal subagent
    const subagent = await prisma.subagent.create({
      data: {
        name: input.name,
        description: input.description,
        charterId: input.charterId,
        charterData: input.charterData as Prisma.InputJsonValue,
        isGlobal: true,
        scope: 'UNIVERSAL' as const,
        tier: input.tier ?? 3,
        capabilities: (input.capabilities ?? []) as Prisma.InputJsonValue,
        mcpTools: input.mcpTools ?? [],
        maxTokensPerTask: input.maxTokensPerTask ?? 50000,
        worktreeRequirement: input.worktreeRequirement ?? 'read',
        status: 'ACTIVE' as const, // Universal subagents start active
      },
    });

    return NextResponse.json(
      {
        data: subagent,
        message: 'Universal subagent created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/subagents/universal] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SUBAGENT_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
