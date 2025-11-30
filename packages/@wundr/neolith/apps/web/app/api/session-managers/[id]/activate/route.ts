/**
 * Session Manager Activate API Route
 *
 * Handles activating a session manager.
 *
 * Routes:
 * - POST /api/session-managers/:id/activate - Activate session manager
 *
 * @module app/api/session-managers/[id]/activate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  sessionManagerIdParamSchema,
  createErrorResponse,
  SESSION_MANAGER_ERROR_CODES,
} from '@/lib/validations/session-manager';

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
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
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
 * POST /api/session-managers/:id/activate
 *
 * Activate a session manager.
 * Requires authentication and admin/owner role in the orchestrator's organization.
 *
 * @param _request - Next.js request object
 * @param context - Route context with session manager ID
 * @returns Activated session manager
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
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
          'Insufficient permissions to activate this session manager',
          SESSION_MANAGER_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if session manager is already active
    if (result.sessionManager.status === 'ACTIVE') {
      return NextResponse.json({
        data: result.sessionManager,
        message: 'Session manager is already active',
      });
    }

    // Activate session manager
    const updatedSessionManager = await prisma.sessionManager.update({
      where: { id: params.id },
      data: { status: 'ACTIVE' },
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
      message: 'Session manager activated successfully',
    });
  } catch (error) {
    console.error('[POST /api/session-managers/:id/activate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SESSION_MANAGER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
