import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; keyId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, keyId } = await context.params;

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify API key belongs to workspace
    const credential = await prisma.daemonCredential.findFirst({
      where: {
        id: keyId,
      },
    });

    if (!credential) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Delete the API key
    await prisma.daemonCredential.delete({
      where: { id: keyId },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorType: 'user',
        action: 'api_key.deleted',
        resourceType: 'api_key',
        resourceId: keyId,
        metadata: {
          keyPrefix: credential.apiKey,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, keyId } = await context.params;
    const body = await request.json();

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        workspaceMembers: {
          include: { user: true },
          where: {
            userId: session.user.id,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!workspace || workspace.workspaceMembers.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify API key belongs to workspace
    const credential = await prisma.daemonCredential.findFirst({
      where: {
        id: keyId,
      },
    });

    if (!credential) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Update API key (only isActive can be updated)
    const updated = await prisma.daemonCredential.update({
      where: { id: keyId },
      data: {
        isActive:
          body.isActive !== undefined ? body.isActive : credential.isActive,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorType: 'user',
        action: 'api_key.updated',
        resourceType: 'api_key',
        resourceId: keyId,
        metadata: {
          isActive: updated.isActive,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, apiKey: updated });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
