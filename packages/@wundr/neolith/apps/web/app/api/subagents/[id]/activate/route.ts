/**
 * Subagent Activate API Route
 *
 * Handles activation of individual subagents.
 *
 * Routes:
 * - POST /api/subagents/:id/activate - Activate a subagent
 *
 * @module app/api/subagents/[id]/activate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with subagent ID parameter
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
  SUBAGENT_NOT_FOUND: 'SUBAGENT_NOT_FOUND',
  FORBIDDEN: 'SUBAGENT_FORBIDDEN',
  INTERNAL_ERROR: 'SUBAGENT_INTERNAL_ERROR',
  ALREADY_ACTIVE: 'SUBAGENT_ALREADY_ACTIVE',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof SUBAGENT_ERROR_CODES)[keyof typeof SUBAGENT_ERROR_CODES],
  details?: Record<string, unknown>,
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
 * Helper to check subagent access
 */
async function checkSubagentAccess(subagentId: string, userId: string) {
  const subagent = await prisma.subagent.findUnique({
    where: { id: subagentId },
    include: {
      sessionManager: {
        include: {
          orchestrator: {
            include: {
              organization: true,
            },
          },
        },
      },
    },
  });

  if (!subagent || !subagent.sessionManager) {
    return null;
  }

  // Check if user has access (via organization membership)
  const orgMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: subagent.sessionManager.orchestrator.organizationId,
      userId,
    },
  });

  if (!orgMember) {
    return null;
  }

  return {
    subagent,
    orgMembership: orgMember,
  };
}

/**
 * POST /api/subagents/:id/activate
 *
 * Activate a subagent by changing its status to ACTIVE.
 * Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing subagent ID
 * @returns Updated subagent with ACTIVE status
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
        createErrorResponse(
          'Authentication required',
          SUBAGENT_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;

    // Check access and permission
    const access = await checkSubagentAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Subagent not found or access denied',
          SUBAGENT_ERROR_CODES.SUBAGENT_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          SUBAGENT_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if already active
    if (access.subagent.status === 'ACTIVE') {
      return NextResponse.json(
        createErrorResponse(
          'Subagent is already active',
          SUBAGENT_ERROR_CODES.ALREADY_ACTIVE,
        ),
        { status: 400 },
      );
    }

    // Update subagent status to ACTIVE
    const subagent = await prisma.subagent.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
      },
      include: {
        sessionManager: {
          select: {
            id: true,
            name: true,
            orchestratorId: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: subagent,
      message: 'Subagent activated successfully',
    });
  } catch (error) {
    console.error('[POST /api/subagents/:id/activate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SUBAGENT_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
