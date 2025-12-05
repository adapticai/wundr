import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

const passwordPolicySchema = z.object({
  minLength: z.number().min(8).max(128),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSpecialChars: z.boolean(),
  expiryDays: z.number().min(0).max(365),
  preventReuse: z.number().min(0).max(24),
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
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check user is admin
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = (workspace.settings as Record<string, unknown>) || {};
    const passwordPolicy = (settings.passwordPolicy as Record<
      string,
      unknown
    >) || {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expiryDays: 90,
      preventReuse: 5,
    };

    return NextResponse.json({ passwordPolicy });
  } catch (error) {
    console.error('Error fetching password policy:', error);
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

    const { workspaceSlug } = await context.params;
    const body = await request.json();

    // Validate input
    const parseResult = passwordPolicySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
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
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check user is admin
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update password policy
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      passwordPolicy: parseResult.data,
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
        actorId: session.user.id,
        actorType: 'user',
        action: 'settings.password_policy.updated',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          changes: parseResult.data,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ passwordPolicy: parseResult.data });
  } catch (error) {
    console.error('Error updating password policy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
