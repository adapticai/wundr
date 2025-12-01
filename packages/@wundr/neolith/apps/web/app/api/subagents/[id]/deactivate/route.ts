/**
 * Subagent Deactivate API Route
 *
 * Handles deactivation of individual subagents.
 *
 * Routes:
 * - POST /api/subagents/:id/deactivate - Deactivate a subagent
 *
 * @module app/api/subagents/[id]/deactivate/route
 */

import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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
  ALREADY_INACTIVE: 'SUBAGENT_ALREADY_INACTIVE',
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
              disciplineRef: {
                include: {
                  organization: {
                    include: {
                      members: {
                        where: { userId },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!subagent) {
    return null;
  }

  // Check if user has access (via organization membership)
  const orgMembers =
    subagent.sessionManager?.orchestrator.disciplineRef.organization.members ||
    [];
  if (orgMembers.length === 0) {
    return null;
  }

  return {
    subagent,
    orgMembership: orgMembers[0],
  };
}

/**
 * POST /api/subagents/:id/deactivate
 *
 * Deactivate a subagent by changing its status to INACTIVE.
 * Requires ADMIN or OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing subagent ID
 * @returns Updated subagent with INACTIVE status
 */
export async function POST(
  _request: NextRequest,
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

    // Check access and permission
    const access = await checkSubagentAccess(params.id, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Subagent not found or access denied',
          SUBAGENT_ERROR_CODES.SUBAGENT_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Admin or Owner role required.',
          SUBAGENT_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Check if already inactive
    if (access.subagent.status === 'INACTIVE') {
      return NextResponse.json(
        createErrorResponse(
          'Subagent is already inactive',
          SUBAGENT_ERROR_CODES.ALREADY_INACTIVE
        ),
        { status: 400 }
      );
    }

    // Update subagent status to INACTIVE
    const subagent = await prisma.subagent.update({
      where: { id: params.id },
      data: {
        status: 'INACTIVE',
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
      message: 'Subagent deactivated successfully',
    });
  } catch (error) {
    console.error('[POST /api/subagents/:id/deactivate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        SUBAGENT_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
