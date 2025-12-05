/**
 * Suspend Member API Route
 *
 * Handles suspending a workspace member.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/members/:userId/suspend - Suspend member
 *
 * @module app/api/workspaces/[workspaceId]/admin/members/[userId]/suspend/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  suspendMemberSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/admin/members/:userId/suspend
 *
 * Suspend a member. Requires admin role.
 *
 * @param request - Next.js request with optional suspension reason
 * @param context - Route context containing workspace ID and user ID
 * @returns Success message
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId, userId } = await context.params;

    // Cannot suspend self
    if (session.user.id === userId) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Cannot suspend yourself',
          ADMIN_ERROR_CODES.CANNOT_SUSPEND_SELF,
        ),
        { status: 400 },
      );
    }

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
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
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
          ADMIN_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Cannot suspend owner
    if (member.role === 'OWNER') {
      return NextResponse.json(
        createAdminErrorResponse(
          'Cannot suspend workspace owner',
          ADMIN_ERROR_CODES.CANNOT_MODIFY_OWNER,
        ),
        { status: 403 },
      );
    }

    // Check if already suspended
    if (member.user.status === 'SUSPENDED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'Member is already suspended',
          ADMIN_ERROR_CODES.MEMBER_ALREADY_SUSPENDED,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is valid
    }

    // Validate input
    const parseResult = suspendMemberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { reason } = parseResult.data;

    // Update user status to SUSPENDED
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'member.suspended', ${session.user.id}, 'user', ${userId}, ${member.user.name || member.user.email || ''}, ${JSON.stringify({ reason: reason || null })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({
      message: 'Member suspended successfully',
      suspendedAt: new Date().toISOString(),
      reason: reason || null,
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/admin/members/:userId/suspend] Error:',
      error,
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to suspend member',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
