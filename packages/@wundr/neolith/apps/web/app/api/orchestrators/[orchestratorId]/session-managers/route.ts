/**
 * Session Manager Collection API Routes
 *
 * Handles operations on session manager collections for a specific orchestrator.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/session-managers - List session managers
 * - POST /api/orchestrators/:orchestratorId/session-managers - Create session manager
 *
 * @module app/api/orchestrators/[orchestratorId]/session-managers/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createSessionManagerSchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  SESSION_MANAGER_ERROR_CODES,
} from '@/lib/validations/session-manager';

import type { CreateSessionManagerInput } from '@/lib/validations/session-manager';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestratorId parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an orchestrator
 */
async function getOrchestratorWithAccessCheck(
  orchestratorId: string,
  userId: string
) {
  // Get user's organization memberships
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  // Fetch orchestrator and verify organization access
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  // Find user's role in the orchestrator's organization
  const membership = userOrganizations.find(
    m => m.organizationId === orchestrator.organizationId
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * GET /api/orchestrators/:orchestratorId/session-managers
 *
 * List session managers for a specific orchestrator.
 * Supports filtering by status and global flag, with pagination.
 *
 * Query parameters:
 * - status: Filter by status (ACTIVE, INACTIVE, PAUSED, ERROR)
 * - isGlobal: Filter by global flag (true/false)
 * - skip: Number of records to skip (default: 0)
 * - take: Number of records to return (default: 50, max: 100)
 *
 * @param request - Next.js request object
 * @param context - Route context containing orchestratorId
 * @returns List of session managers with pagination metadata
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
          SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get orchestrator with access check
    const result = await getOrchestratorWithAccessCheck(
      params.orchestratorId,
      session.user.id
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          SESSION_MANAGER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const isGlobalParam = searchParams.get('isGlobal');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 100);

    // Build where clause
    const where: Prisma.sessionManagerWhereInput = {
      orchestratorId: params.orchestratorId,
      ...(status && { status: status as Prisma.EnumAgentStatusFilter }),
      ...(isGlobalParam !== null && { isGlobal: isGlobalParam === 'true' }),
    };

    // Fetch session managers and total count in parallel
    const [data, total] = await Promise.all([
      prisma.sessionManager.findMany({
        where,
        include: {
          subagents: {
            select: {
              id: true,
              name: true,
              status: true,
              capabilities: true,
            },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sessionManager.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        total,
        skip,
        take,
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:id/session-managers] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrators/:orchestratorId/session-managers
 *
 * Create a new session manager for the specified orchestrator.
 * Requires authentication and admin/owner role in the orchestrator's organization.
 *
 * Request body:
 * {
 *   "name": "Session Manager Name",
 *   "description": "Description",
 *   "charterId": "charter_id",
 *   "charterData": { ... },
 *   "disciplineId": "discipline_id",
 *   "isGlobal": false,
 *   "globalConfig": { "invokeableBy": "all" | ["orch_id1", "orch_id2"] },
 *   "maxConcurrentSubagents": 20,
 *   "tokenBudgetPerHour": 100000,
 *   "worktreeConfig": { ... }
 * }
 *
 * @param request - Next.js request with session manager data
 * @param context - Route context containing orchestratorId
 * @returns Created session manager object
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
          SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate orchestratorId parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get orchestrator with access check
    const result = await getOrchestratorWithAccessCheck(
      params.orchestratorId,
      session.user.id
    );

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          SESSION_MANAGER_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to create session managers',
          SESSION_MANAGER_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
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
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = createSessionManagerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: CreateSessionManagerInput = parseResult.data;

    // Check for duplicate name within the same orchestrator
    const existingSessionManager = await prisma.sessionManager.findFirst({
      where: {
        orchestratorId: params.orchestratorId,
        name: input.name,
      },
    });

    if (existingSessionManager) {
      return NextResponse.json(
        createErrorResponse(
          'A session manager with this name already exists for this orchestrator',
          SESSION_MANAGER_ERROR_CODES.ALREADY_EXISTS
        ),
        { status: 409 }
      );
    }

    // Validate required fields
    if (!input.charterId) {
      return NextResponse.json(
        createErrorResponse(
          'charterId is required',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Create session manager
    const sessionManager = await prisma.sessionManager.create({
      data: {
        name: input.name,
        description: input.description,
        charterId: input.charterId,
        charterData: (input.charterData ?? {}) as never,
        disciplineId: input.disciplineId ?? null,
        orchestratorId: params.orchestratorId,
        isGlobal: input.isGlobal ?? false,
        globalConfig: (input.globalConfig ?? null) as never,
        maxConcurrentSubagents: input.maxConcurrentSubagents ?? 20,
        tokenBudgetPerHour: input.tokenBudgetPerHour ?? 100000,
        worktreeConfig: (input.worktreeConfig ?? null) as never,
        status: 'INACTIVE',
      },
      include: {
        subagents: {
          select: {
            id: true,
            name: true,
            status: true,
            capabilities: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: sessionManager,
        message: 'Session manager created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/orchestrators/:id/session-managers] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
