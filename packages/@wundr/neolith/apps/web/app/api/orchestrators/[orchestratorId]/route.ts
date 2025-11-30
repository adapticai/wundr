/**
 * Single OrchestratorAPI Routes
 *
 * Handles operations on individual Orchestrator entities.
 *
 * Routes:
 * - GET /api/orchestrators/:id - Get Orchestrator details
 * - PATCH /api/orchestrators/:id - Update Orchestrator
 * - DELETE /api/orchestrators/:id - Delete Orchestrator
 *
 * @module app/api/orchestrators/[id]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateOrchestratorSchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { UpdateOrchestratorInput } from '@/lib/validations/orchestrator';
import type { NextRequest} from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an Orchestrator
 * Returns the Orchestrator with related data if accessible, null otherwise
 */
async function getVPWithAccessCheck(orchestratorId: string, userId: string) {
  // Get user's organization memberships
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map((m) => m.organizationId);

  // Fetch Orchestrator and verify organization access
  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
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

  if (!orchestrator || !accessibleOrgIds.includes(orchestrator.organizationId)) {
    return null;
  }

  // Find user's role in the Orchestrator's organization
  const membership = userOrganizations.find(
    (m) => m.organizationId === orchestrator.organizationId,
  );

  return { orchestrator, role: membership?.role ?? null };
}

/**
 * GET /api/orchestrators/:id
 *
 * Get details for a specific Orchestrator.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing OrchestratorID
 * @returns Orchestrator details
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with access check
    const result = await getVPWithAccessCheck(params.orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result.orchestrator });
  } catch (error) {
    console.error('[GET /api/orchestrators/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/orchestrators/:id
 *
 * Update an existing Orchestrator.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing OrchestratorID
 * @returns Updated Orchestrator object
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateOrchestratorSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateOrchestratorInput = parseResult.data;

    // Get Orchestrator with access check
    const result = await getVPWithAccessCheck(params.orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update Orchestrator and user in a transaction
    const updatedOrchestrator = await prisma.$transaction(async (tx) => {
      // Update user profile if provided
      if (input.user) {
        await tx.user.update({
          where: { id: result.orchestrator.user.id },
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

      // Update Orchestrator
      return tx.orchestrator.update({
        where: { id: params.orchestratorId },
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
      data: updatedOrchestrator,
      message: 'Orchestrator updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/orchestrators/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/orchestrators/:id
 *
 * Delete a Orchestrator and its associated user.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request object
 * @param context - Route context containing OrchestratorID
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID format', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get Orchestrator with access check
    const result = await getVPWithAccessCheck(params.orchestratorId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to delete this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete Orchestrator and associated user in a transaction
    // The cascade delete on Orchestrator->User relation will handle cleanup
    await prisma.$transaction(async (tx) => {
      // Delete the Orchestrator first
      await tx.orchestrator.delete({
        where: { id: params.orchestratorId },
      });

      // Delete the associated user
      await tx.user.delete({
        where: { id: result.orchestrator.user.id },
      });
    });

    return NextResponse.json({
      message: 'Orchestrator deleted successfully',
      deletedId: params.orchestratorId,
    });
  } catch (error) {
    console.error('[DELETE /api/orchestrators/:id] Error:', error);

    // Handle foreign key constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot delete Orchestrator: it has dependent records',
          ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
