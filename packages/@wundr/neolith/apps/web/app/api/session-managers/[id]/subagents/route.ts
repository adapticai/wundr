/**
 * Subagent CRUD API Routes - Session Manager Scoped
 *
 * Handles listing and creating subagents for a specific session manager.
 *
 * Routes:
 * - GET /api/session-managers/:id/subagents - List subagents
 * - POST /api/session-managers/:id/subagents - Create subagent
 *
 * @module app/api/session-managers/[id]/subagents/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with session manager ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Error codes for subagent operations
 */
const SUBAGENT_ERROR_CODES = {
  UNAUTHORIZED: 'SUBAGENT_UNAUTHORIZED',
  VALIDATION_ERROR: 'SUBAGENT_VALIDATION_ERROR',
  SESSION_MANAGER_NOT_FOUND: 'SUBAGENT_SESSION_MANAGER_NOT_FOUND',
  FORBIDDEN: 'SUBAGENT_FORBIDDEN',
  INTERNAL_ERROR: 'SUBAGENT_INTERNAL_ERROR',
  SUBAGENT_NAME_EXISTS: 'SUBAGENT_NAME_EXISTS',
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
 * GET /api/session-managers/:id/subagents
 *
 * List subagents for a specific session manager with optional filtering and pagination.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing session manager ID
 * @returns Paginated list of subagents
 *
 * @example
 * ```
 * GET /api/session-managers/sm_123/subagents?status=ACTIVE&skip=0&take=50
 * ```
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
          SUBAGENT_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const sessionManagerId = params.id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const scope = searchParams.get('scope');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');

    // Verify session manager exists and user has access
    const sessionManager = await prisma.sessionManager.findUnique({
      where: { id: sessionManagerId },
      include: {
        orchestrator: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!sessionManager) {
      return NextResponse.json(
        createErrorResponse(
          'Session Manager not found',
          SUBAGENT_ERROR_CODES.SESSION_MANAGER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check organization membership
    const orgMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: sessionManager.orchestrator.organizationId,
        userId: session.user.id,
      },
    });

    if (!orgMember) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this session manager',
          SUBAGENT_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Build where clause
    const where: Prisma.subagentWhereInput = {
      sessionManagerId,
      ...(status && { status: status as any }),
      ...(scope && { scope: scope as any }),
    };

    // Fetch subagents and total count in parallel
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
    console.error('[GET /api/session-managers/:id/subagents] Error:', error);
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
 * POST /api/session-managers/:id/subagents
 *
 * Create a new subagent for a specific session manager.
 *
 * @param request - Next.js request with subagent data
 * @param context - Route context containing session manager ID
 * @returns Created subagent object
 *
 * @example
 * ```
 * POST /api/session-managers/sm_123/subagents
 * Content-Type: application/json
 *
 * {
 *   "name": "Code Analyzer",
 *   "description": "Analyzes code quality and suggests improvements",
 *   "charterId": "charter_123",
 *   "charterData": { ... },
 *   "isGlobal": false,
 *   "scope": "DISCIPLINE",
 *   "tier": 3,
 *   "capabilities": ["code-analysis", "linting"],
 *   "mcpTools": ["mcp__code_analyzer"],
 *   "maxTokensPerTask": 50000,
 *   "worktreeRequirement": "read"
 * }
 * ```
 */
export async function POST(
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
          SUBAGENT_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const params = await context.params;
    const sessionManagerId = params.id;

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
      isGlobal?: boolean;
      scope?: string;
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

    // Verify session manager exists and user has access
    const sessionManager = await prisma.sessionManager.findUnique({
      where: { id: sessionManagerId },
      include: {
        orchestrator: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!sessionManager) {
      return NextResponse.json(
        createErrorResponse(
          'Session Manager not found',
          SUBAGENT_ERROR_CODES.SESSION_MANAGER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check organization membership
    const orgMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: sessionManager.orchestrator.organizationId,
        userId: session.user.id,
      },
    });

    if (!orgMember) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this session manager',
          SUBAGENT_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Check if subagent name already exists in this session manager
    const existingSubagent = await prisma.subagent.findFirst({
      where: {
        sessionManagerId,
        name: { equals: input.name, mode: 'insensitive' },
      },
    });

    if (existingSubagent) {
      return NextResponse.json(
        createErrorResponse(
          'A subagent with this name already exists in the session manager',
          SUBAGENT_ERROR_CODES.SUBAGENT_NAME_EXISTS
        ),
        { status: 409 }
      );
    }

    // Create subagent
    const subagent = await prisma.subagent.create({
      data: {
        name: input.name,
        description: input.description,
        charterId: input.charterId,
        charterData: input.charterData as Prisma.InputJsonValue,
        sessionManagerId,
        isGlobal: input.isGlobal ?? false,
        scope: (input.scope ?? 'DISCIPLINE') as any,
        tier: input.tier ?? 3,
        capabilities: (input.capabilities ?? []) as Prisma.InputJsonValue,
        mcpTools: input.mcpTools ?? [],
        maxTokensPerTask: input.maxTokensPerTask ?? 50000,
        worktreeRequirement: input.worktreeRequirement ?? 'none',
        status: 'INACTIVE',
      },
      include: {
        sessionManager: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: subagent, message: 'Subagent created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/session-managers/:id/subagents] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SUBAGENT_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
