import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const loginAttemptsSchema = z.object({
  maxAttempts: z.number().min(1).max(20),
  lockoutDuration: z.number().min(1).max(1440), // minutes
  resetAfter: z.number().min(1).max(1440), // minutes
  notifyOnLockout: z.boolean(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
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

    const settings = (workspace.settings as Record<string, unknown>) || {};
    const loginAttempts = (settings.loginAttempts as Record<
      string,
      unknown
    >) || {
      maxAttempts: 5,
      lockoutDuration: 30,
      resetAfter: 60,
      notifyOnLockout: true,
    };

    return NextResponse.json({ loginAttempts });
  } catch (error) {
    console.error('Error fetching login attempts settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    // Validate input
    const parseResult = loginAttemptsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    // Verify admin access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
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

    // Update login attempts settings
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      loginAttempts: parseResult.data,
    };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        
        actorId: session.user.id, actorType: 'user',
        action: 'settings.login_attempts.updated',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          changes: parseResult.data,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ loginAttempts: parseResult.data });
  } catch (error) {
    console.error('Error updating login attempts settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
