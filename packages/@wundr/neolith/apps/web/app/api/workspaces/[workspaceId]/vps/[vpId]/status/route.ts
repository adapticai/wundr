/**
 * VP Status API Routes
 *
 * Handles getting and updating VP operational status.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/status - Get current VP status
 * - POST /api/workspaces/:workspaceId/vps/:vpId/status - Update VP status
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, VP_ERROR_CODES, vpStatusEnum } from '@/lib/validations/vp';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Schema for updating VP status
 */
const updateStatusSchema = z.object({
  /** New VP status */
  status: vpStatusEnum,
  /** Optional reason or note for the status update */
  reason: z.string().max(500).optional(),
});

type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

/**
 * Helper function to check if user has access to a VP within a workspace
 */
async function checkVPAccess(workspaceId: string, vpId: string, userId: string) {
  // First, verify workspace exists and user has access
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  // Check user's organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  // Fetch VP and verify it belongs to the workspace
  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
      OR: [
        { workspaceId }, // VP is directly in this workspace
        { workspaceId: null }, // VP is org-wide (accessible to all workspaces)
      ],
    },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/status
 *
 * Get current VP status including:
 * - Status (ONLINE, OFFLINE, BUSY, AWAY)
 * - Current task (if any)
 * - Last activity timestamp
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
 * @returns VP status information
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/status
 *
 * Response:
 * {
 *   "data": {
 *     "status": "BUSY",
 *     "currentTask": {
 *       "id": "task_789",
 *       "title": "Implement authentication",
 *       "status": "IN_PROGRESS",
 *       "priority": "HIGH"
 *     },
 *     "lastActiveAt": "2024-11-26T12:30:00Z"
 *   }
 * }
 * ```
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

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const result = await checkVPAccess(workspaceId, vpId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Get VP with user's lastActiveAt
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            lastActiveAt: true,
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

    // Fetch current active task
    const currentTask = await prisma.task.findFirst({
      where: {
        vpId,
        status: 'IN_PROGRESS',
      },
      orderBy: [
        { priority: 'desc' }, // Highest priority first
        { createdAt: 'asc' }, // Then oldest first
      ],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: {
        status: vp.status,
        currentTask: currentTask || null,
        lastActiveAt: vp.user.lastActiveAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/vps/:vpId/status] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/status
 *
 * Update VP status.
 * Requires authentication and workspace access.
 * VPs can update their own status, or admins/owners can update any VP status.
 *
 * @param request - Next.js request with status update data
 * @param context - Route context containing workspace and VP IDs
 * @returns Updated VP status
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps/vp_456/status
 * Content-Type: application/json
 *
 * {
 *   "status": "BUSY",
 *   "reason": "Working on critical task"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "status": "BUSY",
 *     "lastActiveAt": "2024-11-26T12:35:00Z"
 *   },
 *   "message": "VP status updated successfully"
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

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
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
    const parseResult = updateStatusSchema.safeParse(body);
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

    const input: UpdateStatusInput = parseResult.data;

    // Check access
    const result = await checkVPAccess(workspaceId, vpId, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if user is the VP or has admin/owner access
    const isVPUser = session.user.id === result.vp.userId;
    const hasAdminAccess = result.role === 'OWNER' || result.role === 'ADMIN';

    if (!isVPUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update VP status',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update VP status and user's lastActiveAt in a transaction
    const now = new Date();
    const updatedVP = await prisma.$transaction(async (tx) => {
      // Update VP status
      const vp = await tx.vP.update({
        where: { id: vpId },
        data: { status: input.status },
        select: {
          id: true,
          status: true,
          userId: true,
        },
      });

      // Update user's lastActiveAt timestamp
      await tx.user.update({
        where: { id: vp.userId },
        data: { lastActiveAt: now },
      });

      return vp;
    });

    return NextResponse.json({
      data: {
        status: updatedVP.status,
        lastActiveAt: now,
      },
      message: 'VP status updated successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/status] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
