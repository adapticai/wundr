/**
 * Export Orchestrators
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership || !['OWNER', 'ADMIN'].includes(orgMembership.role)) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * GET - Export orchestrators as CSV
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orchestrators = await prisma.orchestrator.findMany({
      where: {
        organizationId: access.workspace.organizationId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Create CSV
    const headers = [
      'ID',
      'Name',
      'Discipline',
      'Role',
      'Status',
      'Owner Name',
      'Owner Email',
      'Created At',
    ];

    const rows = orchestrators.map(o => [
      o.id,
      `${o.role} - ${o.discipline}`,
      o.discipline || '',
      o.role,
      o.status,
      o.user.name || '',
      o.user.email || '',
      o.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orchestrators-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('[GET export]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
