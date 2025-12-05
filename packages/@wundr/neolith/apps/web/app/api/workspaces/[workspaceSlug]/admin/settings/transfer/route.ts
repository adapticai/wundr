import { prisma, WorkspaceRole } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * POST /api/workspaces/[workspaceSlug]/admin/settings/transfer
 * Transfer workspace ownership to another member
 *
 * Request body:
 * {
 *   "newOwnerId": "user-id"
 * }
 *
 * Only workspace owners can transfer ownership
 * New owner must be an existing admin or member of the workspace
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();
    const { newOwnerId } = body;

    if (!newOwnerId || typeof newOwnerId !== 'string') {
      return NextResponse.json(
        { error: 'New owner ID is required' },
        { status: 400 },
      );
    }

    // Find the workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      include: {
        workspaceMembers: {
          where: {
            OR: [
              { userId: session.user.id },
              { userId: newOwnerId },
            ],
          },
          select: {
            id: true,
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Check if current user is an owner
    const currentUserMember = workspace.workspaceMembers.find(
      m => m.userId === session.user.id,
    );
    if (!currentUserMember || currentUserMember.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only workspace owners can transfer ownership' },
        { status: 403 },
      );
    }

    // Check if new owner exists in workspace
    const newOwnerMember = workspace.workspaceMembers.find(
      m => m.userId === newOwnerId,
    );
    if (!newOwnerMember) {
      return NextResponse.json(
        { error: 'New owner must be a member of the workspace' },
        { status: 400 },
      );
    }

    // Prevent self-transfer
    if (newOwnerId === session.user.id) {
      return NextResponse.json(
        { error: 'You are already the owner' },
        { status: 400 },
      );
    }

    // Perform the transfer in a transaction
    await prisma.$transaction([
      // Downgrade current owner to admin
      prisma.workspaceMember.update({
        where: { id: currentUserMember.id },
        data: { role: WorkspaceRole.ADMIN },
      }),
      // Upgrade new owner
      prisma.workspaceMember.update({
        where: { id: newOwnerMember.id },
        data: { role: WorkspaceRole.OWNER },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwner: {
        id: newOwnerMember.user.id,
        name: newOwnerMember.user.name,
        email: newOwnerMember.user.email,
      },
    });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
