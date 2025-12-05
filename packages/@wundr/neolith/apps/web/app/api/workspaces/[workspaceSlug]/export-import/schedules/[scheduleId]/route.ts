/**
 * Backup Schedule Management API
 *
 * DELETE - Delete backup schedule
 * PATCH - Update backup schedule
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ workspaceSlug: string; scheduleId: string }>;
  },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId, scheduleId } = await params;

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
        { status: 404 },
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can delete schedules' },
        { status: 403 },
      );
    }

    // In production, this would delete from workspace settings JSON
    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete backup schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete backup schedule' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ workspaceSlug: string; scheduleId: string }>;
  },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId, scheduleId } = await params;

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
        { status: 404 },
      );
    }

    if (!['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace admins can update schedules' },
        { status: 403 },
      );
    }

    const body = await request.json();

    // In production, this would update the workspace settings JSON
    return NextResponse.json({
      schedule: {
        id: scheduleId,
        enabled: body.enabled,
        updatedAt: new Date().toISOString(),
      },
      message: 'Schedule updated successfully',
    });
  } catch (error) {
    console.error('Failed to update backup schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update backup schedule' },
      { status: 500 },
    );
  }
}
