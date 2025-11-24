/**
 * Role Detail API Routes
 *
 * Handles individual role management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/roles/:roleId - Get role
 * - PATCH /api/workspaces/:workspaceId/admin/roles/:roleId - Update role
 * - DELETE /api/workspaces/:workspaceId/admin/roles/:roleId - Delete role
 *
 * @module app/api/workspaces/[workspaceId]/admin/roles/[roleId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateRoleSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Role,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID and role ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; roleId: string }>;
}

/**
 * System role IDs
 */
const SYSTEM_ROLE_IDS = [
  'system-role-0', // Owner
  'system-role-1', // Admin
  'system-role-2', // Member
  'system-role-3', // Guest
];

/**
 * Find role by ID
 */
type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

async function findRole(workspaceId: string, roleId: string): Promise<Role | null> {
  // Check if it's a system role
  if (roleId.startsWith('system-role-')) {
    const index = parseInt(roleId.split('-')[2], 10);
    const systemRoles: Array<{
      name: string;
      description: string;
      permissions: Array<{ resource: string; actions: PermissionAction[] }>;
      isSystem: boolean;
      color: string;
    }> = [
      { name: 'Owner', description: 'Full access', permissions: [{ resource: '*', actions: ['create', 'read', 'update', 'delete', 'manage'] }], isSystem: true, color: '#DC2626' },
      { name: 'Admin', description: 'Admin access', permissions: [{ resource: 'settings', actions: ['read', 'update'] }], isSystem: true, color: '#7C3AED' },
      { name: 'Member', description: 'Standard access', permissions: [{ resource: 'messages', actions: ['create', 'read'] }], isSystem: true, color: '#2563EB' },
      { name: 'Guest', description: 'Limited access', permissions: [{ resource: 'messages', actions: ['read'] }], isSystem: true, color: '#6B7280' },
    ];

    if (index >= 0 && index < systemRoles.length) {
      return {
        id: roleId,
        ...systemRoles[index],
        memberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }

  // Check custom roles in workspace settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });

  const settings = (workspace?.settings as Record<string, unknown>) || {};
  const customRoles = (settings.customRoles as Role[]) || [];

  return customRoles.find(r => r.id === roleId) || null;
}

/**
 * GET /api/workspaces/:workspaceId/admin/roles/:roleId
 *
 * Get a specific role. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and role ID
 * @returns Role details
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

    const { workspaceId, roleId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    const role = await findRole(workspaceId, roleId);
    if (!role) {
      return NextResponse.json(
        createAdminErrorResponse('Role not found', ADMIN_ERROR_CODES.ROLE_NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/admin/roles/:roleId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch role', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/admin/roles/:roleId
 *
 * Update a role. System roles cannot be modified.
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing workspace ID and role ID
 * @returns Updated role
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

    const { workspaceId, roleId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Check if system role
    if (SYSTEM_ROLE_IDS.includes(roleId)) {
      return NextResponse.json(
        createAdminErrorResponse('Cannot modify system roles', ADMIN_ERROR_CODES.CANNOT_MODIFY_SYSTEM_ROLE),
        { status: 403 },
      );
    }

    const role = await findRole(workspaceId, roleId);
    if (!role) {
      return NextResponse.json(
        createAdminErrorResponse('Role not found', ADMIN_ERROR_CODES.ROLE_NOT_FOUND),
        { status: 404 },
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
    const parseResult = updateRoleSchema.safeParse(body);
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

    // Update custom role in workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const customRoles = (settings.customRoles as Role[]) || [];

    const updatedRoles = customRoles.map(r => {
      if (r.id === roleId) {
        return {
          ...r,
          ...parseResult.data,
          updatedAt: new Date(),
        };
      }
      return r;
    });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          customRoles: updatedRoles,
        },
      },
    });

    const updatedRole = updatedRoles.find(r => r.id === roleId);

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'role.updated', ${session.user.id}, 'role', ${roleId}, ${updatedRole?.name || ''}, ${JSON.stringify({ changes: Object.keys(parseResult.data) })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ role: updatedRole });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/admin/roles/:roleId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to update role', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/admin/roles/:roleId
 *
 * Delete a role. System roles cannot be deleted.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and role ID
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

    const { workspaceId, roleId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Check if system role
    if (SYSTEM_ROLE_IDS.includes(roleId)) {
      return NextResponse.json(
        createAdminErrorResponse('Cannot delete system roles', ADMIN_ERROR_CODES.CANNOT_DELETE_SYSTEM_ROLE),
        { status: 403 },
      );
    }

    const role = await findRole(workspaceId, roleId);
    if (!role) {
      return NextResponse.json(
        createAdminErrorResponse('Role not found', ADMIN_ERROR_CODES.ROLE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Remove custom role from workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const customRoles = (settings.customRoles as Role[]) || [];

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          customRoles: customRoles.filter(r => r.id !== roleId),
        },
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'role.deleted', ${session.user.id}, 'role', ${roleId}, ${role.name}, ${JSON.stringify({})}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/admin/roles/:roleId] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to delete role', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
