/**
 * OrchestratorActions API Route
 *
 * Handles status change actions for Orchestrator entities.
 *
 * Routes:
 * - POST /api/orchestrators/:id/actions - Execute action (activate/deactivate)
 *
 * @module app/api/orchestrators/[id]/actions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorActionSchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type {
  OrchestratorActionInput,
  OrchestratorStatusType,
} from '@/lib/validations/orchestrator';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Maps action to Orchestrator status
 */
const ACTION_TO_STATUS: Record<
  OrchestratorActionInput['action'],
  OrchestratorStatusType
> = {
  activate: 'ONLINE',
  deactivate: 'OFFLINE',
  start: 'ONLINE',
  stop: 'OFFLINE',
  pause: 'AWAY',
  resume: 'ONLINE',
  restart: 'BUSY',
};

/**
 * POST /api/orchestrators/:id/actions
 *
 * Execute an action on a Orchestrator (activate or deactivate).
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request with action data
 * @param context - Route context containing OrchestratorID
 * @returns Updated Orchestrator status
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/actions
 * Content-Type: application/json
 *
 * {
 *   "action": "activate",
 *   "reason": "Enabling for production use"
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
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
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
          'Invalid JSON body',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate action input
    const parseResult = orchestratorActionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: OrchestratorActionInput = parseResult.data;

    // Get user's organization memberships
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    // Fetch Orchestrator and verify access
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: params.orchestratorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      m => m.organizationId === orchestrator.organizationId
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to perform this action',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Determine new status based on action
    const newStatus = ACTION_TO_STATUS[input.action];
    const previousStatus = orchestrator.status;

    // Skip update if already in target status
    if (orchestrator.status === newStatus) {
      return NextResponse.json({
        data: orchestrator,
        message: `Orchestrator is already ${newStatus.toLowerCase()}`,
        statusChanged: false,
        previousStatus,
        newStatus,
      });
    }

    // Update Orchestrator status and user status in a transaction
    const updatedOrchestrator = await prisma.$transaction(async tx => {
      // Update user status for activate/deactivate
      const userStatus = input.action === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await tx.user.update({
        where: { id: orchestrator.user.id },
        data: { status: userStatus },
      });

      // Update Orchestrator status
      return tx.orchestrator.update({
        where: { id: params.orchestratorId },
        data: { status: newStatus },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
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

    // Log orchestrator action to audit log
    await (prisma as any).auditLog.create({
      data: {
        actorType: 'user',
        actorId: session.user.id,
        action: `orchestrator.${input.action}`,
        resourceType: 'orchestrator',
        resourceId: params.orchestratorId,
        metadata: {
          previousStatus,
          newStatus,
          ...(input.reason && { reason: input.reason }),
        },
      },
    });

    return NextResponse.json({
      data: updatedOrchestrator,
      message: `Orchestrator ${input.action}d successfully`,
      statusChanged: true,
      previousStatus,
      newStatus,
      ...(input.reason && { reason: input.reason }),
    });
  } catch (error) {
    console.error('[POST /api/orchestrators/:id/actions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
