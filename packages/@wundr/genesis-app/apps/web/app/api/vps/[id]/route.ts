/**
 * Single VP API Routes
 *
 * Handles operations on individual Virtual Person (VP) entities.
 *
 * Routes:
 * - GET /api/vps/:id - Get VP details
 * - PATCH /api/vps/:id - Update VP
 * - DELETE /api/vps/:id - Delete VP
 *
 * @module app/api/vps/[id]/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateVPSchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { UpdateVPInput } from '@/lib/validations/vp';
import type { NextRequest} from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to check if user has access to a VP
 * Returns the VP with related data if accessible, null otherwise
 */
async function getVPWithAccessCheck(vpId: string, userId: string) {
  // Get user's organization memberships
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

  // Fetch VP and verify organization access
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          status: true,
          createdAt: true,
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

  if (!vp || !accessibleOrgIds.includes(vp.organizationId)) {
    return null;
  }

  // Find user's role in the VP's organization
  const membership = userOrganizations.find(
    (m) => m.organizationId === vp.organizationId,
  );

  return { vp, role: membership?.role ?? null };
}

/**
 * GET /api/vps/:id
 *
 * Get details for a specific VP.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing VP ID
 * @returns VP details
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get VP with access check
    const result = await getVPWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.vp });
  } catch (error) {
    console.error('[GET /api/vps/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/vps/:id
 *
 * Update an existing VP.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing VP ID
 * @returns Updated VP object
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateVPSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateVPInput = parseResult.data;

    // Get VP with access check
    const result = await getVPWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update VP and user in a transaction
    const updatedVP = await prisma.$transaction(async (tx) => {
      // Update user profile if provided
      if (input.user) {
        await tx.user.update({
          where: { id: result.vp.user.id },
          data: {
            ...(input.user.name !== undefined && { name: input.user.name }),
            ...(input.user.displayName !== undefined && {
              displayName: input.user.displayName,
            }),
            ...(input.user.avatarUrl !== undefined && {
              avatarUrl: input.user.avatarUrl,
            }),
            ...(input.user.bio !== undefined && { bio: input.user.bio }),
          },
        });
      }

      // Update VP
      return tx.vP.update({
        where: { id: params.id },
        data: {
          ...(input.discipline !== undefined && { discipline: input.discipline }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.capabilities !== undefined && {
            capabilities: input.capabilities as unknown as Prisma.InputJsonValue,
          }),
          ...(input.daemonEndpoint !== undefined && {
            daemonEndpoint: input.daemonEndpoint,
          }),
          ...(input.status !== undefined && { status: input.status }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              status: true,
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
    });

    return NextResponse.json({
      data: updatedVP,
      message: 'VP updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/vps/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/vps/:id
 *
 * Delete a VP and its associated user.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing VP ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get VP with access check
    const result = await getVPWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to delete this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete VP and associated user in a transaction
    // The cascade delete on VP->User relation will handle cleanup
    await prisma.$transaction(async (tx) => {
      // Delete the VP first
      await tx.vP.delete({
        where: { id: params.id },
      });

      // Delete the associated user
      await tx.user.delete({
        where: { id: result.vp.user.id },
      });
    });

    return NextResponse.json({
      message: 'VP deleted successfully',
      deletedId: params.id,
    });
  } catch (error) {
    console.error('[DELETE /api/vps/:id] Error:', error);

    // Handle foreign key constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot delete VP: it has dependent records',
          VP_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
