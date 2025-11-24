/**
 * Admin Member Detail API Routes
 *
 * Handles individual member management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/members/:userId - Get member details
 * - PATCH /api/workspaces/:workspaceId/admin/members/:userId - Update member
 * - DELETE /api/workspaces/:workspaceId/admin/members/:userId - Remove member
 *
 * @module app/api/workspaces/[workspaceId]/admin/members/[userId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateMemberSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type MemberStatus,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; userId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/admin/members/:userId
 *
 * Get member details. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and user ID
 * @returns Member details
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceId, userId } = await context.params;

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!adminMembership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch member
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
            status: true,
            createdAt: true,
            lastActiveAt: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        createAdminErrorResponse('Member not found', ADMIN_ERROR_CODES.MEMBER_NOT_FOUND),
        { status: 404 },
      );
    }

    // Determine member status
    let memberStatus: MemberStatus = 'ACTIVE';
    if (member.user.status === 'SUSPENDED') {
      memberStatus = 'SUSPENDED';
    } else if (member.user.status === 'PENDING') {
      memberStatus = 'PENDING';
    }

    const memberInfo = {
      id: member.id,
      userId: member.userId,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
        isVP: member.user.isVP,
        createdAt: member.user.createdAt,
        lastActiveAt: member.user.lastActiveAt,
      },
      role: member.role,
      roleId: null,
      status: memberStatus,
      customFields: {},
      joinedAt: member.joinedAt,
      suspendedAt: null,
      suspendReason: null,
    };

    return NextResponse.json({ member: memberInfo });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/members/:userId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch member', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/admin/members/:userId
 *
 * Update member role or custom fields. Requires admin role.
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing workspace ID and user ID
 * @returns Updated member
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceId, userId } = await context.params;

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!adminMembership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch target member
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) {
      return NextResponse.json(
        createAdminErrorResponse('Member not found', ADMIN_ERROR_CODES.MEMBER_NOT_FOUND),
        { status: 404 },
      );
    }

    // Cannot modify owner unless you're the owner
    if (member.role === 'OWNER' && adminMembership.role !== 'OWNER') {
      return NextResponse.json(
        createAdminErrorResponse('Cannot modify workspace owner', ADMIN_ERROR_CODES.CANNOT_MODIFY_OWNER),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse('Invalid JSON body', ADMIN_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateMemberSchema.safeParse(body);
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

    const { roleId } = parseResult.data;

    // Map role ID to role name
    type WorkspaceRoleType = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
    let newRole: WorkspaceRoleType = member.role as WorkspaceRoleType;
    if (roleId) {
      const roleMap: Record<string, WorkspaceRoleType> = {
        'system-role-0': 'OWNER',
        'system-role-1': 'ADMIN',
        'system-role-2': 'MEMBER',
        'system-role-3': 'GUEST',
      };
      newRole = roleMap[roleId] || (member.role as WorkspaceRoleType);
    }

    // Update member
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: newRole as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
            status: true,
          },
        },
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'member.role_changed', ${session.user.id}, 'user', ${userId}, ${updatedMember.user.name || updatedMember.user.email || ''}, ${JSON.stringify({ oldRole: member.role, newRole })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    // Determine member status
    let memberStatus: MemberStatus = 'ACTIVE';
    if (updatedMember.user.status === 'SUSPENDED') {
      memberStatus = 'SUSPENDED';
    } else if (updatedMember.user.status === 'PENDING') {
      memberStatus = 'PENDING';
    }

    const memberInfo = {
      id: updatedMember.id,
      userId: updatedMember.userId,
      user: updatedMember.user,
      role: updatedMember.role,
      roleId: null,
      status: memberStatus,
      customFields: {},
      joinedAt: updatedMember.joinedAt,
      suspendedAt: null,
      suspendReason: null,
    };

    return NextResponse.json({ member: memberInfo });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/admin/members/:userId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to update member', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/admin/members/:userId
 *
 * Remove a member from the workspace. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and user ID
 * @returns Success message
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceId, userId } = await context.params;

    // Cannot remove self
    if (session.user.id === userId) {
      return NextResponse.json(
        createAdminErrorResponse('Cannot remove yourself', ADMIN_ERROR_CODES.CANNOT_REMOVE_SELF),
        { status: 400 },
      );
    }

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!adminMembership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(adminMembership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch target member
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!member) {
      return NextResponse.json(
        createAdminErrorResponse('Member not found', ADMIN_ERROR_CODES.MEMBER_NOT_FOUND),
        { status: 404 },
      );
    }

    // Cannot remove owner unless you're the owner
    if (member.role === 'OWNER' && adminMembership.role !== 'OWNER') {
      return NextResponse.json(
        createAdminErrorResponse('Cannot remove workspace owner', ADMIN_ERROR_CODES.CANNOT_MODIFY_OWNER),
        { status: 403 },
      );
    }

    // Remove member
    await prisma.workspaceMember.delete({
      where: { id: member.id },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'member.removed', ${session.user.id}, 'user', ${userId}, ${member.user.name || member.user.email || ''}, ${JSON.stringify({})}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/admin/members/:userId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to remove member', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
