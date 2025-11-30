/**
 * Single Session Manager API Routes
 *
 * Handles operations on individual session manager entities.
 *
 * Routes:
 * - GET /api/session-managers/:id - Get session manager details
 * - PATCH /api/session-managers/:id - Update session manager
 * - DELETE /api/session-managers/:id - Delete session manager
 *
 * @module app/api/session-managers/[id]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateSessionManagerSchema,
  sessionManagerIdParamSchema,
  createErrorResponse,
  SESSION_MANAGER_ERROR_CODES,
} from '@/lib/validations/session-manager';

import type { UpdateSessionManagerInput } from '@/lib/validations/session-manager';
import type { NextRequest } from 'next/server';

/**
 * Route context with session manager ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to check if user has access to a session manager
 * Returns the session manager with related data if accessible, null otherwise
 */
async function getSessionManagerWithAccessCheck(sessionManagerId: string, userId: string) {
  // Get user's organization memberships
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

  // Fetch session manager with orchestrator and verify organization access
  const sessionManager = await prisma.sessionManager.findUnique({
    where: { id: sessionManagerId },
    include: {
      orchestrator: {
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
      },
      subagents: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          capabilities: true,
          mcpTools: true,
          scope: true,
          tier: true,
        },
      },
    },
  });

  if (!sessionManager || !accessibleOrgIds.includes(sessionManager.orchestrator.organizationId)) {
    return null;
  }

  // Find user's role in the orchestrator's organization
  const membership = userOrganizations.find(
    (m) => m.organizationId === sessionManager.orchestrator.organizationId,
  );

  return { sessionManager, role: membership?.role ?? null };
}

/**
 * GET /api/session-managers/:id
 *
 * Get details for a specific session manager.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing session manager ID
 * @returns Session manager details with orchestrator and subagents
 */
export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate session manager ID parameter
    const params = await context.params;
    const paramResult = sessionManagerIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid session manager ID format',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get session manager with access check
    const result = await getSessionManagerWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Session manager not found or access denied',
          SESSION_MANAGER_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.sessionManager });
  } catch (error) {
    console.error('[GET /api/session-managers/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/session-managers/:id
 *
 * Update an existing session manager.
 * Requires authentication and admin/owner role in the orchestrator's organization.
 *
 * Request body (all fields optional):
 * {
 *   "name": "Updated name",
 *   "description": "Updated description",
 *   "charterId": "new_charter_id",
 *   "charterData": { ... },
 *   "disciplineId": "new_discipline_id",
 *   "isGlobal": true,
 *   "globalConfig": { "invokeableBy": ["orch_id"] },
 *   "status": "ACTIVE",
 *   "maxConcurrentSubagents": 30,
 *   "tokenBudgetPerHour": 150000,
 *   "worktreeConfig": { ... }
 * }
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing session manager ID
 * @returns Updated session manager object
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate session manager ID parameter
    const params = await context.params;
    const paramResult = sessionManagerIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid session manager ID format',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateSessionManagerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateSessionManagerInput = parseResult.data;

    // Get session manager with access check
    const result = await getSessionManagerWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Session manager not found or access denied',
          SESSION_MANAGER_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update this session manager',
          SESSION_MANAGER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for name conflicts if name is being changed
    if (input.name && input.name !== result.sessionManager.name) {
      const existingSessionManager = await prisma.sessionManager.findFirst({
        where: {
          orchestratorId: result.sessionManager.orchestratorId,
          name: input.name,
          id: { not: params.id },
        },
      });

      if (existingSessionManager) {
        return NextResponse.json(
          createErrorResponse(
            'A session manager with this name already exists for this orchestrator',
            SESSION_MANAGER_ERROR_CODES.ALREADY_EXISTS,
          ),
          { status: 409 },
        );
      }
    }

    // Update session manager
    const updatedSessionManager = await prisma.sessionManager.update({
      where: { id: params.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.charterId !== undefined && { charterId: input.charterId }),
        ...(input.charterData !== undefined && {
          charterData: input.charterData as Prisma.InputJsonValue,
        }),
        ...(input.disciplineId !== undefined && { disciplineId: input.disciplineId }),
        ...(input.isGlobal !== undefined && { isGlobal: input.isGlobal }),
        ...(input.globalConfig !== undefined && {
          globalConfig: input.globalConfig as Prisma.InputJsonValue,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.maxConcurrentSubagents !== undefined && {
          maxConcurrentSubagents: input.maxConcurrentSubagents,
        }),
        ...(input.tokenBudgetPerHour !== undefined && {
          tokenBudgetPerHour: input.tokenBudgetPerHour,
        }),
        ...(input.worktreeConfig !== undefined && {
          worktreeConfig: input.worktreeConfig as Prisma.InputJsonValue,
        }),
      },
      include: {
        orchestrator: {
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
        },
        subagents: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            capabilities: true,
            mcpTools: true,
            scope: true,
            tier: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedSessionManager,
      message: 'Session manager updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/session-managers/:id] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Session manager not found',
            SESSION_MANAGER_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/session-managers/:id
 *
 * Delete a session manager.
 * Requires authentication and admin/owner role in the orchestrator's organization.
 *
 * Note: This will cascade delete or set to null associated subagents depending on
 * the Prisma schema configuration (currently SET NULL).
 *
 * @param request - Next.js request object
 * @param context - Route context containing session manager ID
 * @returns Success message
 */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', SESSION_MANAGER_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate session manager ID parameter
    const params = await context.params;
    const paramResult = sessionManagerIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid session manager ID format',
          SESSION_MANAGER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get session manager with access check
    const result = await getSessionManagerWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Session manager not found or access denied',
          SESSION_MANAGER_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to delete this session manager',
          SESSION_MANAGER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check for active subagents
    const activeSubagentCount = await prisma.subagent.count({
      where: {
        sessionManagerId: params.id,
        status: 'ACTIVE',
      },
    });

    if (activeSubagentCount > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Cannot delete session manager: it has ${activeSubagentCount} active subagent(s). Please deactivate or reassign them first.`,
          SESSION_MANAGER_ERROR_CODES.HAS_DEPENDENCIES,
        ),
        { status: 409 },
      );
    }

    // Delete the session manager
    await prisma.sessionManager.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Session manager deleted successfully',
      deletedId: params.id,
    });
  } catch (error) {
    console.error('[DELETE /api/session-managers/:id] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Session manager not found',
            SESSION_MANAGER_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      // Handle foreign key constraint errors
      if (error.code === 'P2003') {
        return NextResponse.json(
          createErrorResponse(
            'Cannot delete session manager: it has dependent records',
            SESSION_MANAGER_ERROR_CODES.HAS_DEPENDENCIES,
          ),
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
