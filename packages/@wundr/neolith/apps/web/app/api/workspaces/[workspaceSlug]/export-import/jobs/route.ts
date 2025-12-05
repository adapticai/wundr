/**
 * Export Jobs API Endpoint
 *
 * GET - List export jobs
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can view export jobs' },
        { status: 403 }
      );
    }

    // Return empty jobs for now - in production this would track exports
    // This could be implemented using file system or a separate tracking mechanism
    const jobs: Array<{
      id: string;
      type: string;
      format: string;
      status: string;
      createdAt: string;
      completedAt?: string;
      error?: string;
      downloadUrl?: string;
      recordCount?: number;
    }> = [];

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to fetch export jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export jobs' },
      { status: 500 }
    );
  }
}
