/**
 * Admin Users Export API Routes
 *
 * Handles exporting user data to CSV.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/users/export - Export users to CSV
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/users/export/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/users/export
 *
 * Export workspace users to CSV. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns CSV file download
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
      select: { id: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Verify admin access
    const adminMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
    });

    if (
      !adminMembership ||
      !['ADMIN', 'OWNER'].includes(adminMembership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all workspace members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            status: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
    });

    // Generate CSV content
    const headers = [
      'User ID',
      'Name',
      'Display Name',
      'Email',
      'Role',
      'Status',
      'Joined Date',
      'Last Active',
      'Account Created',
    ];

    const rows = members.map(m => [
      m.userId,
      m.user.name || '',
      m.user.displayName || '',
      m.user.email || '',
      m.role,
      m.user.status,
      m.joinedAt.toISOString(),
      m.user.lastActiveAt?.toISOString() || '',
      m.user.createdAt.toISOString(),
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map(row => row.map(val => escapeCsvValue(String(val))).join(',')),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export users:', error);
    return NextResponse.json(
      { error: 'Failed to export users' },
      { status: 500 }
    );
  }
}
