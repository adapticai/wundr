/**
 * Charter [charterId] API Routes
 *
 * Handles single charter retrieval, update, and deletion.
 *
 * Routes:
 * - GET /api/charters/:charterId - Get a single charter
 * - PATCH /api/charters/:charterId - Update charter (creates new version)
 * - DELETE /api/charters/:charterId - Delete charter
 *
 * @module app/api/charters/[charterId]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  charterIdParamSchema,
  updateCharterInputSchema,
  createErrorResponse,
  CHARTER_ERROR_CODES,
} from '@/lib/validations/charter';

import type { UpdateCharterInputFull } from '@/lib/validations/charter';
import type { NextRequest } from 'next/server';

/**
 * Route context with charterId parameter
 */
interface RouteContext {
  params: Promise<{ charterId: string }>;
}

/**
 * Helper to check org membership for a charter
 */
async function checkCharterAccess(charterId: string, userId: string) {
  const charter = await prisma.charter.findUnique({
    where: { id: charterId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      version: true,
    },
  });

  if (!charter) {
    return null;
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: charter.organizationId,
        userId,
      },
    },
  });

  if (!membership) {
    return null;
  }

  return { charter, role: membership.role };
}

/**
 * GET /api/charters/:charterId
 *
 * Get a single charter by ID. Requires authentication and org membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing charterId
 * @returns Charter object
 *
 * @example
 * ```
 * GET /api/charters/charter_123
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse({
      id: params.charterId,
    });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID format'
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkCharterAccess(params.charterId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found or access denied'
        ),
        { status: 404 }
      );
    }

    // Fetch full charter
    const charter = await prisma.charter.findUnique({
      where: { id: params.charterId },
    });

    return NextResponse.json({ data: charter });
  } catch (error) {
    console.error('[GET /api/charters/:charterId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/charters/:charterId
 *
 * Update a charter. Creates a new version. Requires admin or owner role.
 *
 * @param request - Next.js request with updated charter fields
 * @param context - Route context containing charterId
 * @returns Updated charter object
 *
 * @example
 * ```
 * PATCH /api/charters/charter_123
 * Content-Type: application/json
 *
 * {
 *   "mission": "Updated mission statement",
 *   "values": ["Excellence", "Integrity", "Innovation"]
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse({
      id: params.charterId,
    });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID format'
        ),
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON body'
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateCharterInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateCharterInputFull = parseResult.data;

    // Check access and permissions
    const access = await checkCharterAccess(params.charterId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found or access denied'
        ),
        { status: 404 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.role)) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Admin or Owner role required to update charters.'
        ),
        { status: 403 }
      );
    }

    // Update creates a new version: increment version number
    const nextVersion = access.charter.version + 1;

    const updatedCharter = await prisma.charter.update({
      where: { id: params.charterId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.mission !== undefined && { mission: input.mission }),
        ...(input.vision !== undefined && { vision: input.vision }),
        ...(input.values !== undefined && { values: input.values }),
        ...(input.principles !== undefined && { principles: input.principles }),
        ...(input.governance !== undefined && {
          governance: input.governance as Prisma.InputJsonValue,
        }),
        ...(input.security !== undefined && {
          security: input.security as Prisma.InputJsonValue,
        }),
        ...(input.communication !== undefined && {
          communication: input.communication as Prisma.InputJsonValue,
        }),
        version: nextVersion,
      },
    });

    return NextResponse.json({
      data: updatedCharter,
      message: 'Charter updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/charters/:charterId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/charters/:charterId
 *
 * Delete a charter. Requires owner role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing charterId
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/charters/charter_123
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        ),
        { status: 401 }
      );
    }

    // Validate charterId parameter
    const params = await context.params;
    const paramResult = charterIdParamSchema.safeParse({
      id: params.charterId,
    });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.VALIDATION_ERROR,
          'Invalid charter ID format'
        ),
        { status: 400 }
      );
    }

    // Check access and permissions
    const access = await checkCharterAccess(params.charterId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found or access denied'
        ),
        { status: 404 }
      );
    }

    // Only owners can delete charters
    if (access.role !== 'OWNER') {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.FORBIDDEN,
          'Insufficient permissions. Owner role required to delete charters.'
        ),
        { status: 403 }
      );
    }

    await prisma.charter.delete({
      where: { id: params.charterId },
    });

    return NextResponse.json({ message: 'Charter deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/charters/:charterId] Error:', error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        createErrorResponse(
          CHARTER_ERROR_CODES.CHARTER_NOT_FOUND,
          'Charter not found'
        ),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        CHARTER_ERROR_CODES.INTERNAL_ERROR,
        'An internal error occurred'
      ),
      { status: 500 }
    );
  }
}
