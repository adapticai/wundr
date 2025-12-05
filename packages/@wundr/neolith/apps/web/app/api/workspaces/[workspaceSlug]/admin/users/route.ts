/**
 * Admin Users API Routes
 *
 * Handles workspace user management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/users - List users with filters
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/users
 *
 * List workspace users with filters. Requires admin role.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace slug
 * @returns Paginated list of users
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Find workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
    });

    if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Prisma.workspaceMemberWhereInput = {
      workspaceId: workspace.id,
    };

    if (role && role !== 'all') {
      where.role = role as Prisma.workspaceMemberWhereInput['role'];
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

    // Fetch users
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
              lastActiveAt: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.workspaceMember.count({ where }),
    ]);

    // Map members to response format
    const users = members
      .map(m => {
        // Determine user status
        let userStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING' = 'ACTIVE';
        if (m.user.status === 'SUSPENDED') {
          userStatus = 'SUSPENDED';
        } else if (m.user.status === 'PENDING') {
          userStatus = 'PENDING';
        }

        // Filter by status if specified
        if (status && status !== 'all' && userStatus !== status) {
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
            status: m.user.status,
            lastActiveAt: m.user.lastActiveAt,
          },
          role: m.role,
          status: userStatus,
          joinedAt: m.joinedAt.toISOString(),
          lastActivity: m.user.lastActiveAt?.toISOString() || null,
          permissions: [], // Can be populated based on role
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      users,
      total: status && status !== 'all' ? users.length : total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
