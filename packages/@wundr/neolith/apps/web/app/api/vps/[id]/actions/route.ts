/**
 * VP Actions API Route
 *
 * Handles status change actions for Virtual Person (VP) entities.
 *
 * Routes:
 * - POST /api/vps/:id/actions - Execute action (activate/deactivate)
 *
 * @module app/api/vps/[id]/actions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpActionSchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { VPActionInput, VPStatusType } from '@/lib/validations/vp';
import type { NextRequest} from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Maps action to VP status
 */
const ACTION_TO_STATUS: Record<VPActionInput['action'], VPStatusType> = {
  activate: 'ONLINE',
  deactivate: 'OFFLINE',
};

/**
 * POST /api/vps/:id/actions
 *
 * Execute an action on a VP (activate or deactivate).
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with action data
 * @param context - Route context containing VP ID
 * @returns Updated VP status
 *
 * @example
 * ```
 * POST /api/vps/vp_123/actions
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

    // Validate action input
    const parseResult = vpActionSchema.safeParse(body);
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

    const input: VPActionInput = parseResult.data;

    // Get user's organization memberships
    const userOrganizations = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    // Fetch VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
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

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check organization membership and role
    const membership = userOrganizations.find(
      (m) => m.organizationId === vp.organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied to this VP', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to perform this action',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Determine new status based on action
    const newStatus = ACTION_TO_STATUS[input.action];
    const previousStatus = vp.status;

    // Skip update if already in target status
    if (vp.status === newStatus) {
      return NextResponse.json({
        data: vp,
        message: `VP is already ${newStatus.toLowerCase()}`,
        statusChanged: false,
        previousStatus,
        newStatus,
      });
    }

    // Update VP status and user status in a transaction
    const updatedVP = await prisma.$transaction(async (tx) => {
      // Update user status for activate/deactivate
      const userStatus = input.action === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await tx.user.update({
        where: { id: vp.user.id },
        data: { status: userStatus },
      });

      // Update VP status
      return tx.vP.update({
        where: { id: params.id },
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

    // TODO: Log the action to audit log service in production

    return NextResponse.json({
      data: updatedVP,
      message: `VP ${input.action}d successfully`,
      statusChanged: true,
      previousStatus,
      newStatus,
      ...(input.reason && { reason: input.reason }),
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/actions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
