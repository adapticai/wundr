/**
 * Workspace Roles API Routes
 *
 * Handles workspace role management including listing and creating roles.
 * Roles define permissions for workspace members.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/roles - List all roles in the workspace
 * - POST /api/workspaces/:workspaceId/roles - Create a new custom role
 *
 * @module app/api/workspaces/[workspaceId]/roles/route
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
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * System roles that are created by default for every workspace
 * These roles cannot be modified or deleted
 */
const SYSTEM_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Owner',
    description: 'Full access to all workspace features and settings',
    permissions: [
      {
        resource: '*',
        actions: ['create', 'read', 'update', 'delete', 'manage'],
      },
    ],
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
 * Helper to check workspace membership and permissions
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true, settings: true },
  });

  if (!workspace) {
    return null;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return {
    workspace,
    membership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/roles
 *
 * List all roles for the workspace, including both system and custom roles.
 * Returns role details with member counts and permission mappings.
 *
 * Required permission: Workspace membership
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID
 * @returns List of roles with permissions and member counts
 *
 * @example
 * GET /api/workspaces/workspace123/roles
 * Response:
 * {
 *   "roles": [
 *     {
 *       "id": "system-role-0",
 *       "name": "Owner",
 *       "description": "Full access to all workspace features and settings",
 *       "permissions": [...],
 *       "isSystem": true,
 *       "color": "#DC2626",
 *       "memberCount": 1,
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "updatedAt": "2024-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "count": 4
 * }
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Authentication required',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access || !access.membership) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found or access denied',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get member counts per role
    const memberCounts = await prisma.workspaceMember.groupBy({
      by: ['role'],
      where: { workspaceId },
      _count: { role: true },
    });

    const countMap = new Map(
      memberCounts.map(m => [m.role.toUpperCase(), m._count.role]),
    );

    // Map system roles with member counts
    const systemRoles: Role[] = SYSTEM_ROLES.map((role, index) => ({
      ...role,
      id: `system-role-${index}`,
      memberCount: countMap.get(role.name.toUpperCase()) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Get custom roles from workspace settings
    const settings = access.workspace.settings as Record<
      string,
      unknown
    > | null;
    const customRoles: Role[] =
      settings &&
      typeof settings === 'object' &&
      'customRoles' in settings &&
      Array.isArray(settings.customRoles)
        ? (settings.customRoles as Role[])
        : [];

    // Combine system and custom roles
    const allRoles = [...systemRoles, ...customRoles];

    return NextResponse.json({
      roles: allRoles,
      count: allRoles.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/roles] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch roles',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/roles
 *
 * Create a new custom role for the workspace. Custom roles extend the system roles
 * and allow for fine-grained permission control.
 *
 * Required permission: Workspace ADMIN or OWNER
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing workspace ID
 * @returns Created role
 *
 * @example
 * POST /api/workspaces/workspace123/roles
 * Body:
 * {
 *   "name": "Developer",
 *   "description": "Can create and manage channels",
 *   "permissions": [
 *     { "resource": "channels", "actions": ["create", "read", "update"] }
 *   ],
 *   "color": "#10B981"
 * }
 *
 * Response:
 * {
 *   "role": {
 *     "id": "custom-role-1234567890",
 *     "name": "Developer",
 *     "description": "Can create and manage channels",
 *     "permissions": [...],
 *     "isSystem": false,
 *     "color": "#10B981",
 *     "memberCount": 0,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Authentication required',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Check workspace access and admin permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access || !access.membership) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found or access denied',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify admin or owner role
    if (!['ADMIN', 'OWNER'].includes(access.membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin or Owner role required to create roles',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invalid JSON body',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
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

    // Check if role name conflicts with system roles
    const existingSystemRole = SYSTEM_ROLES.find(
      r => r.name.toLowerCase() === parseResult.data.name.toLowerCase(),
    );
    if (existingSystemRole) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Role name conflicts with a system role',
          ADMIN_ERROR_CODES.ROLE_NAME_EXISTS,
        ),
        { status: 409 },
      );
    }

    // Get existing custom roles
    const settings =
      (access.workspace.settings as Record<string, unknown> | null) || {};
    const customRoles: Role[] =
      typeof settings === 'object' &&
      settings !== null &&
      'customRoles' in settings &&
      Array.isArray(settings.customRoles)
        ? (settings.customRoles as Role[])
        : [];

    // Check if role name conflicts with existing custom roles
    const existingCustomRole = customRoles.find(
      r => r.name.toLowerCase() === parseResult.data.name.toLowerCase(),
    );
    if (existingCustomRole) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Role name already exists',
          ADMIN_ERROR_CODES.ROLE_NAME_EXISTS,
        ),
        { status: 409 },
      );
    }

    // Create new custom role
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

    // Update workspace settings with new role
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          customRoles: [...customRoles, newRole],
        },
      },
    });

    // Log admin action (optional - table may not exist)
    try {
      await prisma.$executeRaw`
        INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, target_name, metadata, created_at)
        VALUES (gen_random_uuid(), ${workspaceId}, 'role.created', ${session.user.id}, 'role', ${newRole.id}, ${newRole.name}, ${JSON.stringify({})}::jsonb, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      // Silently ignore if admin_actions table doesn't exist
      console.debug(
        '[POST /api/workspaces/:workspaceId/roles] Admin action logging skipped:',
        error,
      );
    }

    return NextResponse.json({ role: newRole }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/roles] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to create role',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
