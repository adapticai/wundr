/**
 * Unsuspend Member API Route
 *
 * Handles unsuspending a workspace member.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/members/:userId/unsuspend - Unsuspend member
 *
 * @module app/api/workspaces/[workspaceId]/admin/members/[userId]/unsuspend/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/admin/members/:userId/unsuspend
 *
 * Unsuspend a member. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and user ID
 * @returns Success message
 */
export async function POST(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug: workspaceId, userId } = await context.params;

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !adminMembership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(adminMembership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Fetch target member
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    if (!member) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Member not found',
          ADMIN_ERROR_CODES.MEMBER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if actually suspended
    if (member.user.status !== 'SUSPENDED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'Member is not suspended',
          ADMIN_ERROR_CODES.MEMBER_NOT_SUSPENDED
        ),
        { status: 400 }
      );
    }

    // Update user status to ACTIVE
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'member.unsuspended', ${session.user.id}, 'user', ${userId}, ${member.user.name || member.user.email || ''}, ${JSON.stringify({})}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({
      message: 'Member unsuspended successfully',
      unsuspendedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/admin/members/:userId/unsuspend] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to unsuspend member',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
