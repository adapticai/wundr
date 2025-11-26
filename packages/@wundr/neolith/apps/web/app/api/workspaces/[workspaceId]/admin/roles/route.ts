/**
 * Roles API Routes
 *
 * Handles workspace role management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/roles - List roles
 * - POST /api/workspaces/:workspaceId/admin/roles - Create role
 *
 * @module app/api/workspaces/[workspaceId]/admin/roles/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createRoleSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Role,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * System roles that are created by default
 */
const SYSTEM_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Owner',
    description: 'Full access to all workspace features and settings',
    permissions: [{ resource: '*', actions: ['create', 'read', 'update', 'delete', 'manage'] }],
    isSystem: true,
    color: '#DC2626',
    memberCount: 0,
  },
  {
    name: 'Admin',
    description: 'Can manage workspace settings and members',
    permissions: [
      { resource: 'settings', actions: ['read', 'update'] },
      { resource: 'members', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'channels', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'roles', actions: ['read'] },
    ],
    isSystem: true,
    color: '#7C3AED',
    memberCount: 0,
  },
  {
    name: 'Member',
    description: 'Standard workspace member',
    permissions: [
      { resource: 'channels', actions: ['read'] },
      { resource: 'messages', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'files', actions: ['create', 'read'] },
    ],
    isSystem: true,
    color: '#2563EB',
    memberCount: 0,
  },
  {
    name: 'Guest',
    description: 'Limited access guest user',
    permissions: [
      { resource: 'channels', actions: ['read'] },
      { resource: 'messages', actions: ['read'] },
    ],
    isSystem: true,
    color: '#6B7280',
    memberCount: 0,
  },
];

/**
 * GET /api/workspaces/:workspaceId/admin/roles
 *
 * List all roles for the workspace. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID
 * @returns List of roles
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

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspace_members.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get member counts per role
    const memberCounts = await prisma.workspace_members.groupBy({
      by: ['role'],
      where: { workspaceId },
      _count: { role: true },
    });

    const countMap = new Map(memberCounts.map(m => [m.role.toUpperCase(), m._count.role]));

    // For now, return system roles with member counts
    // In production, these would be stored in the database
    const roles: Role[] = SYSTEM_ROLES.map((role, index) => ({
      ...role,
      id: `system-role-${index}`,
      memberCount: countMap.get(role.name.toUpperCase()) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return NextResponse.json({ roles });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse('Failed to fetch roles', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/admin/roles
 *
 * Create a new custom role. Requires admin role.
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing workspace ID
 * @returns Created role
 */
export async function POST(
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

    const { workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspace_members.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
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
    const parseResult = createRoleSchema.safeParse(body);
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

    // Check if role name already exists (including system roles)
    const existingSystemRole = SYSTEM_ROLES.find(
      r => r.name.toLowerCase() === parseResult.data.name.toLowerCase(),
    );
    if (existingSystemRole) {
      return NextResponse.json(
        createAdminErrorResponse('Role name already exists', ADMIN_ERROR_CODES.ROLE_NAME_EXISTS),
        { status: 409 },
      );
    }

    // Create custom role (stored in workspace settings for now)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const customRoles = (settings.customRoles as Role[]) || [];

    const newRole: Role = {
      id: `custom-role-${Date.now()}`,
      name: parseResult.data.name,
      description: parseResult.data.description || null,
      permissions: parseResult.data.permissions,
      isSystem: false,
      color: parseResult.data.color || null,
      memberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          customRoles: [...customRoles, newRole],
        },
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'role.created', ${session.user.id}, 'role', ${newRole.id}, ${newRole.name}, ${JSON.stringify({})}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ role: newRole }, { status: 201 });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse('Failed to create role', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
