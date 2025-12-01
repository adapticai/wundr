/**
 * Admin Members API Routes
 *
 * Handles workspace member management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/members - List members with filters
 *
 * @module app/api/workspaces/[workspaceId]/admin/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  memberFiltersSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { MemberStatus } from '@/lib/validations/admin';
import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/admin/members
 *
 * List workspace members with filters. Requires admin role.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace ID
 * @returns Paginated list of members
 */
export async function GET(
  request: Request,
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

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      status: (searchParams.get('status') as MemberStatus | null) || undefined,
      roleId: searchParams.get('roleId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 20,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!)
        : 0,
    };

    // Validate filters
    const parseResult = memberFiltersSchema.safeParse(filters);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { status, roleId, search, limit, offset } = parseResult.data;

    // Build where clause using Prisma's WorkspaceMemberWhereInput type
    const where: Prisma.workspaceMemberWhereInput = { workspaceId };

    if (roleId) {
      // Map role ID to role name (simplified for now)
      const roleMap: Record<string, Prisma.workspaceMemberWhereInput['role']> =
        {
          'system-role-0': 'OWNER',
          'system-role-1': 'ADMIN',
          'system-role-2': 'MEMBER',
          'system-role-3': 'GUEST',
        };
      if (roleMap[roleId]) {
        where.role = roleMap[roleId];
      }
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Fetch members
    const [members, total] = await Promise.all([
      prisma.workspaceMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isOrchestrator: true,
              status: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        skip: offset,
        take: limit,
      }),
      prisma.workspaceMember.count({ where }),
    ]);

    // Map members to response format
    const memberInfos = members
      .map(m => {
        // Determine member status based on user status
        let memberStatus: MemberStatus = 'ACTIVE';
        if (m.user.status === 'SUSPENDED') {
          memberStatus = 'SUSPENDED';
        } else if (m.user.status === 'PENDING') {
          memberStatus = 'PENDING';
        }

        // Filter by status if specified
        if (status && memberStatus !== status) {
          return null;
        }

        return {
          id: m.id,
          userId: m.userId,
          user: {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            displayName: m.user.displayName,
            avatarUrl: m.user.avatarUrl,
            isOrchestrator: m.user.isOrchestrator,
          },
          role: m.role,
          roleId: null, // Would be populated from custom roles
          status: memberStatus,
          customFields: {},
          joinedAt: m.joinedAt,
          suspendedAt: null,
          suspendReason: null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      members: memberInfos,
      total: status ? memberInfos.length : total,
      limit,
      offset,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch members',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
